/**
 * @file useOverviewData.js
 * @description Hook quản trị dữ liệu, bộ lọc phân cấp và trạng thái thời gian thực cho trang Overview.
 */

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getDevices } from '../../lib/api/devices';
import { getCachedDevices, setCachedDevices } from '../../util/deviceCache';
import api from '../../lib/api/axios';
import { useAuthStore } from '../../stores/authStore';
import { findNearest } from '../../util/geo';
import { findDistrictForPoint } from '../../util/geoDistrict';
import { exportOverviewExcel } from '../useOverviewExcel';
import {
    MAX_DEVICE_LIMIT,
    ONLINE_THRESHOLD_MS,
    EXPIRING_THRESHOLD_MS,
    OVERVIEW_AUTO_REFRESH_MS,
} from '../../lib/constants';

const PROVINCE_API = 'https://esgoo.net/api-tinhthanh/1/0.htm';

const isExpiringSoon = (device) => {
    if (!device?.date_exp) return false;
    const diff = new Date(device.date_exp).getTime() - Date.now();
    return diff > 0 && diff <= EXPIRING_THRESHOLD_MS;
};

export function useOverviewData() {
    const [devices, setDevices] = useState(() => getCachedDevices());
    const [cruiseByImei, setCruiseByImei] = useState({});
    const [provinces, setProvinces] = useState([]);
    const [loading, setLoading] = useState(() => getCachedDevices().length === 0);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [fullscreen, setFullscreen] = useState(false);

    const [mapFilter, setMapFilter] = useState('all');
    const [distributorFilter, setDistributorFilter] = useState(null);
    const [regionFilter, setRegionFilter] = useState(null);
    const [drillDevices, setDrillDevices] = useState(null);
    const [highlightDevice, setHighlightDevice] = useState(null);
    const [viewMode, setViewMode] = useState('map');

    const pathname = usePathname();
    const user = useAuthStore((s) => s.user);

    const isAdmin = useMemo(() => {
        const role = user?.position || user?.role || (typeof window !== 'undefined' ? localStorage.getItem('user_role') : '');
        return ['admin', 'superadmin', 'manager'].includes(String(role).toLowerCase());
    }, [user]);

    const isEn = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        if (segments[segments.length - 1] === 'en') return true;
        if (typeof window !== 'undefined') return localStorage.getItem('iky_lang') === 'en';
        return false;
    }, [pathname]);

    // Fullscreen listeners
    useEffect(() => {
        const handleFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    // Tải dữ liệu thiết bị và cruise
    const fetchAll = useCallback(async (silent = false) => {
        const hasCache = getCachedDevices().length > 0;
        if (!silent && !hasCache) setLoading(true);
        else setRefreshing(true);
        try {
            const [devRes, cruiseRes] = await Promise.all([
                getDevices({ limit: MAX_DEVICE_LIMIT }),
                api.get('last-cruise-list'),
            ]);
            const devList = devRes?.devices || devRes?.data || [];
            const cruiseList = cruiseRes?.data?.data || [];
            if (devList.length) setCachedDevices(devList);

            const byImei = {};
            cruiseList.forEach((c) => {
                const imei = c.dev || c.imei;
                if (imei) byImei[imei] = c;
            });

            setDevices(devList);
            setCruiseByImei(byImei);
            setLastUpdated(new Date());
        } catch (e) {
            console.error('[useOverviewData] Fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Khởi tạo và auto refresh 5 phút
    useEffect(() => {
        fetchAll(devices.length > 0);
        const cached = localStorage.getItem('iky_provinces_cache');
        if (cached) {
            try { setProvinces(JSON.parse(cached)); } catch (_) {}
        } else {
            fetch(PROVINCE_API).then((r) => r.json()).then((d) => {
                if (d.data?.length) {
                    setProvinces(d.data);
                    localStorage.setItem('iky_provinces_cache', JSON.stringify(d.data));
                }
            }).catch(() => {});
        }

        const id = setInterval(() => fetchAll(true), OVERVIEW_AUTO_REFRESH_MS);
        return () => clearInterval(id);
    }, []);

    // Bảng băm Online Map: tra cứu O(1)
    const onlineMap = useMemo(() => {
        const map = new Map();
        const now = Date.now();
        for (const imei in cruiseByImei) {
            const c = cruiseByImei[imei];
            const updated = c?.updatedAt || c?.createdAt;
            if (updated && now - new Date(updated).getTime() < ONLINE_THRESHOLD_MS) {
                map.set(imei, true);
            }
        }
        return map;
    }, [cruiseByImei]);

    const distributorOptions = useMemo(() => {
        if (!isAdmin) return [];
        const map = new Map();
        devices.forEach((d) => {
            const dist = d.distributor_id;
            if (dist?._id && !map.has(dist._id)) {
                map.set(dist._id, { value: dist._id, label: dist.name || dist.username || dist._id });
            }
        });
        return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    }, [devices, isAdmin]);

    const distributorStats = useMemo(() => {
        if (!isAdmin || !devices.length) return [];
        const map = new Map();
        devices.forEach((d) => {
            const dist = d.distributor_id;
            const id = dist?._id || '__none__';
            const label = dist?.name || dist?.username || (dist ? dist._id : (isEn ? 'Unassigned' : 'Chưa phân đại lý'));
            if (!map.has(id)) map.set(id, { id, label, total: 0, online: 0 });
            const entry = map.get(id);
            entry.total++;
            if (onlineMap.get(d.imei)) entry.online++;
        });
        return [...map.values()].map((e) => ({ ...e, offline: e.total - e.online })).sort((a, b) => b.total - a.total);
    }, [devices, onlineMap, isAdmin, isEn]);

    const filteredByMap = useMemo(() => {
        if (mapFilter === 'online') return devices.filter((d) => onlineMap.get(d.imei));
        if (mapFilter === 'offline') return devices.filter((d) => !onlineMap.get(d.imei));
        return devices;
    }, [devices, onlineMap, mapFilter]);

    const filteredByDistributor = useMemo(() => {
        if (!distributorFilter) return filteredByMap;
        return filteredByMap.filter((d) => d.distributor_id?._id === distributorFilter);
    }, [filteredByMap, distributorFilter]);

    const regionFilteredDevices = useMemo(() => {
        if (!regionFilter || !regionFilter.checkedProvs.size || !provinces.length) return filteredByDistributor;
        return filteredByDistributor.filter((d) => {
            const cruise = cruiseByImei[d.imei];
            if (!cruise?.lat || !cruise?.lon) return false;
            const res = findDistrictForPoint(cruise.lat, cruise.lon);
            let provId = res?.feature?.properties?.ma_tinh ? String(res.feature.properties.ma_tinh) : null;
            let provFullName = null;
            if (!provId) {
                const nearest = findNearest(cruise.lat, cruise.lon, provinces);
                if (nearest) { provId = nearest.id; provFullName = nearest.full_name; }
            } else {
                provFullName = provinces.find((x) => String(x.id) === provId)?.full_name;
            }
            if (!provId || !regionFilter.checkedProvs.has(provId)) return false;
            const selectedDists = regionFilter.checkedDists?.[provId];
            if (!selectedDists || selectedDists.size === 0) return true;
            const distList = regionFilter.districtCache?.[provId];
            if (!distList?.length) return true;
            const distRes = findDistrictForPoint(cruise.lat, cruise.lon, { districtList: distList, provinceId: provId, provinceName: provFullName });
            return Boolean(distRes?.id && selectedDists.has(distRes.id));
        });
    }, [filteredByDistributor, regionFilter, provinces, cruiseByImei]);

    const displayDevices = regionFilter?.checkedProvs?.size ? regionFilteredDevices : filteredByDistributor;
    const statDevices = drillDevices ?? displayDevices;

    const displayTotal = statDevices.length;
    const displayOnline = useMemo(() => statDevices.filter((d) => onlineMap.get(d.imei)).length, [statDevices, onlineMap]);
    const displayOffline = displayTotal - displayOnline;
    const displayExpiring = useMemo(() => statDevices.filter(isExpiringSoon).length, [statDevices]);
    const totalDevices = devices.length;

    const toggleFilter = (mode) => setMapFilter((cur) => (cur === mode ? 'all' : mode));

    const handleExport = (mode) => {
        let regionLabel = null;
        if (regionFilter?.checkedProvs?.size) {
            regionLabel = [...regionFilter.checkedProvs].map((id) => provinces.find((p) => p.id === id)?.full_name || id).join(', ');
        }
        const distName = distributorFilter ? distributorOptions.find((o) => o.value === distributorFilter)?.label : null;
        exportOverviewExcel({
            devices: regionFilter?.checkedProvs?.size ? regionFilteredDevices : filteredByDistributor,
            cruiseByImei,
            mode,
            regionLabel,
            distributorName: distName,
            provinces,
        });
    };

    return {
        devices, cruiseByImei, provinces, loading, refreshing, lastUpdated, fullscreen,
        mapFilter, setMapFilter, toggleFilter, distributorFilter, setDistributorFilter,
        regionFilter, setRegionFilter, drillDevices, setDrillDevices, highlightDevice,
        setHighlightDevice, viewMode, setViewMode, isAdmin, isEn, onlineMap,
        distributorOptions, distributorStats, filteredDevices: filteredByDistributor,
        regionFilteredDevices, displayDevices, statDevices, displayTotal, displayOnline,
        displayOffline, displayExpiring, totalDevices, toggleFullscreen, fetchAll, handleExport,
    };
}
