'use client';

import React, { useMemo } from 'react';
import { Modal, Form, Input, Select, Spin, Typography } from 'antd';
import { filterVietnameseOption } from '../../util/search';

const { Text } = Typography;

export default function DeviceUpsertModal({
    open,
    title,
    t,
    form,
    onCancel,
    onOk,
    afterOpenChange,
    deviceCategories,
    vehicleCategories,
    userOptions,
    dcLoading,
    vcLoading,
    usersLoading,
    optionsLoading,
    popupInParent,
    isEn,
    currentRole, // ✅ thêm prop này
}) {
    const isDistributorRole = currentRole === 'distributor';

    const deviceCategoryOptions = useMemo(
        () => (deviceCategories || []).map((d) => ({ value: d._id, label: d.name })),
        [deviceCategories],
    );

    const vehicleCategoryOptions = useMemo(
        () => (vehicleCategories || []).map((v) => ({ value: v._id, label: v.name })),
        [vehicleCategories],
    );

    const customerOptions = useMemo(
        () =>
            (userOptions || [])
                .filter((u) => u.position === 'customer')
                .map((u) => ({ value: u._id, label: `${u.email} (${u.username})` })),
        [userOptions],
    );

    const distributorOptions = useMemo(
        () =>
            (userOptions || [])
                .filter((u) => u.position === 'distributor')
                .map((u) => ({ value: u._id, label: `${u.email} (${u.username})` })),
        [userOptions],
    );

    return (
        <Modal
            title={title}
            open={open}
            onCancel={onCancel}
            onOk={onOk}
            okText={t.save}
            width={600}
            confirmLoading={false}
            destroyOnHidden
            afterOpenChange={afterOpenChange}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="imei" label="IMEI" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>

                <Form.Item name="phone_number" label={t.phone}>
                    <Input />
                </Form.Item>

                <Form.Item name="license_plate" label={t.plate}>
                    <Input />
                </Form.Item>

                <Form.Item name="driver" label={t.driver}>
                    <Input />
                </Form.Item>

                <Form.Item name="device_category_id" label={t.deviceType} rules={[{ required: true }]}>
                    <Select
                        placeholder={t.modal.selectDeviceType}
                        getPopupContainer={popupInParent}
                        loading={dcLoading}
                        disabled={dcLoading}
                        notFoundContent={dcLoading ? <Spin size="small" /> : undefined}
                        showSearch
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={deviceCategoryOptions}
                    />
                </Form.Item>

                <Form.Item name="vehicle_category_id" label={t.modal.selectVehicleType}>
                    <Select
                        placeholder={t.modal.selectVehicleType}
                        getPopupContainer={popupInParent}
                        loading={vcLoading}
                        disabled={vcLoading}
                        notFoundContent={vcLoading ? <Spin size="small" /> : undefined}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={vehicleCategoryOptions}
                    />
                </Form.Item>

                <Form.Item name="user_id" label={t.customer}>
                    <Select
                        allowClear
                        placeholder={t.modal.selectCustomer}
                        getPopupContainer={popupInParent}
                        loading={usersLoading}
                        disabled={usersLoading}
                        notFoundContent={usersLoading ? <Spin size="small" /> : undefined}
                        showSearch
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={customerOptions}
                    />
                </Form.Item>

                {/* ✅ CHỈ HIỂN THỊ ĐẠI LÝ KHI KHÔNG PHẢI ROLE DISTRIBUTOR */}
                {!isDistributorRole && (
                    <Form.Item name="distributor_id" label={t.distributor}>
                        <Select
                            allowClear
                            placeholder={t.modal.selectDistributor}
                            getPopupContainer={popupInParent}
                            loading={usersLoading}
                            disabled={usersLoading}
                            notFoundContent={usersLoading ? <Spin size="small" /> : undefined}
                            showSearch
                            optionFilterProp="label"
                            filterOption={filterVietnameseOption}
                            options={distributorOptions}
                        />
                    </Form.Item>
                )}

                {optionsLoading && (
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary">
                            <Spin size="small" /> {isEn ? 'Loading options…' : 'Đang tải danh mục…'}
                        </Text>
                    </div>
                )}
            </Form>
        </Modal>
    );
}
