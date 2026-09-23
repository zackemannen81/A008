import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { bearerCredentials, cookieCredentials, createV2SessionClient, loadV2Info, type V2SessionClient, type V2SessionView } from "@a008/client";
import { theme as t } from "./src/theme";

type Tab = "Chat" | "Projects" | "Tools" | "Connection";
type Message = { role: "user" | "assistant"; text: string };
const SECRET = "a008.pocket.device.v1";
const PREFS = "a008.pocket.connection.v1";
const toolCards = [
  { name: "ZeroCostRadar", detail: "Available through A008 Parameters · Models", ready: true },
  { name: "Mahguyver-Tools", detail: "Installation, configuration and verification · adapter pending", ready: false },
  { name: "Remote Gateway", detail: "Remote control · secure adapter pending", ready: false },
  { name: "Zero-Loss", detail: "Backups and recovery · safety adapter pending", ready: false },
] as const;
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
function Button({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, secondary && s.buttonSecondary, disabled && s.disabled]}>
    <Text style={[s.buttonText, secondary && s.buttonSecondaryText]}>{label}</Text>
  </Pressable>;
}
function ParticleField() {
  const opacity = useRef(new Animated.Value(0.16)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.34, duration: 9500, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.16, duration: 9500, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
    {Array.from({ length: 19 }, (_, i) => <View key={i} style={{
      position: "absolute", left: `${(i * 37 + 13) % 94}%`, top: `${(i * 23 + 8) % 88}%`,
      width: i % 4 === 0 ? 2 : 1, height: i % 4 === 0 ? 2 : 1,
      borderRadius: 3, backgroundColor: i % 3 ? "#62708a" : "#9c7dbb",
    }} />)}
  </Animated.View>;
}
export default function App() {
  const [tab, setTab] = useState<Tab>("Chat");
  const [origin, setOrigin] = useState("");
  const [projectId, setProjectId] = useState("");
  const [credential, setCredential] = useState("");
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [view, setView] = useState<V2SessionView>({ status: "idle", thought: "", answer: "", lastSequence: 0 });
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [activeUser, setActiveUser] = useState("");
  const [completedAnswer, setCompletedAnswer] = useState("");
  const clientRef = useRef<V2SessionClient | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(PREFS), SecureStore.getItemAsync(SECRET)]).then(([saved, secret]) => {
      if (!mounted) return;
      if (saved) {
        try { const prefs = JSON.parse(saved) as { origin?: string; projectId?: string; model?: string };
          setOrigin(prefs.origin ?? ""); setProjectId(prefs.projectId ?? ""); setModel(prefs.model ?? "");
        } catch { /* ignore corrupt preferences */ }
      }
      setCredential(secret ?? "");
    }).catch(e => setNotice(errorText(e)));
    return () => { mounted = false; unlistenRef.current?.(); clientRef.current?.dispose(); };
  }, []);
  const attach = useCallback((client: V2SessionClient) => {
    unlistenRef.current?.();
    clientRef.current?.dispose();
    clientRef.current = client;
    unlistenRef.current = client.subscribe(() => setView(client.getSnapshot()));
    setView(client.getSnapshot());
  }, []);
  const connect = useCallback(async () => {
    if (working) return;
    const host = origin.trim().replace(/\/+$/, "");
    if (!/^https:\/\/[^\s/]+/i.test(host)) {
      setNotice("Use a reachable HTTPS address (private tunnel recommended)."); return;
    }
    if (!projectId.trim() || !credential.trim()) {
      setNotice("Project ID and A008 device credential are required."); return;
    }
    setWorking(true); setNotice("");
    try {
      await loadV2Info({ origin: host, credentials: cookieCredentials(), fetch: globalThis.fetch });
      const client = createV2SessionClient({
        origin: host, projectId: projectId.trim(), credentials: bearerCredentials(credential),
        fetch: globalThis.fetch, webSocket: WebSocket as any,
        ...(model.trim() ? { model: model.trim() } : {}),
      });
      attach(client);
      await client.connect();
      await SecureStore.setItemAsync(SECRET, credential);
      await AsyncStorage.setItem(PREFS, JSON.stringify({ origin: host, projectId: projectId.trim(), model: model.trim() }));
      setOrigin(host); setMessages([]); setActiveUser(""); setCompletedAnswer("");
      setTab("Chat");
    } catch (e) { setNotice(errorText(e)); clientRef.current?.dispose(); clientRef.current = null; }
    finally { setWorking(false); }
  }, [origin, projectId, credential, model, working, attach]);
  const resume = useCallback(async () => {
    if (working || !clientRef.current) return;
    setWorking(true); setNotice("");
    try { await clientRef.current.resume(); }
    catch (e) { setNotice(`Session not resumed: ${errorText(e)}. Do not blindly repeat a task.`); }
    finally { setWorking(false); }
  }, [working]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && clientRef.current?.getSnapshot().status === "connecting") {
        void resume();
      }
    });
    return () => subscription.remove();
  }, [resume]);
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !clientRef.current || viewRef.current.status !== "ready" || working) return;
    setMessages(prev => [...prev, ...(activeUser ? [{ role: "user" as const, text: activeUser }, { role: "assistant" as const, text: completedAnswer || viewRef.current.answer || "(No answer received)" }] : [])]);
    setActiveUser(text); setCompletedAnswer(""); setInput(""); setWorking(true); setNotice("");
    try { await clientRef.current.prompt(text); }
    catch (e) { setNotice(`Task outcome may be unknown: ${errorText(e)}. Inspect before retrying.`); }
    finally { setWorking(false); }
  }, [input, working, activeUser, completedAnswer]);
  const disconnect = () => {
    unlistenRef.current?.(); unlistenRef.current = null;
    clientRef.current?.dispose(); clientRef.current = null;
    setActiveUser(""); setMessages([]); setNotice(""); setTab("Connection");
  };
  const forget = () => Alert.alert("Forget device?", "Remove this phone's stored A008 device credential? Revoke it on the A008 host as well if needed.", [
    { text: "Cancel", style: "cancel" }, { text: "Forget", style: "destructive", onPress: () => {
      disconnect(); setCredential(""); void SecureStore.deleteItemAsync(SECRET).catch(e => setNotice(errorText(e)));
    }},
  ]);
  const connected = view.status === "ready";
  return <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor={t.background} />
    <ParticleField />
    <View style={s.header}>
      <Text style={s.brand}>◈  A008</Text>
      <Pressable accessibilityRole="button" onPress={() => setTab("Connection")} style={s.connectionBadge}>
        <View style={[s.dot, { backgroundColor: connected ? t.green : t.muted }]} />
        <Text style={s.status}>{connected ? "Connected" : view.status === "connecting" ? "Reconnecting" : "Not connected"}</Text>
      </Pressable>
    </View>
    <View style={s.content}>
      {tab === "Chat" && <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.chatScroll} keyboardShouldPersistTaps="handled">
          {!activeUser && messages.length === 0 && <View style={s.welcome}>
            <Text style={s.logo}>A008</Text>
            <Text style={s.headline}>What would you like to work on?</Text>
            <Text style={s.muted}>{connected ? "Your A008 workspace, on Android." : "Connect to start a conversation with A008."}</Text>
            {!connected && <Button label="Connect to A008" onPress={() => setTab("Connection")} />}
            {connected && <View style={s.suggestions}>{["Explore and understand the code", "Build a new feature, app or tool", "Review code and suggest changes", "Fix problems and bugs"].map(x =>
              <Pressable key={x} style={s.suggestion} onPress={() => setInput(x)}><Text style={s.text}>{x}</Text></Pressable>)}</View>}
          </View>}
          {messages.map((m, i) => <View key={i} style={[s.message, m.role === "user" && s.userMessage]}><Text style={s.text}>{m.text}</Text></View>)}
          {!!activeUser && <><View style={[s.message, s.userMessage]}><Text style={s.text}>{activeUser}</Text></View>
            {!!(view.answer || completedAnswer) && <View style={s.message}><Text style={s.text}>{view.answer || completedAnswer}</Text></View>}</>}
          {!!view.permission && <View style={s.warning}><Text style={s.title}>Tool approval required</Text><Text style={s.text}>{view.permission.title}</Text><Text style={s.muted}>{view.permission.text}</Text>
            <View style={s.actions}><Button label="Deny" secondary onPress={() => { void clientRef.current?.resolvePermission(view.permission!.id, false).catch(e => setNotice(errorText(e))); }} />
              <Button label="Allow once" onPress={() => { void clientRef.current?.resolvePermission(view.permission!.id, true).catch(e => setNotice(errorText(e))); }} /></View></View>}
          {!!view.uncertainty && <View style={s.warning}><Text style={s.title}>Outcome uncertain: {view.uncertainty}</Text><Text style={s.muted}>Inspect host state. Pocket will not replay a mutation automatically.</Text></View>}
          {!!notice && <Text style={s.error}>{notice}</Text>}
        </ScrollView>
        <View style={s.composer}><TextInput accessibilityLabel="Message A008" placeholder="Ask anything, or describe a task..." placeholderTextColor={t.muted} value={input} onChangeText={setInput} multiline style={s.composeInput} />
          <View style={s.composerActions}><Text style={s.muted}>Commands  ·  A008</Text>
            <View style={s.actions}>{working && <ActivityIndicator color={t.accent} />}
              {connected && <Button label="Stop" secondary onPress={() => { void clientRef.current?.cancel().catch(e => setNotice(errorText(e))); }} />}
              <Button label="Send →" onPress={() => { void send(); }} disabled={!connected || !input.trim() || working} /></View></View>
        </View>
      </KeyboardAvoidingView>}
      {tab === "Projects" && <ScrollView contentContainerStyle={s.page}><Text style={s.headline}>Projects</Text>
        <View style={s.card}><Text style={s.title}>Current project</Text><Text style={s.text}>{projectId || "No project selected"}</Text>
          <Text style={s.muted}>V2 device access is scoped to the project granted by the A008 host.</Text>
          <Button label="Change project / device grant" secondary onPress={() => setTab("Connection")} /></View>
        <Text style={s.muted}>Project discovery and switching require the appropriate authenticated platform API. Pocket does not invent projects or grant itself access.</Text></ScrollView>}
      {tab === "Tools" && <ScrollView contentContainerStyle={s.page}><Text style={s.headline}>Tools</Text>
        {toolCards.map(card => <View key={card.name} style={s.card}><View style={s.cardHeader}><Text style={s.title}>{card.name}</Text>
          <Text style={[s.tiny, { color: card.ready ? t.green : t.amber }]}>{card.ready ? "A008" : "Not connected"}</Text></View>
          <Text style={s.muted}>{card.detail}</Text></View>)}
        <Text style={s.muted}>A008 handles approved tools on the host. Pocket never runs shell commands on your phone or silently grants tool permission.</Text></ScrollView>}
      {tab === "Connection" && <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"><Text style={s.headline}>Connection</Text>
        <View style={s.card}><Text style={s.title}>A008 host</Text><Text style={s.muted}>Use a private, reachable HTTPS origin; not 127.0.0.1 on your PC.</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://a008.your-private-domain" placeholderTextColor={t.muted} style={s.field} value={origin} onChangeText={setOrigin} />
          <Text style={s.title}>Project ID</Text><TextInput autoCapitalize="none" autoCorrect={false} placeholder="Registered A008 project ID" placeholderTextColor={t.muted} style={s.field} value={projectId} onChangeText={setProjectId} />
          <Text style={s.title}>Device credential</Text><Text style={s.muted}>Generate locally using A008's device grant command. Not a provider API key.</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="Paste device credential" placeholderTextColor={t.muted} style={s.field} value={credential} onChangeText={setCredential} />
          <Text style={s.title}>Model (optional)</Text><TextInput autoCapitalize="none" autoCorrect={false} placeholder="Use A008 default" placeholderTextColor={t.muted} style={s.field} value={model} onChangeText={setModel} />
          <Button label={working ? "Connecting…" : "Connect to A008"} onPress={() => { void connect(); }} disabled={working} />
          {connected && <Button label="Disconnect" secondary onPress={disconnect} />}
          {view.status === "connecting" && <Button label="Resume existing session" secondary onPress={() => { void resume(); }} disabled={working} />}
          <Button label="Forget stored credential" secondary onPress={forget} />
        </View>
        {!!notice && <Text style={s.error}>{notice}</Text>}
        <View style={s.card}><Text style={s.title}>Safety</Text><Text style={s.muted}>A008 device grants and tool approvals are enforced by the host. Zero-Loss and Remote Gateway are not claimed active until their adapters are connected and verified.</Text></View>
      </ScrollView>}
    </View>
    <View style={s.nav}>{(["Chat", "Projects", "Tools", "Connection"] as const).map(item => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === item }} key={item} style={[s.navItem, tab === item && s.navActive]} onPress={() => setTab(item)}><Text style={[s.navText, tab === item && s.navTextActive]}>{item}</Text></Pressable>)}</View>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: t.background, paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 24 : 38 },
  flex: { flex: 1 }, content: { flex: 1 }, header: { height: 60, borderBottomWidth: 1, borderBottomColor: "#303030", paddingHorizontal: 19, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: t.text, fontSize: 21, fontWeight: "700", letterSpacing: 0.2 }, connectionBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 }, status: { color: t.muted, fontSize: 12 }, text: { color: t.text, fontSize: 15, lineHeight: 22 },
  title: { color: t.text, fontSize: 16, fontWeight: "600", marginBottom: 8 }, headline: { color: t.text, fontSize: 26, fontWeight: "700", marginBottom: 12 },
  muted: { color: t.muted, fontSize: 13, lineHeight: 20 }, tiny: { fontSize: 11, fontWeight: "600" }, error: { color: t.red, fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  page: { padding: 20, gap: 16, paddingBottom: 36 }, chatScroll: { padding: 18, flexGrow: 1, gap: 12, paddingBottom: 30 },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", gap: 17, paddingVertical: 50 }, logo: { color: t.accent, fontSize: 48, fontWeight: "900", letterSpacing: 5, marginBottom: 8 },
  suggestions: { width: "100%", gap: 10, marginTop: 16 }, suggestion: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 18 },
  card: { backgroundColor: t.panel, borderWidth: 1, borderColor: t.border, borderRadius: 16, padding: 18, gap: 12 }, cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  message: { maxWidth: "92%", backgroundColor: t.panel, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: "#353535", alignSelf: "flex-start" },
  userMessage: { alignSelf: "flex-end", backgroundColor: "#343434" }, warning: { backgroundColor: "#342e24", borderRadius: 14, padding: 16, gap: 9, borderWidth: 1, borderColor: "#63513a" },
  composer: { backgroundColor: t.panel, borderWidth: 1, borderColor: t.border, borderRadius: 22, marginHorizontal: 12, marginBottom: 10, padding: 14 },
  composeInput: { color: t.text, fontSize: 16, minHeight: 50, maxHeight: 130, textAlignVertical: "top" },
  composerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  button: { backgroundColor: "#e7e9ec", borderRadius: 22, paddingHorizontal: 15, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  buttonSecondary: { backgroundColor: "#353535", borderWidth: 1, borderColor: "#555" }, buttonText: { color: "#171717", fontWeight: "700", fontSize: 13 },
  buttonSecondaryText: { color: t.text }, disabled: { opacity: 0.35 },
  field: { color: t.text, backgroundColor: "#191919", borderColor: t.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 6 },
  nav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#363636", paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "#202020" },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 }, navActive: { backgroundColor: "#363636" },
  navText: { color: t.muted, fontSize: 12 }, navTextActive: { color: t.text, fontWeight: "700" },
});
