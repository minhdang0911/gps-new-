// app/api/geocode/reverse/route.js

import { NextResponse } from 'next/server';
import { isValidGeocodeCoord, normalizeGeocodeLang } from '../../../lib/address/addressCache';
import { resolveOrFetchServerAddress } from '../../../lib/server/addressStore';
import { checkGeocodeRateLimit, isAllowedGeocodeOrigin } from '../../../lib/server/geocodeGuard';

export const runtime = 'nodejs';

async function handleReverse(req, rawParams) {
    if (!isAllowedGeocodeOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const limit = checkGeocodeRateLimit(req);
    if (!limit.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { lat, lon, lang: rawLang, isEn } = rawParams || {};
    if (!isValidGeocodeCoord(lat, lon)) {
        return NextResponse.json({ address: '', deprecatedAddress: '', valid: false }, { status: 400 });
    }

    const lang = normalizeGeocodeLang({ lang: rawLang, isEn });

    try {
        const result = await resolveOrFetchServerAddress(lat, lon, { lang });

        if (!result.configured) {
            return NextResponse.json(
                { configured: false, code: 'DB_UNCONFIGURED' },
                { status: 503 },
            );
        }

        if (!result.data || !result.data.address) {
            return NextResponse.json({
                configured: true,
                address: '',
                deprecatedAddress: '',
                source: 'miss',
            });
        }

        return NextResponse.json({
            configured: true,
            address: result.data.address,
            deprecatedAddress: result.data.deprecatedAddress || '',
            source: result.data.source || 'mongo',
        });
    } catch (err) {
        console.error('[api/geocode/reverse] error:', err?.message || err);
        return NextResponse.json(
            { configured: false, error: 'Geocode lookup failed' },
            { status: 503 },
        );
    }
}

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    return handleReverse(req, {
        lat: searchParams.get('lat'),
        lon: searchParams.get('lon'),
        lang: searchParams.get('lang') || undefined,
        isEn: searchParams.get('isEn') === 'true',
    });
}

export async function POST(req) {
    try {
        const body = await req.json();
        return handleReverse(req, body);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
}

