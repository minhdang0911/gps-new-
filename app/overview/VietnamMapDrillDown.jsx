/**
 * @file VietnamMapDrillDown.jsx
 * @description Component bản đồ phân cấp hành chính 3 tầng (Cả nước -> Tỉnh -> Quận -> Xe).
 * Tích hợp IKY-SpatialCore Engine cho tốc độ phản hồi < 1ms, zero-jank.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLeafletOverviewMap } from './hooks/useLeafletOverviewMap';
import { useProvinceDevices } from './hooks/useProvinceDevices';
import { useSpatialDistrict } from '../lib/spatial/useSpatialDistrict';
import DevicePopup from './components/DevicePopup';
import MapLegend from './components/MapLegend';
import ZoneStatsPanel from './components/ZoneStatsPanel';
import { MapBreadcrumb, ZoomControl, ResetViewBtn } from './components/MapControls';
import {
    drawProvinceClusters,
    drawDistrictClusters,
    drawIndividualDevicePins,
} from './components/MapPinDrawer';

export default function VietnamMapDrillDown({
    devices = [],
    cruiseByImei = {},
    height = 580,
    forceAllDevices = false,
    highlightDevice = null,
    onDrillChange = null,
}) {
    const mapContainerRef = useRef(null);
    const {
        L, leafletMap, markersLayer, isMobile, showTileLayer, hideTileLayer, fitToVietnam, focusProvince,
    } = useLeafletOverviewMap(mapContainerRef);

    const { provinces, provinceGroups } = useProvinceDevices(devices, cruiseByImei);
    const { initSpatialIndex, groupProvinceVehicles } = useSpatialDistrict();
    const lastFittedProvinceIdRef = useRef(null);

    const [level, setLevel] = useState('province');
    const [selectedProvince, setSelectedProvince] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [popupDevice, setPopupDevice] = useState(null);
    const [popupCruise, setPopupCruise] = useState(null);

    // Gom nhóm xe theo quận huyện (Level 1) dùng IKY-SpatialCore
    const districtGroups = useMemo(() => {
        if (!selectedProvince || !devices.length) return {};
        const provDevices = provinceGroups[selectedProvince.id]?.items?.map((x) => x.device) || [];
        return groupProvinceVehicles(provDevices, cruiseByImei, selectedProvince.id);
    }, [selectedProvince, provinceGroups, devices, cruiseByImei, groupProvinceVehicles]);

    // Các xe trong quận được chọn (Level 2)
    const activeDistrictDevices = useMemo(() => {
        if (!selectedDistrict || !selectedProvince) return [];
        const districtKey = String(
            selectedDistrict.id || selectedDistrict.properties?.ma_huyen || ''
        );
        const group = districtGroups[districtKey];
        return group && Array.isArray(group.items) ? group.items.map((x) => x.device) : [];
    }, [selectedDistrict, selectedProvince, districtGroups]);

    // Báo ra ngoài component cha khi drill thay đổi
    useEffect(() => {
        if (!onDrillChange) return;
        if (level === 'province') onDrillChange(null);
        else if (level === 'district') onDrillChange(provinceGroups[selectedProvince?.id]?.items?.map((x) => x.device) || []);
        else if (level === 'device') onDrillChange(activeDistrictDevices);
    }, [level, selectedProvince, selectedDistrict, onDrillChange, provinceGroups, activeDistrictDevices]);

    // Helper căn chỉnh góc nhìn tập trung sâu vào khu vực tỉnh & cụm quận
    const focusProvinceView = useCallback((prov, clusterBounds = null) => {
        if (!leafletMap || !prov) return;
        focusProvince?.(prov);
        lastFittedProvinceIdRef.current = prov.id;
        const padLeft = isMobile ? 20 : 280;

        if (clusterBounds && clusterBounds.length > 1) {
            try {
                leafletMap.fitBounds(clusterBounds, {
                    paddingTopLeft: [padLeft, 40],
                    paddingBottomRight: [40, 40],
                    maxZoom: 13,
                    animate: true,
                });
                return;
            } catch (_) {}
        }
        if (clusterBounds && clusterBounds.length === 1) {
            leafletMap.setView(clusterBounds[0], 12.5, { animate: true });
            return;
        }

        const lat = parseFloat(prov.latitude), lon = parseFloat(prov.longitude);
        if (!isNaN(lat) && !isNaN(lon)) leafletMap.setView([lat, lon], 11.5, { animate: true });
    }, [leafletMap, focusProvince, isMobile]);

    // Handler chọn Tỉnh: Focus ngay lập tức vào tỉnh đã chọn (zoom 11.5)
    const handleSelectProvince = useCallback((province, coords) => {
        setSelectedProvince(province);
        setSelectedDistrict(null);
        setPopupDevice(null);
        showTileLayer();
        initSpatialIndex();
        setLevel('district');
        const lat = parseFloat(coords?.[0] || province?.latitude);
        const lon = parseFloat(coords?.[1] || province?.longitude);
        focusProvinceView(province);
        if (!isNaN(lat) && !isNaN(lon) && leafletMap) {
            leafletMap.setView([lat, lon], 11.5, { animate: true });
        }
    }, [showTileLayer, initSpatialIndex, focusProvinceView, leafletMap]);

    // Handler chọn Quận: Focus sâu vào quận chi tiết (zoom 13.5)
    const handleSelectDistrict = useCallback((district, [lat, lon]) => {
        setSelectedDistrict(district);
        setPopupDevice(null);
        leafletMap?.setView([lat, lon], 13.5, { animate: true });
        setLevel('device');
    }, [leafletMap]);

    // Quay lại xem toàn tỉnh từ level xe
    const handleBackToProvince = useCallback(() => {
        setLevel('district');
        setSelectedDistrict(null);
        setPopupDevice(null);
        focusProvinceView(selectedProvince);
    }, [selectedProvince, focusProvinceView]);

    // Về toàn quốc
    const handleGoRoot = useCallback(() => {
        lastFittedProvinceIdRef.current = null;
        setLevel('province');
        setSelectedProvince(null);
        setSelectedDistrict(null);
        setPopupDevice(null);
        hideTileLayer();
        fitToVietnam();
    }, [hideTileLayer, fitToVietnam]);

    // Vẽ markers theo từng level và tự động fitBounds tập trung góc nhìn (focus)
    useEffect(() => {
        if (!L || !markersLayer) return;
        if (forceAllDevices) {
            showTileLayer();
            const bounds = drawIndividualDevicePins(L, markersLayer, devices, cruiseByImei, (d, c) => {
                setPopupDevice(d); setPopupCruise(c);
            });
            if (bounds.length && leafletMap) {
                try { leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 18, animate: true }); } catch {}
            }
            return;
        }

        if (level === 'province') {
            drawProvinceClusters(L, markersLayer, provinceGroups, handleSelectProvince);
        } else if (level === 'district') {
            const bounds = drawDistrictClusters(L, markersLayer, districtGroups, handleSelectDistrict);
            if (selectedProvince && lastFittedProvinceIdRef.current !== selectedProvince.id) {
                focusProvinceView(selectedProvince, bounds);
            }
        } else if (level === 'device') {
            drawIndividualDevicePins(L, markersLayer, activeDistrictDevices, cruiseByImei, (d, c) => {
                setPopupDevice(d); setPopupCruise(c);
            });
        }
    }, [L, markersLayer, level, selectedProvince, provinceGroups, districtGroups, activeDistrictDevices, forceAllDevices, devices, cruiseByImei, handleSelectProvince, handleSelectDistrict, showTileLayer, leafletMap, focusProvinceView]);

    // Xử lý Highlight Device từ ô tìm kiếm
    useEffect(() => {
        if (!highlightDevice || !L || !leafletMap) return;
        const cruise = cruiseByImei[highlightDevice.imei];
        if (cruise?.lat && cruise?.lon) {
            leafletMap.setView([cruise.lat, cruise.lon], 16, { animate: true });
            showTileLayer();
        }
        setPopupDevice(highlightDevice);
        setPopupCruise(cruise || null);
    }, [highlightDevice, L, leafletMap, cruiseByImei, showTileLayer]);

    // Dữ liệu bảng thống kê vùng
    const zoneStats = useMemo(() => {
        if (level === 'province') {
            return Object.values(provinceGroups).map(({ province, items }) => ({
                id: province.id, name: province.full_name, total: items.length,
                online: items.filter((i) => i.cruise?.acc !== 1).length,
                offline: items.filter((i) => i.cruise?.acc === 1).length,
            }));
        }
        return Object.values(districtGroups).map(({ district, items }) => ({
            id: district.id || district.properties?.ma_huyen,
            name: district.name || district.properties?.ten_huyen || 'Quận',
            total: items.length,
            online: items.filter((i) => i.cruise?.acc !== 1).length,
            offline: items.filter((i) => i.cruise?.acc === 1).length,
        }));
    }, [level, provinceGroups, districtGroups]);

    return (
        <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            <MapBreadcrumb
                province={selectedProvince}
                district={selectedDistrict}
                onClickRoot={handleGoRoot}
                onClickProvince={handleBackToProvince}
            />

            <ZoomControl mapRef={{ current: leafletMap }} />
            <ResetViewBtn onClick={handleGoRoot} />
            <MapLegend level={level} isMobile={isMobile} />

            <ZoneStatsPanel
                zones={zoneStats} level={level}
                provinceName={selectedProvince?.full_name}
                selectedId={selectedDistrict?.id}
                onClickZone={(z) => {
                    if (level === 'province') {
                        const prov = provinces.find((p) => p.id === z.id);
                        if (prov) handleSelectProvince(prov, [parseFloat(prov.latitude), parseFloat(prov.longitude)]);
                    } else if (level === 'district') {
                        const group = districtGroups[z.id];
                        const dist = group?.districtInfo || group?.district;
                        if (dist && group?.items?.length) {
                            let lat = dist.centroid?.latitude ?? group.items[0]?.cruise?.lat;
                            let lon = dist.centroid?.longitude ?? group.items[0]?.cruise?.lon;
                            if (lat != null && lon != null) handleSelectDistrict(dist, [lat, lon]);
                        }
                    }
                }}
                onGoRoot={handleGoRoot}
                onGoProvince={handleBackToProvince}
                isMobile={isMobile}
            />

            {popupDevice && (
                <DevicePopup
                    device={popupDevice}
                    cruise={popupCruise}
                    onClose={() => { setPopupDevice(null); setPopupCruise(null); }}
                />
            )}
        </div>
    );
}
