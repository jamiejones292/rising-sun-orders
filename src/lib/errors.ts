// Turn database error codes into sentences staff can act on.
const MESSAGES: Record<string, string> = {
  not_manager: "Only a manager or the owner can do that.",
  not_owner: "Only the owner can do that.",
  not_staff: "This account isn't set up as staff.",
  not_allowed: "Your account isn't allowed to do that.",
  needs_a_size: "Add at least one size with a price.",
  drink_not_found: "That drink no longer exists. Refresh the page.",
  size_not_found: "One of the sizes changed elsewhere. Refresh the page and try again.",
  option_not_found: "That mixer or extra changed elsewhere. Close this and open it again.",
};

export function friendlyError(err: unknown): string {
  const raw =
    typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return text;
  }
  if (/duplicate key|already exists/i.test(raw)) return "That name or number is already in use.";
  if (/violates check constraint/i.test(raw)) return "One of the values isn't allowed. Check the form and try again.";
  if (/permission denied|row-level security/i.test(raw)) return "Your account isn't allowed to do that.";
  if (/fetch|network|Failed to/i.test(raw)) return "Couldn't reach the server. Check the Wi-Fi and try again.";
  return "Something went wrong saving that. Try again, and tell the owner if it keeps happening.";
}
