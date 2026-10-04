import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_GUI_MODEL,
  loadModels,
  loadProviderSettings,
  saveProviderSettings,
  saveWorkspaceSettings,
} from "../../../packages/client/src/index.js";
import type { GuiModel, ProviderSettings, RuntimePreferencesSnapshot } from "../../../packages/protocol/src/index.js";
import { guiHttp } from "../client.js";
import type { GuiSession } from "../session/types.js";
import { APP_THEMES, type AppThemeId } from "../brand/theme.js";
import { readStoredAppTheme, selectAppTheme } from "../brand/theme-storage.js";
import {
  composeSetupInstructions,
  readDefaultChatModel,
  readFirstRunSetupState,
  saveDefaultChatModel,
  saveFirstRunSetupState,
} from "./setup-state.js";

interface FirstRunSetupProps {
  readonly session: GuiSession;
  readonly runtimePreferences: RuntimePreferencesSnapshot | undefined;
  readonly onComplete: () => void;
}

export function FirstRunSetup({
  session,
  runtimePreferences,
  onComplete,
}: FirstRunSetupProps) {
  const [models, setModels] = useState<readonly GuiModel[]>([]);
  const [provider, setProvider] = useState<ProviderSettings>();
  const [theme, setTheme] = useState<AppThemeId>(() => readStoredAppTheme());
  const [chatModel, setChatModel] = useState("");
  const [semanticModel, setSemanticModel] = useState("");
  const [userName, setUserName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [openAiKey, setOpenAiKey] = useState("");
  const [kieKey, setKieKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openCodeKey, setOpenCodeKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initial = readFirstRunSetupState();
    setUserName(initial.userName);
    setInstructions(initial.customInstructions);
    void Promise.all([
      loadModels(guiHttp()),
      loadProviderSettings(guiHttp()).catch(() => undefined),
    ]).then(([loadedModels, loadedProvider]) => {
      setModels(loadedModels);
      setProvider(loadedProvider);
      const savedChat = readDefaultChatModel();
      setChatModel(
        savedChat ??
          (loadedModels.some((model) => model.id === DEFAULT_GUI_MODEL)
            ? DEFAULT_GUI_MODEL
            : loadedModels[0]?.id ?? ""),
      );
      setSemanticModel(
        runtimePreferences?.settings.semantic?.model ??
          loadedModels[0]?.id ??
          "",
      );
    });
  }, [runtimePreferences]);

  async function finish(useDefaults: boolean) {
    setBusy(true);
    setError("");
    try {
      const selectedChat = useDefaults
        ? models.find((model) => model.id === DEFAULT_GUI_MODEL)?.id ?? chatModel
        : chatModel;
      const selectedSemantic = useDefaults
        ? runtimePreferences?.defaults.semantic?.model ?? semanticModel
        : semanticModel;
      if (!useDefaults && !selectedChat) throw new Error("Choose a chat model.");
      if (!useDefaults && !selectedSemantic)
        throw new Error("Choose a semantic model.");
      if (!useDefaults && workspaceRoot.trim())
        await saveWorkspaceSettings(guiHttp(), workspaceRoot.trim());
      if (!useDefaults) {
        await saveProviderSettings(guiHttp(), {
          ...(nvidiaKey.trim() ? { nvidiaApiKey: nvidiaKey.trim() } : {}),
          ...(openAiKey.trim() ? { openAiApiKey: openAiKey.trim() } : {}),
          ...(kieKey.trim() ? { kieApiKey: kieKey.trim() } : {}),
          ...(openRouterKey.trim() ? { openRouterApiKey: openRouterKey.trim() } : {}),
          ...(groqKey.trim() ? { groqApiKey: groqKey.trim() } : {}),
          ...(geminiKey.trim() ? { geminiApiKey: geminiKey.trim() } : {}),
          ...(openCodeKey.trim() ? { openCodeApiKey: openCodeKey.trim() } : {}),
        });
        if (!runtimePreferences)
          throw new Error("Global runtime settings are unavailable.");
        if (!session.controlSession)
          throw new Error("This host cannot save global runtime settings.");
        await session.controlSession({
          action: "configureRuntime",
          settings: {
            ...runtimePreferences.settings,
            instructions: composeSetupInstructions(userName, instructions),
            semantic: {
              model: selectedSemantic,
              reasoningEffort:
                runtimePreferences.settings.semantic?.reasoningEffort ?? null,
            },
          },
          revision: runtimePreferences.revision,
        });
      }
      if (selectedChat) saveDefaultChatModel(selectedChat);
      saveFirstRunSetupState({
        completed: true,
        userName: useDefaults ? "" : userName.trim(),
        customInstructions: useDefaults ? "" : instructions.trim(),
      });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="a008-setup-overlay" role="dialog" aria-modal="true" aria-labelledby="a008-setup-title">
      <form className="a008-setup-card" onSubmit={(event: FormEvent) => { event.preventDefault(); void finish(false); }}>
        <p className="a008-setup-kicker">A008 DESKTOP</p>
        <h1 id="a008-setup-title">Set up your local AI workspace</h1>
        <p>Choose the important defaults now. You can change everything later under Parameters.</p>
        <fieldset disabled={busy}>
          <section>
            <h2>Appearance</h2>
            <div className="a008-setup-choices" role="group" aria-label="Theme">
              {APP_THEMES.map((item) => (
                <button key={item.id} type="button" aria-pressed={theme === item.id} onClick={() => { setTheme(selectAppTheme(item.id)); }}>
                  <strong>{item.name}</strong><span>{item.description}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2>Providers</h2>
            <p>Keys are stored locally by the A008 host and are never shown again. Create keys at each provider's website; A008 cannot create provider accounts.</p>
            <label>NVIDIA API key<input type="password" autoComplete="off" value={nvidiaKey} placeholder={provider?.nvidiaApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setNvidiaKey(event.target.value)} /></label>
            <label>OpenAI API key<input type="password" autoComplete="off" value={openAiKey} placeholder={provider?.openAiApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setOpenAiKey(event.target.value)} /></label>
            <label>kie.ai API key<input type="password" autoComplete="off" value={kieKey} placeholder={provider?.kieApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setKieKey(event.target.value)} /></label>
            <label>OpenRouter API key<input type="password" autoComplete="off" value={openRouterKey} placeholder={provider?.openRouterApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setOpenRouterKey(event.target.value)} /></label>
            <label>Groq API key<input type="password" autoComplete="off" value={groqKey} placeholder={provider?.groqApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setGroqKey(event.target.value)} /></label>
            <label>Gemini API key<input type="password" autoComplete="off" value={geminiKey} placeholder={provider?.geminiApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setGeminiKey(event.target.value)} /></label>
            <label>OpenCode API key<input type="password" autoComplete="off" value={openCodeKey} placeholder={provider?.openCodeApiKeyConfigured ? "Already configured" : "Optional"} onChange={(event) => setOpenCodeKey(event.target.value)} /></label>
          </section>
          <section>
            <h2>Models</h2>
            <label>Default chat model<select value={chatModel} onChange={(event) => setChatModel(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
            <label>Default semantic model<select value={semanticModel} onChange={(event) => setSemanticModel(event.target.value)}>{models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
          </section>
          <section>
            <h2>About you</h2>
            <label>Your name<input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="Optional" /></label>
            <label>Custom instructions<textarea rows={4} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="How should A008 work with you?" /></label>
          </section>
          <section>
            <h2>Parallel sessions</h2>
            <label>Worktree root<input value={workspaceRoot} onChange={(event) => setWorkspaceRoot(event.target.value)} placeholder="Leave empty for the current default" /></label>
          </section>
        </fieldset>
        {error ? <p className="a008-setup-error" role="alert">{error}</p> : null}
        <footer>
          <button type="button" disabled={busy} onClick={() => void finish(true)}>Use defaults</button>
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Finish setup"}</button>
        </footer>
      </form>
    </div>
  );
}
