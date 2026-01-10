'use client';

import React, { useMemo } from 'react';
import { Modal, List, Typography, Tag, Space, Empty } from 'antd';

const { Text } = Typography;

function normalize(v) {
    if (v === undefined || v === null || v === '') return '-';
    if (typeof v === 'string') return v.trim();
    return String(v);
}

export default function DeviceAuditModal({
    open,
    onCancel,
    onOk,
    isEn,
    t,
    mode, // 'add' | 'edit'
    original, // pendingFormValues (edit)
    nextValues, // values from form
    confirmLoading = { confirmLoading },
}) {
    const diffs = useMemo(() => {
        if (!open) return [];

        if (mode === 'add') {
            // add: show all non-empty fields as "new"
            return Object.entries(nextValues || {})
                .filter(([, val]) => normalize(val) !== '-')
                .map(([key, val]) => ({ key, from: '-', to: normalize(val) }));
        }

        // edit: compare original vs next
        const o = original || {};
        const n = nextValues || {};
        const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]));

        return keys
            .map((k) => ({
                key: k,
                from: normalize(o[k]),
                to: normalize(n[k]),
            }))
            .filter((x) => x.from !== x.to);
    }, [open, mode, original, nextValues]);

    const title = isEn
        ? mode === 'add'
            ? 'Review new device'
            : 'Review changes'
        : mode === 'add'
        ? 'Xem lại thiết bị mới'
        : 'Xem lại thay đổi';

    return (
        <Modal
            open={open}
            title={title}
            onCancel={onCancel}
            onOk={onOk}
            okText={isEn ? 'Confirm' : 'Xác nhận'}
            cancelText={isEn ? 'Back' : 'Quay lại'}
            width={720}
        >
            {diffs.length === 0 ? (
                <Empty description={isEn ? 'No changes detected' : 'Không có thay đổi'} />
            ) : (
                <List
                    bordered
                    dataSource={diffs}
                    renderItem={(it) => (
                        <List.Item>
                            <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                <Text strong>{it.key}</Text>
                                <Space wrap>
                                    <Tag>
                                        {isEn ? 'From' : 'Từ'}: {it.from}
                                    </Tag>
                                    <Tag color="blue">
                                        {isEn ? 'To' : 'Thành'}: {it.to}
                                    </Tag>
                                </Space>
                            </Space>
                        </List.Item>
                    )}
                />
            )}
            {/* 
            <div style={{ marginTop: 10 }}>
                <Text type="secondary">
                    {isEn
                        ? 'Tip: This is a local review step to prevent mistakes.'
                        : 'Gợi ý: Đây là bước review local để tránh sửa/xoá nhầm.'}
                </Text>
            </div> */}
        </Modal>
    );
}
