// util/time.js

// =========================
// Helpers
// =========================
const pad2 = (n) => String(n).padStart(2, '0');

const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

/**
 * Build Date in LOCAL timezone safely (no locale parsing).
 * NOTE: month is 1-based when passing to this function.
 */
const makeLocalDate = (year, month1, day, hour, minute, second) => {
    return new Date(year, month1 - 1, day, hour, minute, second, 0);
};

// =========================
// Parse tim (YYMMDDHHmmSS)
// =========================
/**
 * Parse device tim format: YYMMDDHHmmSS (12 chars)
 * Example: "260227130937" -> Date(2026-02-27 13:09:37 local)
 */
export function parseTimToDate(tim) {
    if (tim == null) return null;

    const s = String(tim).trim();
    if (s.length !== 12) return null;
    if (!/^\d{12}$/.test(s)) return null;

    const yy = Number(s.slice(0, 2));
    const MM = Number(s.slice(2, 4));
    const dd = Number(s.slice(4, 6));
    const hh = Number(s.slice(6, 8));
    const mm = Number(s.slice(8, 10));
    const ss = Number(s.slice(10, 12));

    const yyyy = 2000 + yy;

    // Basic range validation (avoid weird Date auto-rollover)
    if (MM < 1 || MM > 12) return null;
    if (dd < 1 || dd > 31) return null;
    if (hh < 0 || hh > 23) return null;
    if (mm < 0 || mm > 59) return null;
    if (ss < 0 || ss > 59) return null;

    const date = makeLocalDate(yyyy, MM, dd, hh, mm, ss);

    // Ensure no rollover happened (e.g., 2026-02-31 => March 3)
    if (
        date.getFullYear() !== yyyy ||
        date.getMonth() !== MM - 1 ||
        date.getDate() !== dd ||
        date.getHours() !== hh ||
        date.getMinutes() !== mm ||
        date.getSeconds() !== ss
    ) {
        return null;
    }

    return date;
}

// =========================
// Formatting
// =========================

/**
 * ✅ Fixed format: "HH:mm:ss dd/MM/yyyy"
 * Always the same across Chrome/Edge/Firefox.
 */
export function formatFixedDateTime(date) {
    if (!isValidDate(date)) return '';

    const hh = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());
    const dd = pad2(date.getDate());
    const MM = pad2(date.getMonth() + 1);
    const yyyy = date.getFullYear();

    return `${hh}:${mi}:${ss} ${dd}/${MM}/${yyyy}`;
}

/**
 * Optional: fixed date only "dd/MM/yyyy"
 */
export function formatFixedDate(date) {
    if (!isValidDate(date)) return '';

    const dd = pad2(date.getDate());
    const MM = pad2(date.getMonth() + 1);
    const yyyy = date.getFullYear();

    return `${dd}/${MM}/${yyyy}`;
}

// =========================
// datetime-local input
// =========================

/**
 * Format Date -> value for <input type="datetime-local" />
 * "YYYY-MM-DDTHH:mm" (local)
 */
export function toLocalDateTimeInput(date) {
    if (!isValidDate(date)) return '';

    return (
        date.getFullYear() +
        '-' +
        pad2(date.getMonth() + 1) +
        '-' +
        pad2(date.getDate()) +
        'T' +
        pad2(date.getHours()) +
        ':' +
        pad2(date.getMinutes())
    );
}
