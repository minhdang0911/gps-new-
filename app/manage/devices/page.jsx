// app/manage/devices/page.jsx
'use client';

import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import dynamic from 'next/dynamic';
import 'intro.js/introjs.css';
import '../../styles/intro-custom.css';

import markerIconStop from '../../assets/marker-red.png';
import markerRun from '../../assets/marker-run.png';
import markerRun50 from '../../assets/marker-run50.png';
import markerRun80 from '../../assets/marker-run80.png';

import { getTodayForFileName } from '../../util/FormatDate';
import { getDevices } from '../../lib/api/devices';
import { getLastCruise } from '../../lib/api/cruise';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import { useManageDevicesData } from '../../hooks/manageDevices/useManageDevicesData';
import { useDeviceDetail } from '../../hooks/manageDevices/useDeviceDetail';
import { useLeafletDeviceMap } from '../../hooks/manageDevices/useLeafletDeviceMap';
import { useDeviceCommandBar } from '../../hooks/manageDevices/useDeviceCommandBar';
import { exportDevicesExcel } from '../../util/manageDevices/exportDevicesExcel';
import { refreshAllMasterData } from '../../hooks/useMasterData';
import { useIsEn } from '../../hooks/useLang';
import { useAuthStore } from '../../stores/authStore';

import DeviceListView from '../../components/manageDevices/DeviceListView';
import DeviceModalsContainer from './components/DeviceModalsContainer';
import { useDeviceMaintenanceActions } from './hooks/useDeviceMaintenanceActions';
import { useDeviceTourConfig } from './hooks/useDeviceTourConfig';
import { useDeviceCrudActions } from './hooks/useDeviceCrudActions';

const DeviceDetailView = dynamic(() => import('../../components/manageDevices/DeviceDetailView'), { ssr: false });

const locales = { vi, en };
const PAGE_SIZE_KEY = 'iky_devices_page_size';
const FILTER_SESSION_KEY = 'iky_manage_devices_filters';

export default function ManageDevicesPage() {
    const user = useAuthStore((state) => state.user);
    const currentRole = user?.position || user?.role || (typeof window !== 'undefined' ? localStorage.getItem('role') || '' : '');
    const canEditDevice = currentRole === 'administrator' || currentRole === 'distributor';
    const canAddDevice = currentRole === 'administrator' || currentRole === 'distributor';
    const canDeleteDevice = currentRole === 'administrator';

    const isEn = useIsEn();
    const t = isEn ? locales.en.manageDevices : locales.vi.manageDevices;

    const [filters, setFilters] = useState(() => {
        if (typeof window === 'undefined') return { phone_number: '', license_plate: '', imei: '', driver: '' };
        try {
            const saved = sessionStorage.getItem(FILTER_SESSION_KEY);
            return saved ? JSON.parse(saved) : { phone_number: '', license_plate: '', imei: '', driver: '' };
        } catch {
            return { phone_number: '', license_plate: '', imei: '', driver: '' };
        }
    });

    useEffect(() => {
        try { sessionStorage.setItem(FILTER_SESSION_KEY, JSON.stringify(filters)); } catch {}
    }, [filters]);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
        if (typeof window === 'undefined') return 10;
        const saved = parseInt(localStorage.getItem(PAGE_SIZE_KEY), 10);
        return saved > 0 ? saved : 10;
    });

    useEffect(() => {
        try { localStorage.setItem(PAGE_SIZE_KEY, String(pageSize)); } catch {}
    }, [pageSize]);

    const [optionsReady, setOptionsReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setOptionsReady(true), 600);
        return () => clearTimeout(timer);
    }, []);

    const {
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
        refreshOptions,
    } = useManageDevicesData({
        currentPage,
        pageSize,
        filters,
        getDevices,
        loadOptions: optionsReady,
    });

    const handleRefresh = async () => {
        message.loading({ content: isEn ? 'Refreshing...' : 'Đang làm mới...', key: 'refresh_devices', duration: 1 });
        await Promise.allSettled([mutateDevices(), refreshAllMasterData()]);
        message.success({ content: isEn ? 'Refreshed' : 'Đã làm mới dữ liệu', key: 'refresh_devices', duration: 1.5 });
    };

    const crud = useDeviceCrudActions({
        canAddDevice,
        canEditDevice,
        canDeleteDevice,
        refreshOptions,
        mutateDevices,
        destroyMap: () => {},
        isEn,
        t,
    });

    const { cruiseInfo, mutateCruise, batteryInfo, getEngineStatusText, getVehicleStatusText } = useDeviceDetail({
        viewMode: crud.viewMode,
        selectedDevice: crud.selectedDevice,
        isEn,
        getLastCruise,
        getBatteryStatusByImei,
    });

    const { destroyMap } = useLeafletDeviceMap({
        enabled: crud.viewMode === 'detail',
        selectedDevice: crud.selectedDevice,
        cruiseInfo,
        batteryInfo,
        markerAssets: { stop: markerIconStop, run: markerRun, run50: markerRun50, run80: markerRun80 },
        t,
        isEn,
        getEngineStatusText,
        getVehicleStatusText,
    });

    const onExportExcel = async () => {
        try {
            const rs = await exportDevicesExcel({ getDevices, total, filters, t, isEn, getTodayForFileName });
            if (!rs.ok && rs.reason === 'NO_DATA') return message.warning(t.noData);
            message.success(t.exportSuccess || (isEn ? 'Export Excel success' : 'Xuất Excel thành công'));
        } catch {
            message.error(t.exportFailed || (isEn ? 'Export Excel failed' : 'Xuất Excel thất bại'));
        }
    };

    const cmd = useDeviceCommandBar({
        devices,
        isEn,
        canAddDevice,
        getDevices,
        viewMode: crud.viewMode,
        selectedDevice: crud.selectedDevice,
        onExportExcel,
        onOpenAdd: crud.openAdd,
        onGoBack: () => { crud.goBack(); destroyMap(); },
    });

    const tour = useDeviceTourConfig({ isEnglish: isEn, viewMode: crud.viewMode, canAddDevice });
    const maintenance = useDeviceMaintenanceActions({ isEnglish: isEn });

    return (
        <>
            {crud.viewMode === 'list' ? (
                <DeviceListView
                    t={t}
                    isEn={isEn}
                    filters={filters}
                    setFilters={setFilters}
                    total={total}
                    devices={devices}
                    devicesLoading={devicesLoading}
                    devicesValidating={devicesValidating}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    setCurrentPage={setCurrentPage}
                    setPageSize={setPageSize}
                    canAddDevice={canAddDevice}
                    canEditDevice={canEditDevice}
                    canDeleteDevice={canDeleteDevice}
                    onOpenAdd={crud.openAdd}
                    onOpenEdit={crud.openEdit}
                    onDelete={crud.handleDelete}
                    onSelectDevice={crud.handleSelectDevice}
                    onExportExcel={onExportExcel}
                    onOpenCommandBar={cmd.open}
                    onStartTour={tour.start}
                    onActivateDevice={maintenance.handleActivateDevice}
                    onMaintainDevice={maintenance.openMaintainModal}
                    activatingId={maintenance.activatingDeviceId}
                    onRefresh={handleRefresh}
                />
            ) : (
                <DeviceDetailView
                    t={t}
                    isEn={isEn}
                    selectedDevice={crud.selectedDevice}
                    cruiseInfo={cruiseInfo}
                    batteryInfo={batteryInfo}
                    getEngineStatusText={getEngineStatusText}
                    getVehicleStatusText={getVehicleStatusText}
                    mutateCruise={mutateCruise}
                    onBack={() => { crud.goBack(); destroyMap(); }}
                />
            )}

            <DeviceModalsContainer
                cmd={cmd}
                crud={crud}
                maintenance={maintenance}
                isEn={isEn}
                t={t}
                canEditDevice={canEditDevice}
                canDeleteDevice={canDeleteDevice}
                deviceCategories={deviceCategories}
                vehicleCategories={vehicleCategories}
                userOptions={userOptions}
                dcLoading={dcLoading}
                vcLoading={vcLoading}
                usersLoading={usersLoading}
                currentRole={currentRole}
            />
        </>
    );
}
