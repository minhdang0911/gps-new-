// app/lib/address/providers.js

import {
    GOONG_KEYS,
    VIETMAP_KEYS,
    MAPBOX_TOKEN,
    TOMTOM_TOKEN,
    TRACKASIA_KEY,
    OPENCAGE_KEY,
    MAP4D_KEY,
    getCurrentGoongKey,
    moveToNextGoongKey,
} from './keys';

const PROVIDER_TIMEOUT_MS = 3500;

async function fetchWithTimeout(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
    if (typeof AbortController === 'undefined') {
        return fetch(url, options);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ===============================
// 🧠 PICK ĐỊA CHỈ ĐẸP TỪ GOONG
// ===============================
export const pickBestGoongV2Address = (results = []) => {
    if (!Array.isArray(results) || results.length === 0) {
        return { address: '', deprecated: '' };
    }

    const poi = results.filter((r) => {
        const name = (r.name || '').trim();
        const addr = (r.address || r.formatted_address || '').trim();
        const formatted = (r.formatted_address || '').trim();

        const types = Array.isArray(r.types) ? r.types : [];
        const isHouseNumber = types.includes('house_number');
        const startsWithDigit = /^\d/.test(name);

        return name && !startsWithDigit && name !== addr && name !== formatted && !isHouseNumber;
    });

    const chosen = poi[0] || results[0];

    const name = (chosen.name || '').trim();
    const formatted = (chosen.formatted_address || '').trim();
    const addr = (chosen.address || '').trim();

    let best = '';
    if (formatted) best = formatted;
    else if (name && addr) best = `${name}, ${addr}`;
    else if (addr) best = addr;
    else if (name) best = name;

    return {
        address: best,
        deprecated: chosen.deprecated_description || '',
    };
};

// ===============================
// 🔁 GOONG + XOAY KEY (chỉ xoay khi 401/403/429/5xx hoặc quota error, KHÔNG xoay khi 200 rỗng)
// ===============================
const shouldRotateGoongStatus = (status) =>
    status === 401 || status === 403 || status === 429 || status >= 500;

export const callGoongWithRotation = async (lat, lon, lang = 'vi') => {
    if (!GOONG_KEYS.length) return null;

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const key = getCurrentGoongKey();
        if (!key) break;

        try {
            const url =
                `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lon}` +
                `&api_key=${key}&limit=2&has_deprecated_administrative_unit=true&language=${lang}`;

            const res = await fetchWithTimeout(url);

            if (!res.ok) {
                if (shouldRotateGoongStatus(res.status)) {
                    moveToNextGoongKey();
                    continue;
                }
                return null;
            }

            const data = await res.json();
            if (data?.status === 'OVER_QUERY_LIMIT' || data?.status === 'REQUEST_DENIED') {
                moveToNextGoongKey();
                continue;
            }

            const { address, deprecated } = pickBestGoongV2Address(data.results || []);
            if (address) return { address, deprecatedAddress: deprecated || '' };

            // HTTP 200 nhưng Goong không có dữ liệu cho tọa độ này -> không xoay hết 8 key gây tốn request
            return null;
        } catch {
            moveToNextGoongKey();
        }
    }

    return null;
};

// ===============================
// 🌐 Fallback Providers (đều có timeout tránh treo batch/serverless)
// ===============================
const providerVietMap = async (lat, lon) => {
    for (let i = 0; i < VIETMAP_KEYS.length; i++) {
        try {
            const res = await fetchWithTimeout(
                `https://api.vnmap.com.vn/geocoding?latlng=${lat},${lon}&key=${VIETMAP_KEYS[i]}`,
            );
            if (!res.ok) continue;

            const data = await res.json();
            const addr = data?.results?.[0]?.formatted_address;
            if (addr) return addr;
        } catch {}
    }
    return '';
};

const providerTrackAsia = async (lat, lon) => {
    if (!TRACKASIA_KEY) return '';
    try {
        const res = await fetchWithTimeout(
            `https://maps.track-asia.com/api/v2/geocode/json?latlng=${lat},${lon}&key=${TRACKASIA_KEY}`,
        );
        if (!res.ok) return '';

        const data = await res.json();
        return data?.results?.[0]?.formatted_address || '';
    } catch {
        return '';
    }
};

const providerOpenCage = async (lat, lon, lang) => {
    if (!OPENCAGE_KEY) return '';
    try {
        const res = await fetchWithTimeout(
            `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_KEY}&language=${lang}`,
        );
        if (!res.ok) return '';

        const data = await res.json();
        return data?.results?.[0]?.formatted || '';
    } catch {
        return '';
    }
};

const providerMap4D = async (lat, lon) => {
    if (!MAP4D_KEY) return '';
    try {
        const res = await fetchWithTimeout(
            `https://api.map4d.vn/map/geocode?location=${lat},${lon}&key=${MAP4D_KEY}`,
        );
        if (!res.ok) return '';

        const data = await res.json();
        return data?.result?.[0]?.formattedAddress || data?.result?.[0]?.address || '';
    } catch {
        return '';
    }
};

const providerTomTom = async (lat, lon, isEn) => {
    if (!TOMTOM_TOKEN) return '';
    try {
        const res = await fetchWithTimeout(
            `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${TOMTOM_TOKEN}&language=${
                isEn ? 'en-US' : 'vi-VN'
            }`,
        );
        if (!res.ok) return '';

        const data = await res.json();
        return data?.addresses?.[0]?.address?.freeformAddress || '';
    } catch {
        return '';
    }
};

const providerMapbox = async (lat, lon, isEn) => {
    if (!MAPBOX_TOKEN) return '';
    try {
        const res = await fetchWithTimeout(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_TOKEN}&language=${
                isEn ? 'en' : 'vi'
            }&limit=1`,
        );
        if (!res.ok) return '';

        const data = await res.json();
        return data?.features?.[0]?.place_name || '';
    } catch {
        return '';
    }
};

const providerNominatim = async (lat, lon, lang) => {
    try {
        const isServer = typeof window === 'undefined';
        const res = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=${lang}`,
            isServer ? { headers: { 'User-Agent': 'IKY-GPS-Portal/1.0' } } : undefined,
        );
        if (!res.ok) return '';
        const data = await res.json();
        return data?.display_name || '';
    } catch {
        return '';
    }
};

/**
 * Gọi trực tiếp Goong + 2 batch fallback providers (dùng chung cho cả Next API server & fallback client).
 */
export async function fetchAddressFromProviders(latNum, lonNum, lang = 'vi') {
    const isEn = lang === 'en';

    const goong = await callGoongWithRotation(latNum, lonNum, lang);
    if (goong) return goong;

    const batch1 = [
        () => providerVietMap(latNum, lonNum),
        () => providerTrackAsia(latNum, lonNum),
    ];
    const batch2 = [
        () => providerOpenCage(latNum, lonNum, lang),
        () => providerMap4D(latNum, lonNum),
        () => providerTomTom(latNum, lonNum, isEn),
        () => providerMapbox(latNum, lonNum, isEn),
        () => providerNominatim(latNum, lonNum, lang),
    ];

    const tryBatch = async (batch) => {
        try {
            const addr = await Promise.any(
                batch.map((fn) =>
                    fn().then((result) => {
                        if (!result) return Promise.reject(new Error('empty'));
                        return result;
                    }),
                ),
            );
            return addr;
        } catch {
            return null;
        }
    };

    const result1 = await tryBatch(batch1);
    if (result1) return { address: result1, deprecatedAddress: '' };

    const result2 = await tryBatch(batch2);
    if (result2) return { address: result2, deprecatedAddress: '' };

    return null;
}
