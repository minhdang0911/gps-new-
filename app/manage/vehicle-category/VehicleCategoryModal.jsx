'use client';

import React from 'react';
import { Modal, Form, Input, Select, Spin } from 'antd';

const { Option } = Select;

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
    return (
        <Modal
            open={open}
            title={editingItem ? t.modal.editTitle : t.modal.createTitle}
            onOk={onOk}
            onCancel={onCancel}
            okText={t.modal.okText}
            cancelText={t.modal.cancelText}
            wrapClassName="vc-modal"
            destroyOnClose
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
                        notFoundContent={manuBusy ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {manufacturerOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {opt.label}
                            </Option>
                        ))}
                    </Select>
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
                        notFoundContent={mifBusy ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {mifOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {getMifLabel(opt.value)}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label={t.form.deviceTypeLabel} name="deviceTypeId">
                    <Select
                        allowClear
                        placeholder={t.form.deviceTypePlaceholder}
                        getPopupContainer={popupInParent}
                        loading={dcBusy}
                        disabled={dcBusy}
                        notFoundContent={dcBusy ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {deviceTypeOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {opt.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            </Form>
        </Modal>
    );
}
