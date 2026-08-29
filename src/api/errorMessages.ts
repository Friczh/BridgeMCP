// Locked mapping from design.md "Error code → friendly message" table.
// Single source of truth, keyed by the Worker's `error` field.
export const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Pages can't authorize with the backend. Please log in again.",
  not_found: "That item couldn't be found. It may have been removed.",
  bad_gateway: "One of your connected tools didn't respond correctly.",
  gateway_timeout: 'That request took too long and timed out. Try again.',
  bad_request: "Something in this form isn't valid — check the highlighted fields.",
};

export const FALLBACK_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const NETWORK_ERROR_MESSAGE = "Can't reach the backend right now. Check your connection and try again.";

export function friendlyMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? FALLBACK_ERROR_MESSAGE;
}
