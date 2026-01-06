'use client';

import useSWR from 'swr';

export function useDeviceDetail({ token, viewMode, selectedDevice, isEn, getLastCruise, getBatteryStatusByImei }) {
    const selectedImei = selectedDevice?.imei;

    const { data: cruiseInfo } = useSWR(
        token && viewMode === 'detail' && selectedImei ? ['lastCruise', token, selectedImei] : null,
        ([, tk, imei]) => getLastCruise(tk, imei),
        { revalidateOnFocus: false },
    );

    const { data: batteryRes } = useSWR(
        token && viewMode === 'detail' && selectedImei ? ['battery', token, selectedImei] : null,
        ([, tk, imei]) => getBatteryStatusByImei(tk, imei),
        { revalidateOnFocus: false, refreshInterval: 30_000 },
    );

    const batteryInfo = batteryRes?.batteryStatus || null;

    const isAccOff = (acc) => acc === 1;

    const getEngineStatusText = (cruise) =>
        isAccOff(cruise?.acc) ? (isEn ? 'Engine off' : 'Tắt máy') : isEn ? 'Engine on' : 'Mở máy';

    const getVehicleStatusText = (cruise) => {
        if (isAccOff(cruise?.acc)) return isEn ? 'Parked' : 'Đổ xe';
        if (cruise?.spd !== null && cruise?.spd !== undefined) {
            return isEn ? `Moving ${cruise.spd} km/h` : `Chạy xe ${cruise.spd} km/h`;
        }
        return isEn ? 'Stopped' : 'Dừng xe';
    };

    return { cruiseInfo, batteryInfo, getEngineStatusText, getVehicleStatusText };
}
