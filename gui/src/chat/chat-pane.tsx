import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GuiSession } from "../session/types.js";
import { captureSessionPrompt } from "./capture-prompt.js";
import {
  buildChatTranscript,
  CHAT_CHANNEL,
  emptyStateCopy,
  type ChatAssistantTurn,
  type ChatTurn,
  type ChatUserTurn,
} from "./chat-transcript.js";
import "./chat-pane.css";

function nextId(prefix: string, counter: { current: number }): string {
  counter.current += 1;
  return `a008-chat-${prefix}-${String(counter.current)}`;
}

function ThoughtBlock({ turn }: { readonly turn: ChatAssistantTurn }) {
  const [open, setOpen] = useState(turn.live);

  useEffect(() => {
    if (turn.live) {
      setOpen(true);
    }
  }, [turn.live]);

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

function commitLiveAssistant(
  history: readonly ChatTurn[],
  session: GuiSession,
  ids: { current: number },
): ChatTurn[] {
  if (session.answer === "") {
    return [...history];
  }
  const last = history.at(-1);
  if (last?.kind === "assistant" && last.answer === session.answer) {
    return [...history];
  }
  return [
    ...history,
    {
      kind: "assistant",
      id: nextId("assistant", ids),
      thought: session.thought,
      answer: session.answer,
      live: false,
    },
  ];
}

/** A008-0034 replaces this stub. Keep the ChatPane export. */
export function ChatPane(props: { readonly session: GuiSession }) {
  const { session } = props;
  const ids = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [history, setHistory] = useState<readonly ChatTurn[]>([]);
  const [suppressLive, setSuppressLive] = useState(false);
  const frozenLive = useRef({ thought: "", answer: "" });
  const previousLive = useRef({ thought: session.thought, answer: session.answer });

  useLayoutEffect(() => {
    return captureSessionPrompt(session, (text) => {
      const current = sessionRef.current;
      frozenLive.current = {
        thought: current.thought,
        answer: current.answer,
      };
      setSuppressLive(true);
      setHistory((prev) => [
        ...commitLiveAssistant(prev, current, ids),
        { kind: "user", id: nextId("user", ids), text },
      ]);
    });
  }, [session]);

  useEffect(() => {
    const previous = previousLive.current;
    const hadLive = previous.thought !== "" || previous.answer !== "";
    const hasLive = session.thought !== "" || session.answer !== "";
    if (hadLive && !hasLive) {
      setHistory((prev) => commitLiveAssistant(prev, {
        ...session,
        thought: previous.thought,
        answer: previous.answer,
      }, ids));
    }
    previousLive.current = {
      thought: session.thought,
      answer: session.answer,
    };
  }, [session, session.thought, session.answer]);

  useEffect(() => {
    if (!suppressLive) {
      return;
    }
    if (
      session.thought !== frozenLive.current.thought ||
      session.answer !== frozenLive.current.answer
    ) {
      setSuppressLive(false);
    }
  }, [suppressLive, session.thought, session.answer]);

  const transcript = useMemo(
    () => buildChatTranscript({ session, history, suppressLive }),
    [session, history, suppressLive],
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
          <p className="a008-chat-empty">{emptyStateCopy(session.status)}</p>
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
