'use client';

import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDevices } from '../../lib/api/devices';
import { getCachedDevices, setCachedDevices } from '../../util/deviceCache';
import { MAX_DEVICE_LIMIT } from '../../lib/constants';
import { matchVehicleSearch } from '../../lib/search/canonicalVehicleSearch';

export function useMonitorDevices({ token, onDeviceSelectReset, onOpenPopup }) {
    const queryClient = useQueryClient();

    const [selectedDevice, setSelectedDevice] = useState(null);
    const selectedDeviceRef = useRef(selectedDevice);
    useEffect(() => {
        selectedDeviceRef.current = selectedDevice;
    }, [selectedDevice]);

    const [searchText, setSearchText] = useState('');
    const deferredSearchText = useDeferredValue(searchText);
    const [statusFilter, setStatusFilter] = useState('all');

    const devicesQuery = useQuery({
        queryKey: ['monitor', 'devices', token],
        enabled: !!token,
        queryFn: async () => {
            const data = await getDevices({ page: 1, limit: MAX_DEVICE_LIMIT });
            if (data?.devices?.length) {
                setCachedDevices(data.devices);
            }
            return data;
        },
        placeholderData: () => {
            const cached = getCachedDevices();
            if (cached && cached.length > 0) {
                return { devices: cached };
            }
            return undefined;
        },
        staleTime: 0,
        gcTime: 10 * 60_000,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const deviceList = devicesQuery.data?.devices || [];
    const loadingDevices = devicesQuery.isLoading && deviceList.length === 0;

    useEffect(() => {
        if (!deviceList.length) return;

        let preselectImei = null;
        let preselectId = null;

        if (typeof window !== 'undefined') {
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
        }

        let target = null;
        if (preselectImei) {
            target = deviceList.find((d) => d.imei === preselectImei);
        }
        if (!target && preselectId) {
            target = deviceList.find((d) => d._id === preselectId);
        }
        if (!target && selectedDeviceRef.current) {
            target = deviceList.find(
                (d) => d._id === selectedDeviceRef.current._id || d.imei === selectedDeviceRef.current.imei
            );
        }
        if (!target) {
            target = deviceList[0];
        }

        if (target) {
            const current = selectedDeviceRef.current;
            const isInitial = !current;
            const isChanged = !current || current._id !== target._id || current.imei !== target.imei;
            if (isChanged) {
                setSelectedDevice(target);
                if (isInitial) onOpenPopup?.();
                if (preselectImei || preselectId) {
                    setSearchText(target.license_plate || target.imei || '');
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceList]);

    const filteredDevices = useMemo(() => {
        if (!deviceList?.length) return [];
        const rawKw = (searchText || '').trim();
        if (!rawKw) {
            return deviceList.filter((d) => {
                const isOnline = d.status === 10;
                if (statusFilter === 'online') return isOnline;
                if (statusFilter === 'offline') return !isOnline;
                return true;
            });
        }

        const kwLower = rawKw.toLowerCase();

        const directMatches = deviceList.filter((d) => {
            const plate = (d.license_plate || '').toLowerCase();
            const imei = (d.imei || '').toLowerCase();
            const phone = (d.phone_number || '').toLowerCase();
            const driver = (d.driver || '').toLowerCase();

            const match = plate.includes(kwLower) || imei.includes(kwLower) || phone.includes(kwLower) || driver.includes(kwLower);
            const isOnline = d.status === 10;
            let matchStatus = true;
            if (statusFilter === 'online') matchStatus = isOnline;
            if (statusFilter === 'offline') matchStatus = !isOnline;
            return match && matchStatus;
        });

        if (directMatches.length > 0) {
            return directMatches;
        }

        return deviceList.filter((d) => {
            const match = matchVehicleSearch(d, rawKw, { allowFuzzy: true });
            const isOnline = d.status === 10;
            let matchStatus = true;
            if (statusFilter === 'online') matchStatus = isOnline;
            if (statusFilter === 'offline') matchStatus = !isOnline;
            return match && matchStatus;
        });
    }, [deviceList, searchText, statusFilter]);

    const listContainerRef = useRef(null);

    useEffect(() => {
        if (listContainerRef.current) {
            listContainerRef.current.scrollTop = 0;
        }
    }, [searchText, statusFilter]);

    const handleSelectDevice = useCallback(async (device) => {
        if (!device) return;

        const currentSel = selectedDeviceRef.current;
        const sameDevice = currentSel?._id === device._id && currentSel?.imei === device.imei;

        if (sameDevice) {
            onOpenPopup?.();
            if (!token) return;

            const now = Date.now();
            const STALE_MS = 10_000;

            const keyBattery = ['monitor', 'batteryStatus', token, device.imei];
            const keyInfo = ['monitor', 'deviceInfo', token, device._id];
            const keyCruise = ['monitor', 'lastCruise', token, device.imei];

            const isStaleKey = (key) => {
                const st = queryClient.getQueryState(key);
                if (!st || !st.dataUpdatedAt) return true;
                return now - st.dataUpdatedAt >= STALE_MS;
            };

            const shouldRefetch = isStaleKey(keyBattery) || isStaleKey(keyInfo) || isStaleKey(keyCruise);

            if (shouldRefetch) {
                await Promise.all([
                    queryClient.refetchQueries({ queryKey: keyBattery, exact: true }),
                    queryClient.refetchQueries({ queryKey: keyInfo, exact: true }),
                    queryClient.refetchQueries({ queryKey: keyCruise, exact: true }),
                ]);
            }

            return;
        }

        setSelectedDevice(device);
        onOpenPopup?.();
        if (onDeviceSelectReset) onDeviceSelectReset(device);
    }, [token, queryClient, onDeviceSelectReset, onOpenPopup]);

    return {
        deviceList,
        loadingDevices,
        selectedDevice,
        setSelectedDevice,
        selectedDeviceRef,
        searchText,
        setSearchText,
        statusFilter,
        setStatusFilter,
        filteredDevices,
        listContainerRef,
        handleSelectDevice,
    };
}
