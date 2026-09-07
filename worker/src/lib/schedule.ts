/**
 * Daylight saving guard.
 *
 * Cron has no concept of a timezone. Every routine here is configured in UTC, and the
 * intent behind every one of them is local: "Posty runs at quarter past eight, before
 * Brian opens the desk." Those agree today and stop agreeing on 1 November, when
 * Eastern moves from UTC-4 to UTC-5.
 *
 * Nothing about that failure is loud. The routine fires, reports success, and covers
 * exactly what it should. It just does it an hour off, which for Posty means drafting
 * before the morning's signals have landed.
 *
 * So the registry stores the intent (`local_time` + `timezone`) next to the fact
 * (`cron_utc`), and this recomputes the correct UTC every cycle. When they diverge,
 * Watchy says so and names the cron that would fix it.
 */

/** Minutes that `timeZone` is ahead of UTC at instant `at`. Negative for the Americas. */
function zoneOffsetMinutes(timeZone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(at);

    const get = (type: string): number => {
      const v = parts.find((p) => p.type === type)?.value;
      return v === undefined ? NaN : Number(v);
    };

    // Read the wall clock in that zone, then reinterpret those numbers as if they were
    // UTC. The gap between that and the real instant is the offset.
    const hour = get("hour") === 24 ? 0 : get("hour"); // en-US can emit 24 at midnight
    const asIfUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      hour,
      get("minute"),
      get("second")
    );
    if (Number.isNaN(asIfUtc)) return null;
    return Math.round((asIfUtc - at.getTime()) / 60000);
  } catch {
    // An unknown zone name is a data problem, not a drift problem. Report nothing rather
    // than guessing, so a typo cannot manufacture a finding.
    return null;
  }
}

/** "HH:MM" to minutes past midnight. */
function parseLocalTime(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minute and hour fields of a 5-part cron, when both are plain numbers. */
function parseCronUtc(cron: string): { minute: number; hour: number } | null {
  const f = cron.trim().split(/\s+/);
  if (f.length < 2) return null;
  const minute = Number(f[0]);
  const hour = Number(f[1]);
  // Only a fixed wall-clock schedule can drift. Anything with a step or a list in the
  // minute or hour field ("*/15", "0,30") has no single intended time, so it is skipped.
  if (!Number.isInteger(minute) || !Number.isInteger(hour)) return null;
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;
  return { minute, hour };
}

export type Drift = {
  intendedLocal: string;
  timezone: string;
  configured: string;
  shouldBe: string;
  detail: string;
};

/**
 * Returns a Drift when the configured cron no longer produces the intended local time,
 * or null when it agrees, cannot be evaluated, or is not a fixed daily/weekly schedule.
 */
export function checkScheduleDrift(
  localTime: string | null,
  timezone: string | null,
  cronUtc: string | null,
  now: Date
): Drift | null {
  if (!localTime || !timezone || !cronUtc) return null;

  const localMinutes = parseLocalTime(localTime);
  const cron = parseCronUtc(cronUtc);
  const offset = zoneOffsetMinutes(timezone, now);
  if (localMinutes === null || cron === null || offset === null) return null;

  // Local wall clock minus the zone's offset gives the UTC minute it fires at today.
  const wantUtc = ((localMinutes - offset) % 1440 + 1440) % 1440;
  const haveUtc = cron.hour * 60 + cron.minute;
  if (wantUtc === haveUtc) return null;

  const wh = String(Math.floor(wantUtc / 60)).padStart(2, "0");
  const wm = String(wantUtc % 60).padStart(2, "0");
  // Preserve the day-of-week and day-of-month fields; only the time is wrong.
  const rest = cronUtc.trim().split(/\s+/).slice(2).join(" ");
  const shouldBe = `${Number(wm)} ${Number(wh)} ${rest}`.trim();

  const driftMin = ((wantUtc - haveUtc) % 1440 + 1440) % 1440;
  const driftHrs = driftMin > 720 ? (driftMin - 1440) / 60 : driftMin / 60;

  return {
    intendedLocal: localTime,
    timezone,
    configured: cronUtc,
    shouldBe,
    detail:
      `Meant to run at ${localTime} ${timezone}, but the configured cron "${cronUtc}" ` +
      `fires at ${String(cron.hour).padStart(2, "0")}:${String(cron.minute).padStart(2, "0")} UTC, ` +
      `which is ${driftHrs > 0 ? "" : "-"}${Math.abs(driftHrs)}h off today. ` +
      `Correct cron is "${shouldBe}".`,
  };
}
