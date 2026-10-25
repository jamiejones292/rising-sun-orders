import type { OpeningHours } from "./types";

// Ordering hours are in the pub's local time (Europe/London), whatever the
// phone's own timezone. A closing time earlier than the opening time means the
// pub stays open past midnight.

function londonNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (t: string) => t.slice(0, 5);

export type OrderingWindow =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string | null; today: boolean };

export function orderingWindow(hours: OpeningHours[], date = new Date()): OrderingWindow {
  const { weekday, minutes } = londonNow(date);
  const today = hours.find((h) => h.weekday === weekday);
  const yesterday = hours.find((h) => h.weekday === (weekday === 1 ? 7 : weekday - 1));

  // Still open from yesterday's late night?
  if (yesterday && !yesterday.closed && toMin(yesterday.closes_at) < toMin(yesterday.opens_at) && minutes < toMin(yesterday.closes_at)) {
    return { open: true, closesAt: hhmm(yesterday.closes_at) };
  }
  if (today && !today.closed) {
    const o = toMin(today.opens_at);
    const c = toMin(today.closes_at);
    const overnight = c < o;
    if (minutes >= o && (overnight || minutes < c)) return { open: true, closesAt: hhmm(today.closes_at) };
    if (minutes < o) return { open: false, opensAt: hhmm(today.opens_at), today: true };
  }
  // Closed for the rest of today: find the next opening day.
  for (let i = 1; i <= 7; i++) {
    const day = ((weekday - 1 + i) % 7) + 1;
    const h = hours.find((x) => x.weekday === day);
    if (h && !h.closed) return { open: false, opensAt: hhmm(h.opens_at), today: false };
  }
  return { open: false, opensAt: null, today: false };
}
