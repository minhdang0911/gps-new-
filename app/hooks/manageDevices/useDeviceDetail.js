'use client';

import useSWR from 'swr';

import { isDatBikeDevice, getDatBikeStateInfo } from '../../util/cruiseUtils';

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

    const getEngineStatusText = (cruise) => {
        const isDatBike = isDatBikeDevice(selectedDevice);
        const rawState = cruise?.onl ?? cruise?.ste ?? cruise?.state ?? cruise?.sta;
        const datBikeState = (isDatBike || rawState != null) ? getDatBikeStateInfo(rawState, isEn) : null;
        if (datBikeState) {
            return datBikeState.isEngineOn ? (isEn ? 'Engine on' : 'Mở máy') : (isEn ? 'Engine off' : 'Tắt máy');
        }
        return isAccOff(cruise?.acc) ? (isEn ? 'Engine off' : 'Tắt máy') : isEn ? 'Engine on' : 'Mở máy';
    };

    const getVehicleStatusText = (cruise) => {
        const isDatBike = isDatBikeDevice(selectedDevice);
        const rawState = cruise?.onl ?? cruise?.ste ?? cruise?.state ?? cruise?.sta;
        const datBikeState = (isDatBike || rawState != null) ? getDatBikeStateInfo(rawState, isEn) : null;
        if (datBikeState) {
            return datBikeState.label;
        }
        if (isAccOff(cruise?.acc)) return isEn ? 'Parked' : 'Đỗ xe';
        const spd = cruise?.spd ?? cruise?.vlp ?? cruise?.vgp;
        if (spd !== null && spd !== undefined && Number(spd) > 0) {
            return isEn ? `Moving ${spd} km/h` : `Chạy xe ${spd} km/h`;
        }
        return isEn ? 'Stopped' : 'Dừng xe';
    };

    return { cruiseInfo, mutateCruise, batteryInfo, getEngineStatusText, getVehicleStatusText };

}
