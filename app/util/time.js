// lib/utils/time.js

// parse tim (YYMMDDHHmmSS)
export function parseTimToDate(tim) {
    if (!tim) return null;

    const s = String(tim);
    if (s.length !== 12) return null;

    const yy = s.slice(0, 2);
    const MM = s.slice(2, 4);
    const dd = s.slice(4, 6);
    const hh = s.slice(6, 8);
    const mm = s.slice(8, 10);
    const ss = s.slice(10, 12);

    const yyyy = 2000 + Number(yy);

    const date = new Date(`${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`);

    if (isNaN(date.getTime())) return null;
    return date;
}

// format datetime-local input
export function toLocalDateTimeInput(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        'T' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes())
    );
}
