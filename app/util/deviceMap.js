// util/deviceMap.js
import { getDevices } from '../lib/api/devices';
import { MAX_DEVICE_LIMIT } from '../lib/constants';

/**
 * Build 2 maps:
 * - imeiToPlate: imei -> license_plate
 * - plateToImeis: license_plate(lowercase) -> [imei, imei, ...]
 */
export const buildImeiToLicensePlateMap = async () => {
    const res = await getDevices({ page: 1, limit: MAX_DEVICE_LIMIT });
    const devices = res?.devices || [];

    const imeiToPlate = new Map();
    const plateToImeis = new Map();

    for (const d of devices) {
        const imei = String(d?.imei || '').trim();
        const plate = String(d?.license_plate || '').trim();
        if (!imei) continue;

        imeiToPlate.set(imei, plate || '');

        const key = plate.toLowerCase(); // normalize
        if (!plateToImeis.has(key)) plateToImeis.set(key, []);
        plateToImeis.get(key).push(imei);
    }

    return { imeiToPlate, plateToImeis };
};

export const attachLicensePlate = (sessions = [], imeiToPlate) => {
    if (!imeiToPlate) return sessions.map((s) => ({ ...s, license_plate: '' }));

    return sessions.map((s) => ({
        ...s,
        license_plate: imeiToPlate.get(String(s?.imei || '').trim()) || '',
    }));
};
