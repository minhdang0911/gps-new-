'use client';

import React from 'react';
import { Modal, Form, Input, Select, Spin } from 'antd';

const { Option } = Select;

export default function DeviceCategoryModal({
    open,
    onCancel,
    onOk,
    form,
    t,
    editingItem,
    mifOptions,
    getMadeInFromLabel,
    showMifLoading,
    popupInParent,
}) {
    return (
        <Modal
            open={open}
            title={editingItem ? t.modal.editTitle : t.modal.createTitle}
            onOk={onOk}
            onCancel={onCancel}
            okText={t.modal.okText}
            cancelText={t.modal.cancelText}
            wrapClassName="dc-modal"
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    label={t.form.codeLabel}
                    name="code"
                    rules={[{ required: true, message: t.form.codeRequired }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    label={t.form.nameLabel}
                    name="name"
                    rules={[{ required: true, message: t.form.nameRequired }]}
                >
                    <Input />
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
                        loading={showMifLoading}
                        disabled={showMifLoading}
                        notFoundContent={showMifLoading ? <Spin size="small" /> : null}
                        showSearch
                        optionFilterProp="children"
                    >
                        {mifOptions.map((opt) => (
                            <Option key={opt.value} value={opt.value}>
                                {getMadeInFromLabel(opt.value)}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label={t.form.descLabel} name="description">
                    <Input.TextArea rows={3} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
