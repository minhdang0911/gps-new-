'use client';

import React, { useMemo } from 'react';
import { Modal, Form, Select, Spin } from 'antd';
import { filterVietnameseOption } from '../../util/search';

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
    const deviceOptions = useMemo(
        () =>
            (allDevices || []).map((d) => ({
                value: d.imei,
                label: `${d.imei}${d.license_plate ? ` - ${d.license_plate}` : ''}`,
            })),
        [allDevices],
    );

    return (
        <Modal
            open={open}
            title={t.modal.title}
            onOk={onOk}
            onCancel={onCancel}
            okText={t.modal.okText}
            cancelText={t.modal.cancelText}
            destroyOnHidden
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
                        notFoundContent={allDevicesBusy ? <Spin size="small" /> : undefined}
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={deviceOptions}
                        getPopupContainer={popupInParent}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
