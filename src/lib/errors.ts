// Turn database error codes into sentences staff can act on.
const MESSAGES: Record<string, string> = {
  not_manager: "Only a manager or the owner can do that.",
  not_owner: "Only the owner can do that.",
  not_staff: "This account isn't set up as staff.",
  not_allowed: "Your account isn't allowed to do that.",
  needs_a_size: "Add at least one size with a price.",
  drink_not_found: "That drink no longer exists. Refresh the page.",
  size_not_found: "One of the sizes changed elsewhere. Refresh the page and try again.",
  drink_has_orders: "This drink has been ordered, so it can't be deleted. Archive it instead (Edit, then Archive drink).",
  drink_in_test_orders: "This drink is in test orders. Delete the test orders first (Venue settings, Test orders), then try again.",
  refunds_not_live: "Card refunds arrive once payments are set up. For now only test orders can be refunded.",
  already_refunded: "This order has already been refunded in full.",
  bad_refund_amount: "That's more than is left to refund on this order.",
  reason_required: "Choose or type a reason.",
  order_not_found: "That order can't be found. Refresh and try again.",
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
