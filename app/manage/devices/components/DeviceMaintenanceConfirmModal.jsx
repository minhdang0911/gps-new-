// app/manage/devices/components/DeviceMaintenanceConfirmModal.jsx
'use client';

import React from 'react';
import { Modal, Form, DatePicker, Input } from 'antd';

const { TextArea } = Input;

export default function DeviceMaintenanceConfirmModal({
    isOpen,
    onCancel,
    onConfirm,
    isConfirming,
    deviceToMaintain,
    form,
    isEnglish,
}) {
    return (
        <Modal
            title={isEnglish ? 'Confirm maintenance' : 'Xác nhận bảo dưỡng'}
            open={isOpen}
            onCancel={onCancel}
            okText={isEnglish ? 'Confirm' : 'Xác nhận'}
            cancelText={isEnglish ? 'Cancel' : 'Hủy'}
            onOk={onConfirm}
            confirmLoading={isConfirming}
            destroyOnHidden
        >
            <div style={{ marginBottom: 12 }}>
                <b>{isEnglish ? 'Device:' : 'Thiết bị:'}</b>{' '}
                {deviceToMaintain?.license_plate || deviceToMaintain?.imei || '-'}
                <br />
                <b>IMEI:</b> {deviceToMaintain?.imei || '-'}
            </div>

            <Form layout="vertical" form={form}>
                <Form.Item
                    label={isEnglish ? 'Maintenance date' : 'Ngày bảo dưỡng'}
                    name="maintenanceDate"
                >
                    <DatePicker
                        format="YYYY-MM-DD"
                        allowClear
                        style={{ width: '100%' }}
                        getPopupContainer={(triggerNode) => triggerNode.parentElement}
                    />
                </Form.Item>

                <Form.Item
                    label={isEnglish ? 'Note (optional)' : 'Ghi chú (không bắt buộc)'}
                    name="note"
                >
                    <TextArea
                        rows={3}
                        placeholder={
                            isEnglish ? 'Enter note if needed...' : 'Nhập ghi chú nếu cần...'
                        }
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
