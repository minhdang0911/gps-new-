'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Modal, Input, List, Divider, Tag, Typography, Space, Button, Tooltip, Popconfirm } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

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

    canEditDevice,
    canDeleteDevice,
    onEditDevice,
    onDeleteDevice,
}) {
    const hits = cmdResults?.deviceHits || [];
    const actions = cmdResults?.actions || [];

    const [activeIndex, setActiveIndex] = useState(0);

    // ===== Stable refs to avoid re-binding keydown listener =====
    const openRef = useRef(open);
    const hitsRef = useRef(hits);
    const actionsRef = useRef(actions);
    const activeIndexRef = useRef(activeIndex);

    const canEditRef = useRef(canEditDevice);
    const canDeleteRef = useRef(canDeleteDevice);

    const onCloseRef = useRef(onClose);
    const onSelectDeviceRef = useRef(onSelectDevice);
    const onEditDeviceRef = useRef(onEditDevice);
    const onDeleteDeviceRef = useRef(onDeleteDevice);

    useEffect(() => {
        openRef.current = open;
    }, [open]);

    useEffect(() => {
        hitsRef.current = hits;
    }, [hits]);

    useEffect(() => {
        actionsRef.current = actions;
    }, [actions]);

    useEffect(() => {
        activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    useEffect(() => {
        canEditRef.current = canEditDevice;
    }, [canEditDevice]);

    useEffect(() => {
        canDeleteRef.current = canDeleteDevice;
    }, [canDeleteDevice]);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        onSelectDeviceRef.current = onSelectDevice;
    }, [onSelectDevice]);

    useEffect(() => {
        onEditDeviceRef.current = onEditDevice;
    }, [onEditDevice]);

    useEffect(() => {
        onDeleteDeviceRef.current = onDeleteDevice;
    }, [onDeleteDevice]);

    // ===== Reset activeIndex when opening modal or query changes =====
    // Avoid "setState synchronously within an effect" by deferring via rAF
    useEffect(() => {
        if (!open) return;

        const id = requestAnimationFrame(() => {
            setActiveIndex(0);
        });

        return () => cancelAnimationFrame(id);
    }, [open, cmdQuery]);

    // ===== Clamp activeIndex if hits length changes =====
    useEffect(() => {
        if (!open) return;

        const id = requestAnimationFrame(() => {
            setActiveIndex((i) => {
                const max = Math.max(hits.length - 1, 0);
                return Math.min(i, max);
            });
        });

        return () => cancelAnimationFrame(id);
    }, [open, hits.length]);

    // ===== Keydown listener: bind once =====
    useEffect(() => {
        const onKeyDown = (e) => {
            if (!openRef.current) return;

            // don't handle shortcuts while typing in input/textarea
            const tag = (e.target?.tagName || '').toLowerCase();
            const isTyping = tag === 'input' || tag === 'textarea';
            if (isTyping) return;

            const curHits = hitsRef.current || [];
            const curIndex = activeIndexRef.current || 0;

            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseRef.current?.();
                return;
            }

            if (e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, Math.max(curHits.length - 1, 0)));
                return;
            }

            if (e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                const d = curHits[curIndex];
                if (d) onSelectDeviceRef.current?.(d);
                return;
            }

            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                const d = curHits[curIndex];
                if (d && canEditRef.current) onEditDeviceRef.current?.(d);
                return;
            }

            if (e.key === 'Delete') {
                e.preventDefault();
                const d = curHits[curIndex];
                if (d && canDeleteRef.current) onDeleteDeviceRef.current?.(d);
                return;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const handlePressEnter = useCallback(() => {
        const q = (cmdQuery || '').trim().toLowerCase();
        const act = (actions || []).find((a) => (a.hint || '').toLowerCase() === q);
        if (act) onRunAction?.(act);
    }, [cmdQuery, actions, onRunAction]);

    return (
        <Modal title="Command Bar" open={open} onCancel={onClose} footer={null} width={760}>
            <Input
                autoFocus
                placeholder={
                    isEn ? 'Try: imei:8600 | plate:E25 | export | add' : 'Thử: imei:8600 | plate:E25 | export | add'
                }
                value={cmdQuery}
                onChange={(e) => {
                    setCmdQuery(e.target.value);
                    // optional: reset immediately on typing too (no warning)
                    setActiveIndex(0);
                }}
                onPressEnter={handlePressEnter}
            />

            <div style={{ marginTop: 12 }}>
                <Text type="secondary">{isEn ? 'Actions' : 'Hành động'}</Text>
            </div>

            <List
                size="small"
                loading={cmdLoading}
                dataSource={actions}
                renderItem={(a) => (
                    <List.Item
                        key={a.key}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onRunAction?.(a)}
                        actions={[<Tag key={`${a.key}-hint`}>{a.hint}</Tag>]}
                    >
                        {a.title}
                    </List.Item>
                )}
            />

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">{isEn ? 'Devices (current page)' : 'Thiết bị (trang hiện tại)'}</Text>
                <Text type="secondary">
                    {isEn
                        ? 'J/K: move • Enter: view • E: edit • Del: delete'
                        : 'J/K: di chuyển • Enter: xem • E: sửa • Del: xoá'}
                </Text>
            </div>

            <List
                size="small"
                dataSource={hits}
                locale={{ emptyText: isEn ? 'No matches' : 'Không tìm thấy' }}
                renderItem={(d, idx) => {
                    const isActive = idx === activeIndex;

                    return (
                        <List.Item
                            key={d._id}
                            style={{
                                cursor: 'pointer',
                                borderRadius: 8,
                                background: isActive ? 'rgba(24,144,255,0.08)' : undefined,
                            }}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => onSelectDevice?.(d)}
                            actions={[
                                <Tooltip key="view" title={isEn ? 'View' : 'Xem'}>
                                    <Button
                                        size="small"
                                        icon={<EyeOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectDevice?.(d);
                                        }}
                                    />
                                </Tooltip>,

                                <Tooltip key="edit" title={isEn ? 'Edit' : 'Sửa'}>
                                    <Button
                                        size="small"
                                        icon={<EditOutlined />}
                                        disabled={!canEditDevice}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canEditDevice) onEditDevice?.(d);
                                        }}
                                    />
                                </Tooltip>,

                                <Popconfirm
                                    key="del"
                                    title={isEn ? 'Delete this device?' : 'Xoá thiết bị này?'}
                                    okText={isEn ? 'Delete' : 'Xoá'}
                                    cancelText={isEn ? 'Cancel' : 'Huỷ'}
                                    onConfirm={(e) => {
                                        e?.stopPropagation?.();
                                        if (canDeleteDevice) onDeleteDevice?.(d);
                                    }}
                                    disabled={!canDeleteDevice}
                                >
                                    <Tooltip
                                        title={
                                            canDeleteDevice
                                                ? isEn
                                                    ? 'Delete'
                                                    : 'Xoá'
                                                : isEn
                                                ? 'No permission'
                                                : 'Không có quyền'
                                        }
                                    >
                                        <Button
                                            size="small"
                                            danger
                                            icon={<DeleteOutlined />}
                                            disabled={!canDeleteDevice}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </Tooltip>
                                </Popconfirm>,
                            ]}
                        >
                            <Space direction="vertical" size={0}>
                                <Text strong>{d.imei}</Text>
                                <Text type="secondary">
                                    {t.plate}: {d.license_plate || '-'} • {t.phone}: {d.phone_number || '-'}
                                </Text>
                            </Space>
                        </List.Item>
                    );
                }}
            />
        </Modal>
    );
}
