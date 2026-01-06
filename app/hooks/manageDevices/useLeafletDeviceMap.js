'use client';

import { useEffect, useRef, useState } from 'react';

import markerIconStop from '../../assets/marker-red.png';
import markerRun from '../../assets/marker-run.png';
import markerRun50 from '../../assets/marker-run50.png';
import markerRun80 from '../../assets/marker-run80.png';

const pickMarkerAsset = (cruiseInfo) => {
    const accNum = cruiseInfo?.acc == null ? null : Number(cruiseInfo.acc);
    if (accNum === 1) return markerIconStop;

    const spdRaw = cruiseInfo?.spd ?? cruiseInfo?.vgp ?? 0;
    const spdNum = Number(spdRaw);

    if (!Number.isFinite(spdNum) || spdNum <= 0) return markerIconStop;
    if (spdNum >= 80) return markerRun80;
    if (spdNum >= 50) return markerRun50;
    return markerRun;
};

export function useLeafletDeviceMap({
    enabled,
    selectedDevice,
    cruiseInfo,
    batteryInfo,
    markerIconSrc, // giữ để tương thích, không dùng nữa
    t,
    isEn,
    getEngineStatusText,
    getVehicleStatusText,
}) {
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const currentIconSrcRef = useRef('');
    const [LMap, setLMap] = useState(null);

    const destroyMap = () => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
        markerRef.current = null;
        currentIconSrcRef.current = '';
    };

    const makeIcon = (L, asset) =>
        L.icon({
            iconUrl: asset?.src || asset,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
        });

    // ✅ INIT MAP: luôn init khi vào detail / đổi device (không phụ thuộc cruiseInfo)
    useEffect(() => {
        const initMap = async () => {
            if (!enabled || !selectedDevice) return;

            let L = LMap;
            if (!L) {
                const leafletModule = await import('leaflet');
                L = leafletModule.default || leafletModule;
                setLMap(L);
            }
            if (!L) return;

            // nếu map đã tồn tại thì thôi
            if (mapRef.current) return;

            const el = document.getElementById('iky-device-map');
            if (!el) return;

            const lat = Number(cruiseInfo?.lat ?? 10.75);
            const lon = Number(cruiseInfo?.lon ?? 106.6);

            const map = L.map('iky-device-map', {
                center: [lat, lon],
                zoom: 16,
                zoomControl: false,
                attributionControl: false,
            });
            mapRef.current = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

            const asset = pickMarkerAsset(cruiseInfo);
            const iconSrc = asset?.src || asset;
            currentIconSrcRef.current = iconSrc;

            const mk = L.marker([lat, lon], { icon: makeIcon(L, asset) }).addTo(map);
            markerRef.current = mk;

            mk.bindPopup(
                `
                <b>${t.imei}:</b> ${selectedDevice.imei}<br/>
                <b>${t.plate}:</b> ${selectedDevice.license_plate || '-'}<br/>
                <b>${t.deviceType}:</b> ${selectedDevice.device_category_id?.name || '-'}<br/>
                <b>${t.speed}:</b> ${cruiseInfo?.spd ?? 0} km/h<br/>
                <b>${isEn ? 'Engine status' : 'Trạng thái máy'}:</b> ${getEngineStatusText(cruiseInfo)}<br/>
                <b>${isEn ? 'Vehicle status' : 'Trạng thái xe'}:</b> ${getVehicleStatusText(cruiseInfo)}<br/>
                <b>${t.battery}:</b> ${batteryInfo?.soc ?? '--'}%
            `,
            );

            setTimeout(() => map.invalidateSize(), 200);
        };

        // vào detail hoặc đổi xe -> destroy rồi init lại
        destroyMap();
        initMap();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, selectedDevice?._id]);

    // ✅ UPDATE: khi cruiseInfo/batteryInfo về thì update marker + icon + popup
    useEffect(() => {
        if (!enabled) return;
        if (!LMap) return;
        if (!mapRef.current || !markerRef.current) return;

        const map = mapRef.current;
        const mk = markerRef.current;

        const lat = Number(cruiseInfo?.lat);
        const lon = Number(cruiseInfo?.lon);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            mk.setLatLng([lat, lon]);
            map.setView([lat, lon], map.getZoom(), { animate: false });
        }

        const asset = pickMarkerAsset(cruiseInfo);
        const nextIconSrc = asset?.src || asset;

        if (nextIconSrc && nextIconSrc !== currentIconSrcRef.current) {
            currentIconSrcRef.current = nextIconSrc;
            mk.setIcon(makeIcon(LMap, asset));
        }

        mk.setPopupContent(
            `
            <b>${t.imei}:</b> ${selectedDevice?.imei}<br/>
            <b>${t.plate}:</b> ${selectedDevice?.license_plate || '-'}<br/>
            <b>${t.deviceType}:</b> ${selectedDevice?.device_category_id?.name || '-'}<br/>
            <b>${t.speed}:</b> ${cruiseInfo?.spd ?? 0} km/h<br/>
            <b>${isEn ? 'Engine status' : 'Trạng thái máy'}:</b> ${getEngineStatusText(cruiseInfo)}<br/>
            <b>${isEn ? 'Vehicle status' : 'Trạng thái xe'}:</b> ${getVehicleStatusText(cruiseInfo)}<br/>
            <b>${t.battery}:</b> ${batteryInfo?.soc ?? '--'}%
        `,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, LMap, cruiseInfo, batteryInfo, isEn, t, selectedDevice?._id]);

    useEffect(() => () => destroyMap(), []);

    return { destroyMap };
}
