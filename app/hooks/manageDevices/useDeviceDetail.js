'use client';

import useSWR from 'swr';

export function useDeviceDetail({ viewMode, selectedDevice, isEn, getLastCruise, getBatteryStatusByImei }) {

    const selectedImei = selectedDevice?.imei;

    const { data: cruiseInfo, mutate: mutateCruise } = useSWR(
        viewMode === 'detail' && selectedImei ? ['lastCruise', selectedImei] : null,
        ([, imei]) => getLastCruise(imei),
        {
            revalidateOnFocus: false,
            refreshInterval: 30_000,
            dedupingInterval: 10_000,
        },
    );


    const { data: batteryRes } = useSWR(
        viewMode === 'detail' && selectedImei ? ['battery', selectedImei] : null,
        ([, imei]) => getBatteryStatusByImei(imei),
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

    return { cruiseInfo, mutateCruise, batteryInfo, getEngineStatusText, getVehicleStatusText };

}
