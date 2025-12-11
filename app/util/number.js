// lib/utils/number.js

export function toNumberOrNull(val) {
    if (val == null) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
}
