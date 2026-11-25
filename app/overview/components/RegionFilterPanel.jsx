/**
 * @file RegionFilterPanel.jsx
 * @description Panel bộ lọc khu vực 63 tỉnh và quận huyện kết hợp xuất báo cáo Excel theo khu vực.
 */

'use client';

import React, { useState, useRef, useMemo, useCallback } from 'react';
import { MapPin, X } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { findNearest } from '../../util/geo';
import { findDistrictForPoint } from '../../util/geoDistrict';
import { exportByRegion } from '../useOverviewExcel';
import RegionFilterTrigger from './RegionFilterTrigger';
import RegionProvinceList from './RegionProvinceList';
import RegionDistrictList from './RegionDistrictList';
import RegionFilterFooter from './RegionFilterFooter';

const DISTRICT_API = (provId) => `https://esgoo.net/api-tinhthanh/2/${provId}.htm`;

const isOnlineCruise = (c) => {
    if (!c) return false;
    const u = c.updatedAt || c.createdAt;
    return Boolean(u && Date.now() - new Date(u).getTime() < 24 * 60 * 60 * 1000);
};

export default function RegionFilterPanel({
    provinces = [],
    devices = [],
    cruiseByImei = {},
    onApply,
    disabled = false,
    isEn = false,
}) {
    const t = (vi, en) => (isEn ? en : vi);
    const [open, setOpen] = useState(false);
    const [hoveredProv, setHoveredProv] = useState(null);
    const [checkedProvs, setCheckedProvs] = useState(new Set());
    const [districtCache, setDistrictCache] = useState({});
    const [checkedDists, setCheckedDists] = useState({});
    const [loadingDist, setLoadingDist] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [provSearch, setProvSearch] = useState('');
    const [distSearch, setDistSearch] = useState('');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [appliedProvIds, setAppliedProvIds] = useState(new Set());

    const ref = useRef(null);
    const exportMenuRef = useRef(null);

    useClickOutside(ref, useCallback(() => setOpen(false), []), open);
    useClickOutside(exportMenuRef, useCallback(() => setShowExportMenu(false), []), showExportMenu);

    const deviceCountByProv = useMemo(() => {
        if (!provinces.length) return {};
        const counts = {};
        Object.values(cruiseByImei).forEach((cruise) => {
            if (!cruise?.lat || !cruise?.lon) return;
            const nearest = findNearest(cruise.lat, cruise.lon, provinces);
            if (nearest) counts[nearest.id] = (counts[nearest.id] || 0) + 1;
        });
        return counts;
    }, [provinces, cruiseByImei]);

    const districtDeviceCounts = useMemo(() => {
        if (!hoveredProv) return {};
        const dists = districtCache[hoveredProv.id];
        if (!dists?.length) return {};
        const counts = {};
        Object.values(cruiseByImei).forEach((cruise) => {
            if (!cruise?.lat || !cruise?.lon) return;
            const res = findDistrictForPoint(cruise.lat, cruise.lon, {
                districtList: dists,
                provinceId: hoveredProv.id,
                provinceName: hoveredProv.full_name,
            });
            const provId = res?.feature?.properties?.ma_tinh ? String(res.feature.properties.ma_tinh) : null;
            if (provId) {
                if (provId !== String(hoveredProv.id)) return;
            } else {
                const nearestProv = findNearest(cruise.lat, cruise.lon, provinces);
                if (nearestProv?.id !== hoveredProv.id) return;
            }
            if (res?.id) counts[res.id] = (counts[res.id] || 0) + 1;
        });
        return counts;
    }, [hoveredProv, districtCache, cruiseByImei, provinces]);

    const handleHoverProv = async (prov) => {
        setHoveredProv(prov);
        setDistSearch('');
        if (!districtCache[prov.id]) {
            setLoadingDist(true);
            try {
                const res = await fetch(DISTRICT_API(prov.id));
                const data = await res.json();
                setDistrictCache((prev) => ({ ...prev, [prov.id]: data.data || [] }));
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingDist(false);
            }
        }
    };

    const toggleProv = (provId) => {
        setCheckedProvs((prev) => {
            const next = new Set(prev);
            if (next.has(provId)) next.delete(provId); else next.add(provId);
            return next;
        });
    };

    const toggleDist = (provId, distId) => {
        if (!checkedProvs.has(provId)) setCheckedProvs((prev) => new Set([...prev, provId]));
        setCheckedDists((prev) => {
            const set = new Set(prev[provId] || []);
            if (set.has(distId)) set.delete(distId); else set.add(distId);
            return { ...prev, [provId]: set };
        });
    };

    const handleApply = () => {
        const hasFilter = checkedProvs.size > 0;
        setAppliedProvIds(new Set(checkedProvs));
        onApply(hasFilter ? { checkedProvs: new Set(checkedProvs), checkedDists: { ...checkedDists }, districtCache } : null);
        setOpen(false);
    };

    const handleReset = () => {
        setCheckedProvs(new Set());
        setCheckedDists({});
        setAppliedProvIds(new Set());
        onApply(null);
        setOpen(false);
    };

    const handleRemoveTag = (e, provId) => {
        e.stopPropagation();
        const nextApplied = new Set(appliedProvIds);
        nextApplied.delete(provId);
        setAppliedProvIds(nextApplied);

        const nextChecked = new Set(checkedProvs);
        nextChecked.delete(provId);
        setCheckedProvs(nextChecked);

        setCheckedDists((prev) => { const n = { ...prev }; delete n[provId]; return n; });
        if (nextApplied.size === 0) onApply(null);
        else {
            const nextDists = { ...checkedDists };
            delete nextDists[provId];
            onApply({ checkedProvs: nextChecked, checkedDists: nextDists, districtCache });
        }
    };

    const handleExport = async (mode = 'all') => {
        if (!checkedProvs.size) return;
        setExporting(true);
        setShowExportMenu(false);
        try {
            const toExport = mode === 'online'
                ? devices.filter((d) => isOnlineCruise(cruiseByImei[d.imei]))
                : mode === 'offline' ? devices.filter((d) => !isOnlineCruise(cruiseByImei[d.imei])) : devices;
            for (const provId of checkedProvs) {
                const prov = provinces.find((p) => p.id === provId);
                if (!prov) continue;
                const dists = checkedDists[provId];
                if (dists && dists.size > 0) {
                    for (const distId of dists) {
                        const dist = (districtCache[provId] || []).find((d) => d.id === distId);
                        if (dist) await exportByRegion({ devices: toExport, cruiseByImei, province: prov, district: { properties: { ma_huyen: dist.id, ten_huyen: dist.name, loai: dist.full_name?.split(' ')[0] || '' } }, provinces });
                    }
                } else {
                    await exportByRegion({ devices: toExport, cruiseByImei, province: prov, district: null, provinces });
                }
            }
        } finally { setExporting(false); }
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <RegionFilterTrigger
                provinces={provinces}
                appliedProvIds={appliedProvIds}
                onToggleOpen={() => setOpen((o) => !o)}
                onRemoveTag={handleRemoveTag}
                disabled={disabled}
                exporting={exporting}
                isEn={isEn}
            />

            {open && (
                <div className="ov-region-panel">
                    <div style={{ padding: '10px 15px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexShrink: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} color="#0f766e" /> {t('Lọc & xuất theo khu vực', 'Filter & Export by Region')}
                        </span>
                        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2, display: 'flex', alignItems: 'center' }}>
                            <X size={16} />
                        </button>
                    </div>

                    <div className="ov-region-body">
                        <RegionProvinceList
                            provinces={provinces}
                            hoveredProv={hoveredProv}
                            checkedProvs={checkedProvs}
                            checkedDists={checkedDists}
                            deviceCountByProv={deviceCountByProv}
                            searchValue={provSearch}
                            onSearchChange={setProvSearch}
                            onSelectProv={handleHoverProv}
                            onToggleProv={toggleProv}
                            isEn={isEn}
                        />
                        <RegionDistrictList
                            hoveredProv={hoveredProv}
                            districts={districtCache[hoveredProv?.id] || []}
                            checkedProvs={checkedProvs}
                            checkedDists={checkedDists}
                            districtDeviceCounts={districtDeviceCounts}
                            loadingDist={loadingDist}
                            searchValue={distSearch}
                            onSearchChange={setDistSearch}
                            onToggleAllProv={() => { toggleProv(hoveredProv.id); setCheckedDists((prev) => ({ ...prev, [hoveredProv.id]: new Set() })); }}
                            onToggleDist={toggleDist}
                            isEn={isEn}
                        />
                    </div>

                    <RegionFilterFooter
                        checkedCount={checkedProvs.size}
                        exporting={exporting}
                        showExportMenu={showExportMenu}
                        exportMenuRef={exportMenuRef}
                        onReset={handleReset}
                        onToggleExportMenu={() => setShowExportMenu((m) => !m)}
                        onExport={handleExport}
                        onApply={handleApply}
                        isEn={isEn}
                    />
                </div>
            )}
        </div>
    );
}
