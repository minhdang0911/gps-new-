'use client';

import React from 'react';
import { Modal, Input, List, Divider, Tag, Typography, Space } from 'antd';

const { Text } = Typography;

export default function DeviceCommandBarModal({
    open,
    onClose,
    isEn,
    t,
    cmdQuery,
    setCmdQuery,
    cmdLoading,
    cmdResults,
    onRunAction,
    onSelectDevice,
}) {
    return (
        <Modal title="Command Bar" open={open} onCancel={onClose} footer={null}>
            <Input
                autoFocus
                placeholder={
                    isEn ? 'Try: imei:8600 | plate:E25 | export | add' : 'Thử: imei:8600 | plate:E25 | export | add'
                }
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onPressEnter={() => {
                    const q = (cmdQuery || '').trim().toLowerCase();
                    const act = cmdResults.actions.find((a) => (a.hint || '').toLowerCase() === q);
                    if (act) onRunAction(act);
                }}
            />

            <div style={{ marginTop: 12 }}>
                <Text type="secondary">{isEn ? 'Actions' : 'Hành động'}</Text>
            </div>

            <List
                size="small"
                loading={cmdLoading}
                dataSource={cmdResults.actions}
                renderItem={(a) => (
                    <List.Item
                        key={a.key}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onRunAction(a)}
                        actions={[<Tag key={`${a.key}-hint`}>{a.hint}</Tag>]}
                    >
                        {a.title}
                    </List.Item>
                )}
            />

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ marginTop: 0 }}>
                <Text type="secondary">{isEn ? 'Devices (current page)' : 'Thiết bị (trang hiện tại)'}</Text>
            </div>

            <List
                size="small"
                dataSource={cmdResults.deviceHits}
                locale={{ emptyText: isEn ? 'No matches' : 'Không tìm thấy' }}
                renderItem={(d) => (
                    <List.Item key={d._id} style={{ cursor: 'pointer' }} onClick={() => onSelectDevice(d)}>
                        <Space direction="vertical" size={0}>
                            <Text strong>{d.imei}</Text>
                            <Text type="secondary">
                                {t.plate}: {d.license_plate || '-'} • {t.phone}: {d.phone_number || '-'}
                            </Text>
                        </Space>
                    </List.Item>
                )}
            />
        </Modal>
    );
}
