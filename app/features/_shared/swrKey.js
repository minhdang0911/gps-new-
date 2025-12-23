export function stableStringify(obj) {
    if (!obj) return '';
    const keys = [];
    JSON.stringify(obj, (k, v) => {
        keys.push(k);
        return v;
    });
    keys.sort();
    return JSON.stringify(obj, keys);
}

// ✅ key có userId để tách cache theo tài khoản
export function makeUserKey(userId, prefix, payload) {
    if (!payload) return null;
    return [prefix, userId || 'guest', stableStringify(payload)];
}
