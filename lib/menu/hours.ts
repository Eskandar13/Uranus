import type { DayHours, DayKey, OpeningHours } from "@/lib/data/types";

/** JS getDay() order (0 = Sunday). */
const JS_DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Weekday (0 = Sunday) and minutes since midnight of `now` in the restaurant's IANA time zone,
 * so "open now" is right even when the guest's phone is set to another zone.
 * Falls back to the device clock when the zone is missing or invalid.
 */
export function zonedClock(now: Date, timeZone?: string | null): { day: number; minutes: number } {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
      const day = WEEKDAY_SHORT.indexOf(get("weekday"));
      const h = Number.parseInt(get("hour"), 10) % 24;
      const m = Number.parseInt(get("minute"), 10);
      if (day >= 0 && Number.isFinite(h) && Number.isFinite(m)) return { day, minutes: h * 60 + m };
    } catch {
      // Invalid zone name: use the device clock below.
    }
  }
  return { day: now.getDay(), minutes: now.getHours() * 60 + now.getMinutes() };
}

export function dayKeyOf(date: Date, timeZone?: string | null): DayKey {
  return JS_DAYS[zonedClock(date, timeZone).day];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number.parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function isOpenDay(d: DayHours | undefined): d is DayHours {
  return Boolean(d && !d.closed && d.open && d.close);
}

export type OpenStatus =
  | { open: true; closesAt: string | null }
  | { open: false; opensAt: string | null; opensDay: DayKey | null; today: boolean };

/** Open/closed right now (computed on the client after mount). null when no hours are set. */
export function getOpenStatus(hours: OpeningHours, now: Date, timeZone?: string | null): OpenStatus | null {
  const keys = Object.keys(hours ?? {}) as DayKey[];
  if (keys.length === 0 || !keys.some((k) => isOpenDay(hours[k]))) return null;

  const { day: todayIdx, minutes } = zonedClock(now, timeZone);
  const today = hours[JS_DAYS[todayIdx]];
  const yesterday = hours[JS_DAYS[(todayIdx + 6) % 7]];

  // Still open from the previous day's late shift (closes after midnight)?
  if (isOpenDay(yesterday)) {
    const o = toMinutes(yesterday.open);
    const c = toMinutes(yesterday.close);
    if (c < o && minutes < c) return { open: true, closesAt: yesterday.close };
  }
  if (isOpenDay(today)) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    if (o === c) return { open: true, closesAt: null };
    if (o < c && minutes >= o && minutes < c) return { open: true, closesAt: today.close };
    if (c < o && minutes >= o) return { open: true, closesAt: today.close };
    if (minutes < o) return { open: false, opensAt: today.open, opensDay: JS_DAYS[todayIdx], today: true };
  }
  for (let i = 1; i <= 7; i++) {
    const key = JS_DAYS[(todayIdx + i) % 7];
    const d = hours[key];
    if (isOpenDay(d)) return { open: false, opensAt: d.open, opensDay: key, today: false };
  }
  return { open: false, opensAt: null, opensDay: null, today: false };
}
