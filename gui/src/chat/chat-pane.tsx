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
  type ChatUserTurn,
} from "./chat-transcript.js";
import { EmptyShortcuts, type EmptyShortcutId } from "./empty-shortcuts.js";
import "./chat-pane.css";

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

function AssistantTurnView({ turn }: { readonly turn: ChatAssistantTurn }) {
  return (
    <article
      className="a008-chat-turn a008-chat-turn-assistant"
      data-a008-role="assistant"
    >
      <span className="a008-chat-label">A008</span>
      <ThoughtBlock turn={turn} />
      {turn.answer !== "" ? (
        <p
          className="a008-chat-bubble a008-chat-bubble-answer"
          data-a008-channel={CHAT_CHANNEL.answer}
          aria-label="Answer"
        >
          {turn.answer}
        </p>
      ) : null}
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
  readonly onShortcut?: (id: EmptyShortcutId) => void;
}) {
  const { session } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [history, dispatch] = useReducer(reduceChatHistory, initialChatHistory);

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

  useEffect(() => {
    const root = scrollerRef.current;
    if (root === null || !stickToBottom.current) {
      return;
    }
    root.scrollTop = root.scrollHeight;
  }, [transcript.turns]);

  return (
    <section className="a008-chat" aria-label="A008 chat">
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
        {transcript.empty ? (
          <div className="a008-chat-empty">
            <span className="a008-empty-eyebrow">A008</span>
            <h1>What would you like to work on?</h1>
            <p>{emptyStateCopy(session.status)}</p>
            {props.onShortcut ? (
              <EmptyShortcuts onShortcut={props.onShortcut} />
            ) : (
              <p className="a008-empty-hint">
                Work with your repository, explore memory, or start a conversation.
              </p>
            )}
          </div>
        ) : (
          transcript.turns.map((turn) =>
            turn.kind === "user" ? (
              <UserTurnView key={turn.id} turn={turn} />
            ) : (
              <AssistantTurnView key={turn.id} turn={turn} />
            ),
          )
        )}
      </div>
    </section>
  );
}
