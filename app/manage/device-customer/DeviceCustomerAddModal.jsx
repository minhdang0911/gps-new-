'use client';

import React from 'react';
import { Modal, Form, Select, Spin } from 'antd';

const { Option } = Select;

export default function DeviceCustomerAddModal({
    open,
    t,
    form,
    onOk,
    onCancel,
    allDevices,
    allDevicesBusy,
    popupInParent,
}) {
    return (
        <Modal
            open={open}
            title={t.modal.title}
            onOk={onOk}
            onCancel={onCancel}
            okText={t.modal.okText}
            cancelText={t.modal.cancelText}
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    label={t.modal.imeiLabel}
                    name="imei"
                    rules={[{ required: true, message: t.modal.imeiRequired }]}
                >
                    <Select
                        showSearch
                        placeholder={t.modal.imeiPlaceholder}
                        loading={allDevicesBusy}
                        disabled={allDevicesBusy}
                        notFoundContent={allDevicesBusy ? <Spin size="small" /> : null}
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            String(option?.children || '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        getPopupContainer={popupInParent}
                    >
                        {allDevices.map((d) => (
                            <Option key={d._id} value={d.imei}>
                                {d.imei} {d.license_plate ? ` - ${d.license_plate}` : ''}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
}
