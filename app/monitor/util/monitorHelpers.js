import markerIconStop from '../../assets/marker-red.webp';
import markerRun from '../../assets/marker-run.webp';
import markerRun50 from '../../assets/marker-run50.webp';
import markerRun80 from '../../assets/marker-run80.webp';
import { toNumberOrNull } from '../../util/number';

const SOC_BY_IMEI_KEY = 'iky_monitor_soc_by_imei_v2';
const SOC_TTL_MS = 24 * 60 * 60 * 1000;
const MQTT_SILENCE_MS = 60_000;

export const loadSocCache = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(SOC_BY_IMEI_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        if (!obj || typeof obj !== 'object') return {};

        const now = Date.now();
        const result = {};
        for (const [imei, entry] of Object.entries(obj)) {
            if (typeof entry === 'number') {
                result[imei] = entry;
            } else if (entry && typeof entry === 'object' && entry.ts) {
                if (now - entry.ts < SOC_TTL_MS) {
                    result[imei] = entry.soc;
                }
            }
        }
        return result;
    } catch {
        return {};
    }
};

export const saveSocCache = (socMap) => {
    if (typeof window === 'undefined') return;
    try {
        const now = Date.now();
        const stored = {};
        for (const [imei, soc] of Object.entries(socMap)) {
            stored[imei] = { soc, ts: now };
        }
        localStorage.setItem(SOC_BY_IMEI_KEY, JSON.stringify(stored));
    } catch {}
};

export const getDriverName = (d) => {
    const raw = d?.driver;
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s || '';
};

export const clampSoc = (soc) => {
    const n = toNumberOrNull(soc);
    if (n == null) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
};

export const isMqttAlive = (lastMqttAtRef) => {
    const last = lastMqttAtRef.current;
    return !!last && Date.now() - last < MQTT_SILENCE_MS;
};

export const pickField = (field, { liveTelemetry, lastCruise, batteryStatus }, lastMqttAtRef) => {
    if (isMqttAlive(lastMqttAtRef)) return liveTelemetry?.[field];
    return lastCruise?.[field] ?? batteryStatus?.[field];
};

export const pickAcc = ({ liveTelemetry, lastCruise }, lastMqttAtRef) => {
    if (isMqttAlive(lastMqttAtRef)) return liveTelemetry?.acc;
    return lastCruise?.acc;
};

export const pickSpeed = ({ liveTelemetry, lastCruise }, lastMqttAtRef) => {
    if (isMqttAlive(lastMqttAtRef)) {
        return liveTelemetry?.vlp ?? liveTelemetry?.spd ?? liveTelemetry?.vgp;
    }
    return lastCruise?.vlp ?? lastCruise?.spd ?? lastCruise?.vgp;
};

export const pickBikeState = ({ liveTelemetry, lastCruise }, lastMqttAtRef) => {
    if (isMqttAlive(lastMqttAtRef)) {
        return liveTelemetry?.onl ?? liveTelemetry?.ste ?? liveTelemetry?.state ?? liveTelemetry?.sta;
    }
    return lastCruise?.onl ?? lastCruise?.ste ?? lastCruise?.state ?? lastCruise?.sta;
};

export const getMarkerAssetByStatus = ({ accValNum, usedSpeed, datBikeState }) => {
    if (datBikeState) {
        if (!datBikeState.isEngineOn || !datBikeState.isMoving) return markerIconStop;
        const spd = Number(usedSpeed ?? 0);
        if (!Number.isFinite(spd) || spd <= 0) return markerIconStop;
        if (spd >= 80) return markerRun80;
        if (spd >= 50) return markerRun50;
        return markerRun;
    }

    if (accValNum === 1) return markerIconStop;

    const spd = Number(usedSpeed ?? 0);
    if (!Number.isFinite(spd) || spd <= 0) return markerIconStop;

    if (spd >= 80) return markerRun80;
    if (spd >= 50) return markerRun50;
    return markerRun;
};
