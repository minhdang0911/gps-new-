// app/api/geocode/batch/route.js

import { NextResponse } from 'next/server';
import { resolveBatchServerAddresses } from '../../../lib/server/addressStore';
import { checkGeocodeRateLimit, isAllowedGeocodeOrigin } from '../../../lib/server/geocodeGuard';

export const runtime = 'nodejs';

const MAX_BATCH_ITEMS = 30;

export async function POST(req) {
    if (!isAllowedGeocodeOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const limit = checkGeocodeRateLimit(req);
    if (!limit.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const rawItems = Array.isArray(body?.items) ? body.items.slice(0, MAX_BATCH_ITEMS) : [];
    const resolveMissing = body?.resolveMissing !== false;
    if (rawItems.length === 0) {
        return NextResponse.json({ configured: true, results: {} });
    }

    try {
        const result = await resolveBatchServerAddresses(rawItems, { resolveMissing });
        if (!result.configured) {
            return NextResponse.json(
                { configured: false, code: 'DB_UNCONFIGURED', results: {} },
                { status: 503 },
            );
        }

        return NextResponse.json({
            configured: true,
            results: result.results || {},
        });
    } catch (err) {
        console.error('[api/geocode/batch] error:', err?.message || err);
        return NextResponse.json(
            { configured: false, error: 'Batch geocode failed', results: {} },
            { status: 503 },
        );
    }
}

