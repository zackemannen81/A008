export function redactSecrets(value: string): string {
  const secretPattern =
    /[A-Z0-9_]*API[_-]?KEY|\bapi[_-]?key\b|\bauthorization\b|\bbearer\s+\S+|\bnvapi-[A-Za-z0-9_-]+|\bsk-[A-Za-z0-9_-]+|\.env(?:\.local)?/giu;
  const homePathPattern =
    /(?:[A-Za-z]:\\Users\\[^\\\s]+|\/Users\/[^/\s]+|\/home\/[^/\s]+)[^\s]*/giu;
  const sqlitePathPattern = /[^\s]*memory\.sqlite[^\s]*/giu;

  const redacted = value
    .replace(secretPattern, "[redacted]")
    .replace(homePathPattern, "[redacted]")
    .replace(sqlitePathPattern, "[redacted]");
  return redacted.trim().length === 0 ? "[redacted]" : redacted;
}
