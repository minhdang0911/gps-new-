'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import {
    useMasterDeviceCategories,
    useMasterVehicleCategories,
    useMasterUserOptions,
} from '../useMasterData';

export function useManageDevicesData({
    currentPage,
    pageSize,
    filters,
    getDevices,
    loadOptions = true,
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

    // Master Data (Chỉ fetch khi loadOptions = true để ưu tiên render bảng trước)
    const { deviceCategories, dcLoading, mutateDeviceCategories } = useMasterDeviceCategories(loadOptions);
    const { vehicleCategories, vcLoading, mutateVehicleCategories } = useMasterVehicleCategories(loadOptions);
    const { userOptions, usersLoading, mutateUserOptions } = useMasterUserOptions(loadOptions);

    // Opening modals does NOT need network prefetch - options are already cached in RAM
    const noop = () => Promise.resolve();

    const refreshOptions = async () => {
        return Promise.allSettled([
            mutateDeviceCategories?.(true),
            mutateVehicleCategories?.(true),
            mutateUserOptions?.(true),
        ]);
    };

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

        prefetchOptions: noop,
        refreshOptions,
    };
}
