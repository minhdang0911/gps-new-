// app/lib/server/geocodeGuard.js

const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 180;
const MAX_IP_ENTRIES = 5000;

const ipWindowMap = new Map();

export function isAllowedGeocodeOrigin(req) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');

    if (!origin || !host) return true;

    try {
        const originUrl = new URL(origin);
        return originUrl.host === host;
    } catch {
        return false;
    }
}

export function checkGeocodeRateLimit(req) {
    const forwardedFor = req.headers.get('x-forwarded-for') || '';
    const ip = forwardedFor.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
    const now = Date.now();

    const record = ipWindowMap.get(ip);
    if (!record || now > record.resetAt) {
        if (ipWindowMap.size >= MAX_IP_ENTRIES) {
            const oldest = ipWindowMap.keys().next().value;
            if (oldest) ipWindowMap.delete(oldest);
        }
        ipWindowMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return { allowed: true };
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, retryAfterMs: record.resetAt - now };
    }

    record.count += 1;
    return { allowed: true };
}

