// lib/address/keys.ts

// Nếu cần thì vẫn export key chính
export const GOONG_API_KEY = process.env.NEXT_PUBLIC_GOONG_API_KEY;

// các token khác
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
export const VIETMAP_TOKEN = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
export const TOMTOM_TOKEN = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
export const TRACKASIA_KEY = process.env.NEXT_PUBLIC_TRACKASIA_API_KEY;
export const OPENCAGE_KEY = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
export const MAP4D_KEY = process.env.NEXT_PUBLIC_MAP4D_API_KEY;

// ===============================
// 🔑 NHIỀU GOONG API KEY + XOAY VÒNG
// ===============================
export const GOONG_KEYS = [
    process.env.NEXT_PUBLIC_GOONG_API_KEY,
    process.env.NEXT_PUBLIC_GOONG_API_KEY1,
    process.env.NEXT_PUBLIC_GOONG_API_KEY3,
    process.env.NEXT_PUBLIC_GOONG_API_KEY4,
    process.env.NEXT_PUBLIC_GOONG_API_KEY5,
    process.env.NEXT_PUBLIC_GOONG_API_KEY6,
    process.env.NEXT_PUBLIC_GOONG_API_KEY7,
    process.env.NEXT_PUBLIC_GOONG_API_KEY8,
].filter(Boolean) as string[];

export const VIETMAP_KEYS = [
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY1,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY2,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY3,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY4,
].filter(Boolean) as string[];

let goongKeyIndex = 0;

export const getCurrentGoongKey = () => {
    if (!GOONG_KEYS.length) return null;
    return GOONG_KEYS[goongKeyIndex % GOONG_KEYS.length];
};

export const moveToNextGoongKey = () => {
    if (!GOONG_KEYS.length) return;
    goongKeyIndex = (goongKeyIndex + 1) % GOONG_KEYS.length;
};
