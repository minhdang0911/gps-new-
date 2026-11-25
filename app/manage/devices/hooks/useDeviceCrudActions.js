// app/manage/devices/hooks/useDeviceCrudActions.js
import { useState } from 'react';
import { Form, message } from 'antd';
import { createDevice, updateDevice, deleteDevice } from '../../../lib/api/devices';
import { buildPendingFormValues, validatePhone, extractErrorMsg } from '../../../util/manageDevices/deviceFormHandlers';
import { useUndoDeleteToast } from '../../../hooks/common/useUndoDeleteToast';

const SCROLL_SESSION_KEY = 'iky_devices_scroll';

export function useDeviceCrudActions({
    canAddDevice,
    canEditDevice,
    canDeleteDevice,
    refreshOptions,
    mutateDevices,
    destroyMap,
    isEn,
    t,
}) {
    const [viewMode, setViewMode] = useState('list');
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [modalMode, setModalMode] = useState(null);
    const [pendingFormValues, setPendingFormValues] = useState(null);
    const [form] = Form.useForm();

    const openAdd = () => {
        if (!canAddDevice) return message.warning(t.noPermissionAdd);
        setSelectedDevice(null);
        setPendingFormValues(null);
        refreshOptions?.();
        setModalMode('add');
    };

    const openEdit = (item) => {
        if (!canEditDevice) return message.warning(t.noPermissionEdit);
        setSelectedDevice(item);
        setPendingFormValues(buildPendingFormValues(item));
        refreshOptions?.();
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
                await updateDevice(selectedDevice._id, payload);
                message.success(t.updateSuccess);
            } else if (modalMode === 'add') {
                await createDevice(payload);
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
        setTimeout(() => {
            try {
                const saved = sessionStorage.getItem(SCROLL_SESSION_KEY);
                if (saved) window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' });
            } catch {}
        }, 50);
    };

    const handleSelectDevice = (item) => {
        try { sessionStorage.setItem(SCROLL_SESSION_KEY, String(window.scrollY)); } catch {}
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
            renderTitle: (it) => (<span>{isEn ? 'Deleting device ' : 'Đang xoá thiết bị'} <b>{it?.imei}</b></span>),
            renderUndoText: () => (isEn ? 'Undo' : 'Hoàn tác'),
            renderCountdownText: (remainMs) => (<>{isEn ? 'Finalizing in ' : 'Xoá sau '}<b>{Math.ceil(remainMs / 1000)}</b>{isEn ? 's' : ' giây'}</>),
            optimisticRemove: () => {
                mutateDevices((prev) => (!prev?.devices ? prev : { ...prev, devices: prev.devices.filter((d) => d._id !== item._id) }), { revalidate: false });
            },
            rollback: () => mutateDevices(),
            apiDelete: () => deleteDevice(item._id),
            onSuccess: () => { message.success(t.deleteSuccess); mutateDevices(); },
            onError: (err) => message.error(extractErrorMsg(err, isEn)),
        });
    };

    return {
        viewMode,
        selectedDevice,
        modalMode,
        setModalMode,
        pendingFormValues,
        setPendingFormValues,
        form,
        openAdd,
        openEdit,
        handleSave,
        goBack,
        handleSelectDevice,
        handleDelete,
    };
}
