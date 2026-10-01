export interface NavigationDecision {
  readonly preventDefault: () => void;
}

export function isAllowedHostUrl(hostOrigin: string, target: string): boolean {
  try {
    return new URL(target).origin === new URL(hostOrigin).origin;
  } catch {
    return false;
  }
}

export function preventUntrustedNavigation(
  hostOrigin: string,
  target: string,
  event: NavigationDecision,
): void {
  if (!isAllowedHostUrl(hostOrigin, target)) event.preventDefault();
}