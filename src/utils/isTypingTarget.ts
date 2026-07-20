/** True when `event` originated in a text-entry control, where single-key shortcuts (e.g. '?') should type instead of firing. */
export function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
