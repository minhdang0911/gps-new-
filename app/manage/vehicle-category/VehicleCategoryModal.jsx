'use client';

import React, { useMemo } from 'react';
import { Modal, Form, Input, Select, Spin } from 'antd';
import { filterVietnameseOption } from '../../util/search';

export default function VehicleCategoryModal({
    open,
    editingItem,
    t,
    form,
    onOk,
    onCancel,
    popupInParent,
    manuBusy,
    mifBusy,
    dcBusy,
    manufacturerOptions,
    mifOptions,
    deviceTypeOptions,
    getMifLabel,
}) {
    const formattedMifOptions = useMemo(
        () => (mifOptions || []).map((opt) => ({ value: opt.value, label: getMifLabel(opt.value) })),
        [mifOptions, getMifLabel],
    );

    return (
        <Modal
            open={open}
            title={editingItem ? t.modal.editTitle : t.modal.createTitle}
            onOk={onOk}
            onCancel={onCancel}
            okText={t.modal.okText}
            cancelText={t.modal.cancelText}
            wrapClassName="vc-modal"
            destroyOnHidden
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    label={t.form.nameLabel}
                    name="name"
                    rules={[{ required: true, message: t.form.nameRequired }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label={t.form.manufacturerLabel}
                    name="manufacturer"
                    rules={[{ required: true, message: t.form.manufacturerRequired }]}
                >
                    <Select
                        placeholder={t.form.manufacturerLabel}
                        getPopupContainer={popupInParent}
                        loading={manuBusy}
                        disabled={manuBusy}
                        notFoundContent={manuBusy ? <Spin size="small" /> : undefined}
                        showSearch
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={manufacturerOptions}
                    />
                </Form.Item>

                <Form.Item
                    label={t.form.yearLabel}
                    name="year"
                    rules={[{ required: true, message: t.form.yearRequired }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label={t.form.modelLabel}
                    name="model"
                    rules={[{ required: true, message: t.form.modelRequired }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label={t.form.originLabel}
                    name="madeInFrom"
                    rules={[{ required: true, message: t.form.originRequired }]}
                >
                    <Select
                        placeholder={t.form.originPlaceholder}
                        getPopupContainer={popupInParent}
                        loading={mifBusy}
                        disabled={mifBusy}
                        notFoundContent={mifBusy ? <Spin size="small" /> : undefined}
                        showSearch
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={formattedMifOptions}
                    />
                </Form.Item>

                <Form.Item label={t.form.deviceTypeLabel} name="deviceTypeId">
                    <Select
                        allowClear
                        placeholder={t.form.deviceTypePlaceholder}
                        getPopupContainer={popupInParent}
                        loading={dcBusy}
                        disabled={dcBusy}
                        notFoundContent={dcBusy ? <Spin size="small" /> : undefined}
                        showSearch
                        optionFilterProp="label"
                        filterOption={filterVietnameseOption}
                        options={deviceTypeOptions}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
