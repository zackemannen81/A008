import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { GuiSession } from "../session/types.js";
import { captureSessionPrompt } from "./capture-prompt.js";
import {
  initialChatHistory,
  reduceChatHistory,
  shouldSuppressLive,
} from "./chat-history.js";
import {
  buildChatTranscript,
  CHAT_CHANNEL,
  emptyStateCopy,
  type ChatAssistantTurn,
  type ChatToolActivity,
  type ChatUserTurn,
} from "./chat-transcript.js";
import { AsciiLogo } from "../brand/ascii-logo.js";
import { StartActions } from "./start-actions.js";
import { EmptyStarfield } from "./starfield.js";
import {
  htmlArtifactFromAnswer,
  parseAssistantAnswer,
  type HtmlArtifactCandidate,
} from "../artifact/code-artifact.js";
import { HighlightedCode } from "../highlight/highlighted-code.js";
import { ToolActivity } from "../tools/repository-pane.js";
import "./chat-pane.css";

export interface ChatGeneratedImage {
  readonly id: string;
  readonly prompt: string;
  readonly src: string;
}

function ThoughtBlock({ turn }: { readonly turn: ChatAssistantTurn }) {
  const [open, setOpen] = useState(false);

  if (turn.thought === "") {
    return null;
  }

  return (
    <details
      className="a008-chat-thought"
      data-a008-channel={CHAT_CHANNEL.thought}
      open={open}
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary aria-label="Thought, display only. Not part of the answer.">
        Thought
      </summary>
      <div className="a008-chat-thought-body">{turn.thought}</div>
    </details>
  );
}

function UserTurnView({ turn }: { readonly turn: ChatUserTurn }) {
  return (
    <article className="a008-chat-turn a008-chat-turn-user" data-a008-role="user">
      <span className="a008-chat-label">You</span>
      <p
        className="a008-chat-bubble a008-chat-bubble-user"
        data-a008-channel={CHAT_CHANNEL.user}
      >
        {turn.text}
      </p>
    </article>
  );
}

function AssistantTurnView(props: {
  readonly turn: ChatAssistantTurn;
  readonly tools?: ChatAssistantTurn["tools"];
  readonly onArtifactOpen?: (artifact: HtmlArtifactCandidate) => void;
}) {
  const { turn } = props;
  const tools = props.tools ?? turn.tools;
  const segments = parseAssistantAnswer(turn.answer);
  return (
    <article
      className="a008-chat-turn a008-chat-turn-assistant"
      data-a008-role="assistant"
    >
      <span className="a008-chat-label">A008</span>
      <ThoughtBlock turn={turn} />
      {turn.answer !== "" ? (
        <div
          className="a008-chat-bubble a008-chat-bubble-answer"
          data-a008-channel={CHAT_CHANNEL.answer}
          aria-label="Answer"
        >
          {segments.map((segment, index) => segment.kind === "text" ? (
            <span key={`text-${index}`} className="a008-chat-answer-text">{segment.text}</span>
          ) : (
            <figure key={`code-${index}`} className="a008-chat-code">
              <figcaption className="a008-chat-code-head">
                <span>{segment.language || "code"}</span>
                {!turn.live && segment.artifactEligible && props.onArtifactOpen ? (
                  <button type="button" onClick={() => props.onArtifactOpen?.({
                    sourceTurnId: turn.id,
                    language: "html",
                    source: segment.code,
                    bytes: new TextEncoder().encode(segment.code).byteLength,
                  })}>Open in Canvas</button>
                ) : segment.oversized ? <span>Too large for Canvas</span> : null}
              </figcaption>
              <HighlightedCode code={segment.code} language={segment.language} />
            </figure>
          ))}
        </div>
      ) : null}
      <ToolActivity tools={tools} />
      {turn.live ? (
        <span className="a008-chat-live" aria-live="polite">
          {turn.answer === "" ? "Thinking…" : "Writing…"}
        </span>
      ) : null}
    </article>
  );
}

/** A008 chat transcript. Keep the ChatPane export. */
export function ChatPane(props: {
  readonly session: GuiSession;
  readonly onStartPrompt?: (prompt: string) => void;
  readonly onArtifactOpen?: (artifact: HtmlArtifactCandidate) => void;
  readonly onArtifactCandidate?: (artifact: HtmlArtifactCandidate) => void;
  readonly images?: readonly ChatGeneratedImage[];
}) {
  const { session } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [history, dispatch] = useReducer(reduceChatHistory, initialChatHistory);
  const [toolLog, setToolLog] = useState<Readonly<Record<string, readonly ChatToolActivity[]>>>({});

  useEffect(() => {
    if (session.details !== undefined) return;
    return captureSessionPrompt(session, (text) => {
      const current = sessionRef.current;
      dispatch({
        kind: "user",
        text,
        thought: current.thought,
        answer: current.answer,
      });
    });
  }, [session]);

  useEffect(() => {
    if (session.details !== undefined) return;
    dispatch({
      kind: "live",
      thought: session.thought,
      answer: session.answer,
    });
  }, [session.details, session.thought, session.answer]);

  const transcript = useMemo(
    () =>
      buildChatTranscript({
        session,
        history: history.turns,
        suppressLive: shouldSuppressLive(history, {
          thought: session.thought,
          answer: session.answer,
        }),
      }),
    [session, history],
  );

  const latestArtifact = useMemo(() => {
    for (let index = transcript.turns.length - 1; index >= 0; index -= 1) {
      const turn = transcript.turns[index];
      if (turn?.kind !== "assistant" || turn.live) continue;
      const artifact = htmlArtifactFromAnswer(turn.answer, turn.id);
      if (artifact !== undefined) return artifact;
    }
    return undefined;
  }, [transcript.turns]);
  const reportedArtifact = useRef("");
  useEffect(() => {
    if (!latestArtifact || !props.onArtifactCandidate) return;
    const key = `${latestArtifact.sourceTurnId}:${latestArtifact.bytes}:${latestArtifact.source}`;
    if (reportedArtifact.current === key) return;
    reportedArtifact.current = key;
    props.onArtifactCandidate(latestArtifact);
  }, [latestArtifact, props.onArtifactCandidate]);

  useEffect(() => {
    setToolLog({});
  }, [session.sessionId]);

  useEffect(() => {
    if (transcript.empty) setToolLog({});
  }, [transcript.empty]);

  useEffect(() => {
    if (!session.tools?.length) return;
    const live = [...transcript.turns].reverse().find((turn) => turn.kind === "assistant");
    if (live?.kind !== "assistant") return;
    const next = session.tools;
    setToolLog((current) => {
      const owned = new Set(
        Object.entries(current).flatMap(([id, tools]) =>
          id === live.id ? [] : tools.map((tool) => tool.id),
        ),
      );
      const scoped = next.filter((tool) => !owned.has(tool.id));
      const existing = current[live.id];
      if (
        existing !== undefined &&
        existing.length === scoped.length &&
        existing.every((tool, index) => {
          const incoming = scoped[index];
          return incoming !== undefined &&
            tool.id === incoming.id &&
            tool.status === incoming.status &&
            tool.text === incoming.text;
        })
      ) {
        return current;
      }
      return { ...current, [live.id]: scoped };
    });
  }, [session.tools, transcript.turns]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (root === null || !stickToBottom.current) {
      return;
    }
    root.scrollTop = root.scrollHeight;
  }, [transcript.turns]);

  return (
    <section className="a008-chat" aria-label="A008 chat">
      {transcript.empty && (props.images?.length ?? 0) === 0 ? <EmptyStarfield /> : null}
      {session.error !== undefined && session.error !== "" ? (
        <p className="a008-chat-error" data-a008-chat="error" role="alert">
          {session.error}
        </p>
      ) : null}
      <div
        ref={scrollerRef}
        className="a008-chat-transcript"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(event) => {
          const root = event.currentTarget;
          stickToBottom.current =
            root.scrollHeight - root.scrollTop - root.clientHeight < 48;
        }}
      >
        {transcript.empty && (props.images?.length ?? 0) === 0 ? (
          <div className="a008-chat-empty">
            <AsciiLogo />
            <hr className="a008-empty-rule" />
            <h1>What would you like to work on?</h1>
            <p>{emptyStateCopy(session.status)}</p>
            {props.onStartPrompt ? (
              <StartActions onPrompt={props.onStartPrompt} />
            ) : (
              <p className="a008-empty-hint">
                Work with your repository, explore memory, or start a conversation.
              </p>
            )}
          </div>
        ) : (
          <>
            {transcript.turns.map((turn) =>
              turn.kind === "user" ? (
                <UserTurnView key={turn.id} turn={turn} />
              ) : (
                <AssistantTurnView
                  key={turn.id}
                  turn={turn}
                  tools={toolLog[turn.id] ?? turn.tools}
                  onArtifactOpen={props.onArtifactOpen}
                />
              ),
            )}
            {(props.images ?? []).map((image) => (
              <article key={image.id} className="a008-chat-turn a008-chat-turn-assistant">
                <span className="a008-chat-label">Image</span>
                <p className="a008-chat-bubble a008-chat-bubble-user">{image.prompt}</p>
                <img className="a008-chat-image" src={image.src} alt={image.prompt} />
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
