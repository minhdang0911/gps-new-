// lib/address/reverseGeocode.js

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

// ===============================
// 🧠 PICK ĐỊA CHỈ ĐẸP TỪ GOONG
// ===============================
const pickBestGoongV2Address = (results = []) => {
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
// 🔁 GOONG + XOAY KEY
// ===============================
const callGoongWithRotation = async (lat, lon, lang = 'vi') => {
    if (!GOONG_KEYS.length) return null;

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const key = getCurrentGoongKey();
        if (!key) break;

        try {
            const url =
                `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lon}` +
                `&api_key=${key}&limit=2&has_deprecated_administrative_unit=true&language=${lang}`;

            const res = await fetch(url);

            if (res.status === 429 || res.status === 403) {
                moveToNextGoongKey();
                continue;
            }

            if (!res.ok) {
                moveToNextGoongKey();
                continue;
            }

            const data = await res.json();
            const { address, deprecated } = pickBestGoongV2Address(data.results || []);

            if (address) return { address, deprecatedAddress: deprecated || '' };

            moveToNextGoongKey();
        } catch (err) {
            moveToNextGoongKey();
        }
    }

    return null;
};

// ===============================
// 🌐 Fallback Providers
// ===============================
const providerVietMap = async (lat, lon) => {
    for (let i = 0; i < VIETMAP_KEYS.length; i++) {
        try {
            const res = await fetch(`https://api.vnmap.com.vn/geocoding?latlng=${lat},${lon}&key=${VIETMAP_KEYS[i]}`);

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
        const res = await fetch(
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
        const res = await fetch(
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
        const res = await fetch(`https://api.map4d.vn/map/geocode?location=${lat},${lon}&key=${MAP4D_KEY}`);
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
        const res = await fetch(
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
        const res = await fetch(
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
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=${lang}`,
        );
        if (!res.ok) return '';
        const data = await res.json();
        return data?.display_name || '';
    } catch {
        return '';
    }
};

// ===============================
// ⭐ HÀM CHÍNH reverseGeocodeAddress
// ===============================
export const reverseGeocodeAddress = async (lat, lon, opts = {}) => {
    const lang = opts.lang || 'vi';
    const isEn = opts.isEn || false;

    // 1️⃣ Ưu tiên Goong
    const goong = await callGoongWithRotation(lat, lon, lang);
    if (goong) return goong;

    // 2️⃣ Fallback providers
    const providers = [
        () => providerVietMap(lat, lon),
        () => providerTrackAsia(lat, lon),
        () => providerOpenCage(lat, lon, lang),
        () => providerMap4D(lat, lon),
        () => providerTomTom(lat, lon, isEn),
        () => providerMapbox(lat, lon, isEn),
        () => providerNominatim(lat, lon, lang),
    ];

    for (const fn of providers) {
        const addr = await fn();
        if (addr) return { address: addr, deprecatedAddress: '' };
    }

    return null;
};
