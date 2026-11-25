// app/api/geocode/reverse/route.js

import { NextResponse } from 'next/server';
import { isValidGeocodeCoord, normalizeGeocodeLang } from '../../../lib/address/addressCache';
import { resolveOrFetchServerAddress, saveAddressToMongo } from '../../../lib/server/addressStore';
import { getAddressCollection } from '../../../lib/server/mongodb';
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

    const { lat, lon, lang: rawLang, isEn, address: clientAddress, deprecatedAddress: clientDeprecated } = rawParams || {};
    if (!isValidGeocodeCoord(lat, lon)) {
        return NextResponse.json({ address: '', deprecatedAddress: '', valid: false }, { status: 400 });
    }

    const lang = normalizeGeocodeLang({ lang: rawLang, isEn });

    if (clientAddress && typeof clientAddress === 'string') {
        try {
            const collection = await getAddressCollection();
            if (collection) {
                await saveAddressToMongo(collection, {
                    latNum: Number(lat),
                    lonNum: Number(lon),
                    lang,
                    address: clientAddress,
                    deprecatedAddress: clientDeprecated || '',
                });
            }
            return NextResponse.json({ configured: true, address: clientAddress, source: 'client-sync' });
        } catch {
            return NextResponse.json({ configured: false, source: 'error' }, { status: 500 });
        }
    }

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

