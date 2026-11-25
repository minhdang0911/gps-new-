// lib/address/keys.ts

export const GOONG_API_KEY = process.env.NEXT_PUBLIC_GOONG_API_KEY;

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
export const VIETMAP_TOKEN = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
export const TOMTOM_TOKEN = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
export const TRACKASIA_KEY = process.env.NEXT_PUBLIC_TRACKASIA_API_KEY;
export const OPENCAGE_KEY = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY;
export const MAP4D_KEY = process.env.NEXT_PUBLIC_MAP4D_API_KEY;

// Danh sách các Goong keys từ env
export const GOONG_KEYS = [
    process.env.NEXT_PUBLIC_GOONG_API_KEY1,
    process.env.NEXT_PUBLIC_GOONG_API_KEY8,
    process.env.NEXT_PUBLIC_GOONG_API_KEY5,
    process.env.NEXT_PUBLIC_GOONG_API_KEY7,
    process.env.NEXT_PUBLIC_GOONG_API_KEY4,
    process.env.NEXT_PUBLIC_GOONG_API_KEY,
    process.env.NEXT_PUBLIC_GOONG_API_KEY3,
    process.env.NEXT_PUBLIC_GOONG_API_KEY6,
].filter(Boolean) as string[];

export const VIETMAP_KEYS = [
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY1,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY2,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY3,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY4,
].filter(Boolean) as string[];

let goongKeyIndex = 0;
const deadGoongKeys = new Set<string>();

export const markGoongKeyDead = (key?: string | null) => {
    if (key) deadGoongKeys.add(key);
};

export const getActiveGoongKeys = () => {
    return GOONG_KEYS.filter((k) => !deadGoongKeys.has(k));
};

export const getCurrentGoongKey = () => {
    const active = getActiveGoongKeys();
    if (!active.length) return null;
    return active[goongKeyIndex % active.length];
};

export const moveToNextGoongKey = () => {
    const active = getActiveGoongKeys();
    if (!active.length) return;
    goongKeyIndex = (goongKeyIndex + 1) % active.length;
};
