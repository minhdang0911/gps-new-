'use client';

import { useMemo, useEffect } from 'react';
import useSWR from 'swr';

export function useManageDevicesData({
    token,
    currentPage,
    pageSize,
    filters,
    getDevices,
    getDeviceCategories,
    getVehicleCategories,
    getUserList,
    modalMode,
}) {
    const listParams = useMemo(
        () => ({
            page: currentPage,
            limit: pageSize,
            ...filters,
        }),
        [currentPage, pageSize, filters],
    );

    const devicesKey = ['devices', listParams];
    const devicesFetcher = async ([, params]) => getDevices(params);

    const {
        data: devicesRes,
        isLoading: devicesLoading,
        isValidating: devicesValidating,
        mutate: mutateDevices,
    } = useSWR(devicesKey, devicesFetcher, {
        keepPreviousData: true,
        revalidateOnFocus: false,
        dedupingInterval: 10_000,
    });

    const devices = devicesRes?.devices || [];
    const total =
        devicesRes?.total ??
        devicesRes?.pagination?.total ??
        (Array.isArray(devicesRes?.devices) ? devicesRes.devices.length : 0);

    // OPTIONS
    const {
        data: dcRes,
        isLoading: dcLoading,
        mutate: mutateDC,
    } = useSWR(token ? ['deviceCategories', token] : null, ([, tk]) => getDeviceCategories(tk, { limit: 1000 }), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const {
        data: vcRes,
        isLoading: vcLoading,
        mutate: mutateVC,
    } = useSWR(token ? ['vehicleCategories', token] : null, ([, tk]) => getVehicleCategories(tk, { limit: 1000 }), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const usersFetcher = async () => {
        try {
            return await getUserList({ limit: 2000 });
        } catch (e1) {
            if (!token) throw e1;
            return await getUserList(token, { limit: 2000 });
        }
    };

    const {
        data: usersRes,
        isLoading: usersLoading,
        mutate: mutateUsers,
    } = useSWR(['users', token || 'no-token'], usersFetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
    });

    const deviceCategories = dcRes?.items || [];
    const vehicleCategories = vcRes?.items || [];
    const userOptions = usersRes?.items || [];

    const prefetchOptions = () => {
        try {
            mutateDC?.();
            mutateVC?.();
            mutateUsers?.();
        } catch (_) {}
    };

    useEffect(() => {
        if (modalMode) prefetchOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modalMode]);

    return {
        listParams,
        devices,
        total,
        devicesLoading,
        devicesValidating,
        mutateDevices,

        deviceCategories,
        vehicleCategories,
        userOptions,
        dcLoading,
        vcLoading,
        usersLoading,

        prefetchOptions,
    };
}
