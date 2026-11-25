'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDevices } from '../../lib/api/devices';
import { getCachedDevices } from '../../util/deviceCache';
import { toInputDateTime } from '../../util/cruiseUtils';
import { canonicalizeVehicleSearch, matchVehicleSearch } from '../../lib/search/canonicalVehicleSearch';

export function useCruiseDevices(t) {
    const [deviceList, setDeviceList] = useState(() => getCachedDevices());
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [selectedImei, setSelectedImei] = useState('');
    const [deviceSearchText, setDeviceSearchText] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [loadingDevices, setLoadingDevices] = useState(false);

    const handlePresetRange = useCallback((hours) => {
        const now = new Date();
        const past = new Date(now.getTime() - hours * 60 * 60 * 1000);
        setStart(toInputDateTime(past));
        setEnd(toInputDateTime(now));
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const fetchDevices = async () => {
            try {
                const cached = getCachedDevices();
                if (!cached.length) setLoadingDevices(true);
                const res = await getDevices();
                const devices = res.devices || [];
                setDeviceList(devices);
                if (devices.length > 0) {
                    let preselectImei = null;
                    let preselectId = null;

                    try {
                        const params = new URLSearchParams(window.location.search);
                        preselectImei = params.get('imei') || params.get('dev');
                        preselectId = params.get('deviceId') || params.get('id');

                        if (!preselectImei && !preselectId) {
                            preselectImei = localStorage.getItem('iky_preselect_imei');
                            preselectId = localStorage.getItem('iky_preselect_device_id');
                        }

                        localStorage.removeItem('iky_preselect_imei');
                        localStorage.removeItem('iky_preselect_device_id');
                    } catch (_) {}

                    let target = null;
                    if (preselectImei) {
                        target = devices.find((d) => d.imei === preselectImei);
                    }
                    if (!target && preselectId) {
                        target = devices.find((d) => d._id === preselectId);
                    }
                    if (!target) {
                        target = devices[0];
                    }

                    setSelectedDeviceId(target._id);
                    setSelectedImei(target.imei || '');
                    handlePresetRange(24);
                }
            } catch (err) {
                console.error('Load devices error:', err);
            } finally {
                setLoadingDevices(false);
            }
        };

        fetchDevices();
    }, [handlePresetRange]);

    const deviceOptions = useMemo(() => {
        const keyword = deviceSearchText.trim().toLowerCase();

        const highlightText = (text) => {
            if (!keyword) return text;
            const lower = text.toLowerCase();
            const idx = lower.indexOf(keyword);
            if (idx === -1) return text;
            const before = text.slice(0, idx);
            const match = text.slice(idx, idx + keyword.length);
            const after = text.slice(idx + keyword.length);
            return (
                <>
                    {before}
                    <span className="iky-select-highlight">{match}</span>
                    {after}
                </>
            );
        };

        return deviceList.map((d) => {
            const plate = (d.license_plate || t?.common?.unknownPlate || 'Chưa có biển số').trim();
            const imei = d.imei || '---';
            const phone = d.phone_number || '';
            const rawLabel = `${plate} – ${imei}${phone ? ` (${phone})` : ''}`;
            const canonical = canonicalizeVehicleSearch(`${plate}${imei}${phone}${d.driver || ''}`);
            return {
                value: d._id,
                device: d,
                searchable: rawLabel.toLowerCase(),
                canonical,
                label: highlightText(rawLabel),
            };
        });
    }, [deviceList, t, deviceSearchText]);

    return {
        deviceList,
        selectedDeviceId,
        setSelectedDeviceId,
        selectedImei,
        setSelectedImei,
        deviceSearchText,
        setDeviceSearchText,
        start,
        setStart,
        end,
        setEnd,
        loadingDevices,
        deviceOptions,
        handlePresetRange,
        canonicalizeVehicleSearch,
    };
}
