export const START_ACTIONS = [
  {
    id: "explore",
    label: "Explore and understand the code",
    prompt:
      "Utforska och förstå kodbasen. Läs AGENTS.md och lista rotens filer med dina verktyg. Sammanfatta hur projektet är uppbyggt.",
  },
  {
    id: "build",
    label: "Build a new feature, app or tool",
    prompt:
      "Jag vill bygga en ny funktion. Läs AGENTS.md, titta på relevant kod och föreslå en konkret, avgränsad implementation.",
  },
  {
    id: "review",
    label: "Review code and suggest changes",
    prompt:
      "Granska ändringarna i arbetskopian med git status, git diff och git diff --cached. Läs berörda filer vid behov och sammanfatta fynden.",
  },
  {
    id: "fix",
    label: "Fix problems and bugs",
    prompt:
      "Hitta fel och problem i arbetskopian. Använd git status och tester om de finns, och föreslå eller gör en avgränsad fix.",
  },
] as const;

export function StartActions(props: { readonly onPrompt: (prompt: string) => void }) {
  return (
    <div className="a008-start-actions" aria-label="Starting tasks">
      {START_ACTIONS.map((action) => (
        <button key={action.id} type="button" onClick={() => props.onPrompt(action.prompt)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
