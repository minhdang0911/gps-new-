/* =========================
   FILE 1: ManageDevicesPage.jsx
   ========================= */
'use client';

import React, { useMemo, useState } from 'react';
import { Form, message, Modal, DatePicker, Input } from 'antd';
import dayjs from 'dayjs';
import { usePathname } from 'next/navigation';

// map icons
import markerIconStop from '../../assets/marker-red.png';
import markerRun from '../../assets/marker-run.png';
import markerRun50 from '../../assets/marker-run50.png';
import markerRun80 from '../../assets/marker-run80.png';

import { getTodayForFileName } from '../../util/FormatDate';

import { getDevices, createDevice, updateDevice, deleteDevice } from '../../lib/api/devices';
import { getDeviceCategories } from '../../lib/api/deviceCategory';
import { getVehicleCategories } from '../../lib/api/vehicleCategory';
import { getUserList } from '../../lib/api/user';
import { getLastCruise } from '../../lib/api/cruise';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';

// ✅ maintain APIs
import { startMaintenance, confirmMaintenance } from '../../lib/api/maintain';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import { useManageDevicesData } from '../../hooks/manageDevices/useManageDevicesData';
import { useDeviceDetail } from '../../hooks/manageDevices/useDeviceDetail';
import { useLeafletDeviceMap } from '../../hooks/manageDevices/useLeafletDeviceMap';
import { useDeviceCommandBar } from '../../hooks/manageDevices/useDeviceCommandBar';

import { exportDevicesExcel } from '../../util/manageDevices/exportDevicesExcel';
import { buildPendingFormValues, validatePhone, extractErrorMsg } from '../../util/manageDevices/deviceFormHandlers';

import { useUndoDeleteToast } from '../../hooks/common/useUndoDeleteToast';

import DeviceListView from '../../components/manageDevices/DeviceListView';
import DeviceDetailView from '../../components/manageDevices/DeviceDetailView';
import DeviceUpsertModal from '../../components/manageDevices/DeviceUpsertModal';
import DeviceCommandBarModal from '../../components/manageDevices/DeviceCommandBarModal';
// import DeviceAuditModal from '../../components/manageDevices/DeviceAuditModal';

// ✅ Intro.js
import 'intro.js/introjs.css';
import '../../styles/intro-custom.css';

// ✅ guided tour
import { useGuidedTour } from '../../hooks/common/useGuidedTour';

const { TextArea } = Input;
const locales = { vi, en };

function getConfirmedByFromLocalStorage() {
    if (typeof window === 'undefined') return '';
    const raw = localStorage.getItem('userid');
    if (!raw) return '';

    const s = raw.trim();
    if (s.startsWith('{') || s.startsWith('[') || s.startsWith('"')) {
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === 'object' && parsed._id) return String(parsed._id);
            if (typeof parsed === 'string') return parsed;
            return '';
        } catch {
            return s;
        }
    }
    return s;
}

export default function ManageDevicesPage() {
    const pathname = usePathname() || '/';

    const [token] = useState(() => (typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') || ''));
    const [currentRole] = useState(() => (typeof window === 'undefined' ? '' : localStorage.getItem('role') || ''));

    const canEditDevice = currentRole === 'administrator' || currentRole === 'distributor';
    const canAddDevice = currentRole === 'administrator';
    const canDeleteDevice = currentRole === 'administrator';

    const isEn = useMemo(() => {
        if (typeof window === 'undefined') return false;

        const segments = (pathname || '/').split('/').filter(Boolean);
        const fromPath = segments[segments.length - 1] === 'en';
        if (fromPath) {
            try {
                localStorage.setItem('iky_lang', 'en');
            } catch {}
            return true;
        }

        try {
            return localStorage.getItem('iky_lang') === 'en';
        } catch {
            return false;
        }
    }, [pathname]);

    const t = isEn ? locales.en.manageDevices : locales.vi.manageDevices;

    const [filters, setFilters] = useState({ phone_number: '', license_plate: '', imei: '', driver: '' });
    const [viewMode, setViewMode] = useState('list');
    const [selectedDevice, setSelectedDevice] = useState(null);

    const [modalMode, setModalMode] = useState(null);
    const [pendingFormValues, setPendingFormValues] = useState(null);
    const [form] = Form.useForm();

    // ✅ audit review state
    // const [auditOpen, setAuditOpen] = useState(false);
    // const [auditNextValues, setAuditNextValues] = useState(null);
    // const [auditSubmitting, setAuditSubmitting] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

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
        prefetchOptions,
    } = useManageDevicesData({
        token,
        currentPage,
        pageSize,
        filters,
        getDevices,
        getDeviceCategories,
        getVehicleCategories,
        getUserList,
        modalMode,
    });

    const { cruiseInfo, batteryInfo, getEngineStatusText, getVehicleStatusText } = useDeviceDetail({
        token,
        viewMode,
        selectedDevice,
        isEn,
        getLastCruise,
        getBatteryStatusByImei,
    });

    const { destroyMap } = useLeafletDeviceMap({
        enabled: viewMode === 'detail',
        selectedDevice,
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
        } catch (err) {
            console.error(err);
            message.error(t.exportFailed || (isEn ? 'Export Excel failed' : 'Xuất Excel thất bại'));
        }
    };

    const openAdd = () => {
        if (!canAddDevice) return message.warning(t.noPermissionAdd);
        prefetchOptions();
        setSelectedDevice(null);
        setPendingFormValues(null);
        setModalMode('add');
    };

    const openEdit = (item) => {
        if (!canEditDevice) return message.warning(t.noPermissionEdit);
        prefetchOptions();
        setSelectedDevice(item);
        setPendingFormValues(buildPendingFormValues(item));
        setModalMode('edit');
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (!validatePhone(values.phone_number)) {
                return message.error(t.invalidPhone || (isEn ? 'Invalid phone number' : 'Số điện thoại không hợp lệ'));
            }

            const payload = {
                imei: values.imei,
                phone_number: values.phone_number,
                license_plate: values.license_plate,
                driver: values.driver,
                device_category_id: values.device_category_id,
                vehicle_category_id: values.vehicle_category_id,
                user_id: values.user_id,
                distributor_id: values.distributor_id,
            };

            if (modalMode === 'edit') {
                await updateDevice(token, selectedDevice._id, payload);
                message.success(t.updateSuccess);
            } else if (modalMode === 'add') {
                await createDevice(token, payload);
                message.success(t.createSuccess);
            }

            setModalMode(null);
            setPendingFormValues(null);
            mutateDevices();
        } catch (err) {
            message.error(extractErrorMsg(err, isEn));
        }
    };

    const goBack = () => {
        setViewMode('list');
        setSelectedDevice(null);
        destroyMap();
    };

    const handleSelectDevice = (item) => {
        setSelectedDevice(item);
        setViewMode('detail');
    };

    const { start: startUndoDelete } = useUndoDeleteToast();

    const handleDelete = (item) => {
        if (!canDeleteDevice) return message.warning(t.noPermissionDelete);

        startUndoDelete({
            id: item._id,
            item,
            ms: 5000,
            renderTitle: (it) => (
                <span>
                    {isEn ? 'Deleting device ' : 'Đang xoá thiết bị'} <b>{it?.imei}</b>
                </span>
            ),
            renderUndoText: () => (isEn ? 'Undo' : 'Hoàn tác'),
            renderCountdownText: (remainMs) => (
                <>
                    {isEn ? 'Finalizing in ' : 'Xoá sau '}
                    <b>{Math.ceil(remainMs / 1000)}</b>
                    {isEn ? 's' : ' giây'}
                </>
            ),
            optimisticRemove: () => {
                mutateDevices(
                    (prev) => {
                        if (!prev?.devices) return prev;
                        return { ...prev, devices: prev.devices.filter((d) => d._id !== item._id) };
                    },
                    { revalidate: false },
                );
            },
            rollback: () => mutateDevices(),
            apiDelete: () => deleteDevice(token, item._id),
            onSuccess: () => {
                message.success(t.deleteSuccess);
                mutateDevices();
            },
            onError: (err) => message.error(extractErrorMsg(err, isEn)),
        });
    };

    const popupInParent = (node) => node.parentElement;
    const optionsLoading = dcLoading || vcLoading || usersLoading;

    const onModalOpenChange = (open) => {
        if (!open) return;

        if (modalMode === 'add') {
            form.resetFields();
        } else if (modalMode === 'edit') {
            form.resetFields();
            if (pendingFormValues) form.setFieldsValue(pendingFormValues);
        }
    };

    const cmd = useDeviceCommandBar({
        devices,
        isEn,
        canAddDevice,
        getDevices,
        viewMode,
        selectedDevice,
        onExportExcel,
        onOpenAdd: openAdd,
        onGoBack: goBack,
    });

    // ✅ TOUR CONFIG (per-page)
    const tourSteps = useMemo(() => {
        const steps = [
            {
                element: '[data-tour="filters"]',
                intro: isEn ? 'Use filters to quickly find devices.' : 'Dùng bộ lọc để tìm thiết bị nhanh.',
            },
            {
                element: '[data-tour="searchBtn"]',
                intro: isEn ? 'Click to search with current filters.' : 'Bấm để tìm theo bộ lọc hiện tại.',
            },
            {
                element: '[data-tour="cmdk"]',
                intro: isEn ? 'Press Ctrl+K to open Command Bar.' : 'Nhấn Ctrl+K để mở Command Bar.',
            },
            { element: '[data-tour="table"]', intro: isEn ? 'This is the device list.' : 'Đây là danh sách thiết bị.' },
        ];

        if (canAddDevice) {
            steps.push({
                element: '[data-tour="addBtn"]',
                intro: isEn ? 'Admins can add new devices here.' : 'Admin có thể thêm thiết bị ở đây.',
            });
        }
        return steps;
    }, [isEn, canAddDevice]);

    const tour = useGuidedTour({
        isEn,
        enabled: viewMode === 'list',
        steps: tourSteps,
    });

    // =========================
    // ✅ FIX: loading per-row (activate)
    // =========================
    const [activatingId, setActivatingId] = useState(null);

    const handleActivateDevice = async (device) => {
        if (!device?._id) return message.warning(isEn ? 'Invalid device.' : 'Thiết bị không hợp lệ.');
        try {
            setActivatingId(device._id);
            await startMaintenance({ device_id: device._id });
            message.success(isEn ? 'Activated device.' : 'Kích hoạt thiết bị thành công.');
        } catch (err) {
            console.error(err);
            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg === 'Maintenance already started') {
                message.info(isEn ? 'Maintenance already started.' : 'Thiết bị đã được kích hoạt trước đó.');
                return;
            }
            message.error(isEn ? 'Activate failed.' : 'Kích hoạt thiết bị thất bại.');
        } finally {
            setActivatingId(null);
        }
    };

    const confirmedBy = useMemo(() => getConfirmedByFromLocalStorage(), []);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [confirmForm] = Form.useForm();
    const [deviceToMaintain, setDeviceToMaintain] = useState(null);

    const openMaintainModal = (device) => {
        if (!device) return;
        if (!confirmedBy)
            return message.error(
                isEn ? 'Missing user info. Please login again.' : 'Không tìm thấy tài khoản. Vui lòng đăng nhập lại.',
            );
        if (!device?.imei) return message.error(isEn ? 'Missing IMEI.' : 'Thiếu IMEI để xác nhận.');

        setDeviceToMaintain(device);
        setConfirmOpen(true);
        confirmForm.setFieldsValue({
            maintenanceDate: dayjs(),
            note: '',
        });
    };

    const handleConfirmMaintenance = async () => {
        if (!deviceToMaintain?.imei) return message.error(isEn ? 'Missing IMEI.' : 'Thiếu IMEI để xác nhận.');
        if (!confirmedBy) return message.error(isEn ? 'Missing user info.' : 'Không tìm thấy tài khoản.');

        try {
            setConfirming(true);

            const values = confirmForm.getFieldsValue();
            const dateValue = values?.maintenanceDate;
            const maintenanceDate = dateValue ? dayjs(dateValue).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
            const note = values?.note?.trim();

            const payload = { imei: deviceToMaintain.imei, confirmedBy, maintenanceDate };
            if (note) payload.note = note;

            await confirmMaintenance(payload);

            message.success(isEn ? 'Confirmed maintenance.' : 'Xác nhận bảo dưỡng thành công.');
            setConfirmOpen(false);
            setDeviceToMaintain(null);
            confirmForm.resetFields();
        } catch (err) {
            console.error(err);
            const backendMsg = err?.response?.data?.message || '';
            if (backendMsg.includes('E11000') && backendMsg.includes('imei')) {
                message.info(
                    isEn ? 'This maintenance was already confirmed.' : 'Thiết bị chưa đủ điều kiện để bảo dưỡng.',
                );
                setConfirmOpen(false);
                setDeviceToMaintain(null);
                confirmForm.resetFields();
                return;
            }
            message.error(isEn ? 'Confirm maintenance failed.' : 'Xác nhận bảo dưỡng thất bại.');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <>
            {viewMode === 'list' ? (
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
                    onOpenAdd={openAdd}
                    onOpenEdit={openEdit}
                    onDelete={handleDelete}
                    onSelectDevice={handleSelectDevice}
                    onExportExcel={onExportExcel}
                    onOpenCommandBar={cmd.open}
                    onStartTour={tour.start}
                    // ✅ NEW row actions
                    onActivateDevice={handleActivateDevice}
                    onMaintainDevice={openMaintainModal}
                    activatingId={activatingId}
                />
            ) : (
                <DeviceDetailView
                    t={t}
                    isEn={isEn}
                    selectedDevice={selectedDevice}
                    cruiseInfo={cruiseInfo}
                    batteryInfo={batteryInfo}
                    getEngineStatusText={getEngineStatusText}
                    getVehicleStatusText={getVehicleStatusText}
                    onBack={goBack}
                />
            )}

            <DeviceCommandBarModal
                open={cmd.cmdOpen}
                onClose={cmd.close}
                isEn={isEn}
                t={t}
                cmdQuery={cmd.cmdQuery}
                setCmdQuery={cmd.setCmdQuery}
                cmdLoading={cmd.cmdLoading}
                cmdResults={cmd.cmdResults}
                onRunAction={(a) => {
                    cmd.close();
                    a?.run?.();
                }}
                onSelectDevice={(d) => {
                    cmd.close();
                    handleSelectDevice(d);
                }}
                canEditDevice={canEditDevice}
                canDeleteDevice={canDeleteDevice}
                onEditDevice={(d) => {
                    cmd.close();
                    openEdit(d);
                }}
                onDeleteDevice={(d) => {
                    cmd.close();
                    handleDelete(d);
                }}
            />

            <DeviceUpsertModal
                open={!!modalMode}
                title={modalMode === 'add' ? t.modal.addTitle : t.modal.editTitle}
                t={t}
                form={form}
                onCancel={() => {
                    setModalMode(null);
                    setPendingFormValues(null);
                }}
                onOk={handleSave}
                afterOpenChange={onModalOpenChange}
                deviceCategories={deviceCategories}
                vehicleCategories={vehicleCategories}
                userOptions={userOptions}
                dcLoading={dcLoading}
                vcLoading={vcLoading}
                usersLoading={usersLoading}
                optionsLoading={optionsLoading}
                popupInParent={popupInParent}
                isEn={isEn}
                currentRole={currentRole}
            />

            {/* <DeviceAuditModal
                open={auditOpen}
                onCancel={() => setAuditOpen(false)}
                onOk={handleConfirmAudit}
                isEn={isEn}
                t={t}
                mode={modalMode}
                original={pendingFormValues}
                nextValues={auditNextValues}
                confirmLoading={auditSubmitting}
            /> */}

            {/* ✅ NEW: Confirm maintenance modal */}
            <Modal
                title={isEn ? 'Confirm maintenance' : 'Xác nhận bảo dưỡng'}
                open={confirmOpen}
                onCancel={() => {
                    setConfirmOpen(false);
                    setDeviceToMaintain(null);
                    confirmForm.resetFields();
                }}
                okText={isEn ? 'Confirm' : 'Xác nhận'}
                cancelText={isEn ? 'Cancel' : 'Hủy'}
                onOk={handleConfirmMaintenance}
                confirmLoading={confirming}
                destroyOnHidden
            >
                <div style={{ marginBottom: 12 }}>
                    <b>{isEn ? 'Device:' : 'Thiết bị:'}</b>{' '}
                    {deviceToMaintain?.license_plate || deviceToMaintain?.imei || '-'}
                    <br />
                    <b>IMEI:</b> {deviceToMaintain?.imei || '-'}
                </div>

                <Form layout="vertical" form={confirmForm}>
                    <Form.Item label={isEn ? 'Maintenance date' : 'Ngày bảo dưỡng'} name="maintenanceDate">
                        <DatePicker
                            format="YYYY-MM-DD"
                            allowClear
                            style={{ width: '100%' }}
                            getPopupContainer={(trigger) => trigger.parentElement}
                        />
                    </Form.Item>

                    <Form.Item label={isEn ? 'Note (optional)' : 'Ghi chú (không bắt buộc)'} name="note">
                        <TextArea rows={3} placeholder={isEn ? 'Enter note if needed...' : 'Nhập ghi chú nếu cần...'} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
