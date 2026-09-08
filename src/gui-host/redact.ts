const FORBIDDEN_NAME = /NVIDIA_API_KEY|KIE_API_KEY|OPENAI_API_KEY|authorization/giu;

export function wireSecrets(env: NodeJS.ProcessEnv): readonly string[] {
  const secrets: string[] = [];
  for (const name of ["NVIDIA_API_KEY", "KIE_API_KEY", "OPENAI_API_KEY"] as const) {
    const apiKey = env[name];
    if (typeof apiKey === "string" && apiKey.length > 0) {
      secrets.push(apiKey);
    }
  }
  return secrets;
}

export function redactWireText(
  text: string,
  secrets: readonly string[] = [],
): string {
  const unique = [...new Set(secrets.filter((secret) => secret.length > 0))].sort(
    (left, right) => right.length - left.length,
  );
  let redacted = text;
  for (const secret of unique) {
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted.replace(FORBIDDEN_NAME, "[redacted]");
}
