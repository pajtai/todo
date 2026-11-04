// Converts between instants and `<input type="datetime-local">` values
// ("YYYY-MM-DDTHH:mm") in a named timezone, independent of the host timezone.

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function wallClockParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return parts as Record<
    "year" | "month" | "day" | "hour" | "minute" | "second",
    string
  >;
}

/** Milliseconds the timezone is ahead of UTC at that instant. */
function offsetAt(instant: Date, timeZone: string) {
  const p = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant as a datetime-local value on the timezone's wall clock. */
export function toLocalInput(instant: Date, timeZone: string) {
  const p = wallClockParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * The instant a datetime-local value names in the timezone, or undefined if
 * the value is malformed. Times skipped by a DST jump resolve forward.
 */
export function fromLocalInput(value: string, timeZone: string) {
  const match = LOCAL_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return undefined;
  }
  // Guess with the offset near the wall time, then retry with the offset at
  // the guess. If neither offset is consistent, the time fell in a DST gap.
  const first = wall - offsetAt(new Date(wall), timeZone);
  const offset = offsetAt(new Date(first), timeZone);
  const second = wall - offset;
  if (offsetAt(new Date(second), timeZone) === offset) {
    return new Date(second);
  }
  return new Date(Math.max(first, second));
}
