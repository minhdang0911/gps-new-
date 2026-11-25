// app/manage/devices/hooks/useDeviceMaintenanceActions.js
import { useState, useMemo } from 'react';
import { Form, message } from 'antd';
import dayjs from 'dayjs';
import { startMaintenance, confirmMaintenance } from '../../../lib/api/maintain';

function getConfirmedByFromLocalStorage() {
    if (typeof window === 'undefined') return '';
    const rawValue = localStorage.getItem('userid');
    if (!rawValue) return '';

    const trimmedValue = rawValue.trim();
    if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[') || trimmedValue.startsWith('"')) {
        try {
            const parsedJson = JSON.parse(trimmedValue);
            if (parsedJson && typeof parsedJson === 'object' && parsedJson._id) {
                return String(parsedJson._id);
            }
            if (typeof parsedJson === 'string') return parsedJson;
            return '';
        } catch {
            return trimmedValue;
        }
    }
    return trimmedValue;
}

export function useDeviceMaintenanceActions({ isEnglish }) {
    const [activatingDeviceId, setActivatingDeviceId] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [isConfirmingMaintenance, setIsConfirmingMaintenance] = useState(false);
    const [deviceToMaintain, setDeviceToMaintain] = useState(null);
    const [confirmForm] = Form.useForm();

    const confirmedByUserId = useMemo(() => getConfirmedByFromLocalStorage(), []);

    const handleActivateDevice = async (deviceItem) => {
        if (!deviceItem?._id) {
            message.warning(isEnglish ? 'Invalid device.' : 'Thiết bị không hợp lệ.');
            return;
        }
        try {
            setActivatingDeviceId(deviceItem._id);
            await startMaintenance({ device_id: deviceItem._id });
            message.success(isEnglish ? 'Activated device.' : 'Kích hoạt thiết bị thành công.');
        } catch (error) {
            const backendErrorMessage = error?.response?.data?.message || '';
            if (backendErrorMessage === 'Maintenance already started') {
                message.info(
                    isEnglish ? 'Maintenance already started.' : 'Thiết bị đã được kích hoạt trước đó.'
                );
                return;
            }
            message.error(isEnglish ? 'Activate failed.' : 'Kích hoạt thiết bị thất bại.');
        } finally {
            setActivatingDeviceId(null);
        }
    };

    const openMaintainModal = (deviceItem) => {
        if (!deviceItem) return;
        if (!confirmedByUserId) {
            message.error(
                isEnglish
                    ? 'Missing user info. Please login again.'
                    : 'Không tìm thấy tài khoản. Vui lòng đăng nhập lại.'
            );
            return;
        }
        if (!deviceItem?.imei) {
            message.error(isEnglish ? 'Missing IMEI.' : 'Thiếu IMEI để xác nhận.');
            return;
        }

        setDeviceToMaintain(deviceItem);
        setConfirmModalOpen(true);
        confirmForm.setFieldsValue({
            maintenanceDate: dayjs(),
            note: '',
        });
    };

    const handleConfirmMaintenance = async () => {
        if (!deviceToMaintain?.imei) {
            message.error(isEnglish ? 'Missing IMEI.' : 'Thiếu IMEI để xác nhận.');
            return;
        }
        if (!confirmedByUserId) {
            message.error(isEnglish ? 'Missing user info.' : 'Không tìm thấy tài khoản.');
            return;
        }

        try {
            setIsConfirmingMaintenance(true);
            const formValues = confirmForm.getFieldsValue();
            const dateValue = formValues?.maintenanceDate;
            const formattedMaintenanceDate = dateValue
                ? dayjs(dateValue).format('YYYY-MM-DD')
                : dayjs().format('YYYY-MM-DD');
            const maintenanceNote = formValues?.note?.trim();

            const maintenancePayload = {
                imei: deviceToMaintain.imei,
                confirmedBy: confirmedByUserId,
                maintenanceDate: formattedMaintenanceDate,
            };
            if (maintenanceNote) {
                maintenancePayload.note = maintenanceNote;
            }

            await confirmMaintenance(maintenancePayload);
            message.success(isEnglish ? 'Confirmed maintenance.' : 'Xác nhận bảo dưỡng thành công.');
            setConfirmModalOpen(false);
            setDeviceToMaintain(null);
            confirmForm.resetFields();
        } catch (error) {
            const backendErrorMessage = error?.response?.data?.message || '';
            if (backendErrorMessage.includes('E11000') && backendErrorMessage.includes('imei')) {
                message.info(
                    isEnglish
                        ? 'This maintenance was already confirmed.'
                        : 'Thiết bị chưa đủ điều kiện để bảo dưỡng.'
                );
                setConfirmModalOpen(false);
                setDeviceToMaintain(null);
                confirmForm.resetFields();
                return;
            }
            message.error(isEnglish ? 'Confirm maintenance failed.' : 'Xác nhận bảo dưỡng thất bại.');
        } finally {
            setIsConfirmingMaintenance(false);
        }
    };

    const closeMaintainModal = () => {
        setConfirmModalOpen(false);
        setDeviceToMaintain(null);
        confirmForm.resetFields();
    };

    return {
        activatingDeviceId,
        confirmModalOpen,
        isConfirmingMaintenance,
        deviceToMaintain,
        confirmForm,
        handleActivateDevice,
        openMaintainModal,
        closeMaintainModal,
        handleConfirmMaintenance,
    };
}
