'use client';

import React, { useMemo, useState } from 'react';
import { Modal, Input, Divider, Checkbox, Button } from 'antd';
import { HolderOutlined, CloseOutlined } from '@ant-design/icons';

import {
    DndContext,
    PointerSensor,
    TouchSensor,
    MouseSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableRow({ id, label, onRemove, disabled }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.75 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        background: '#fff',
        marginBottom: 8,
        cursor: disabled ? 'not-allowed' : 'grab',
        userSelect: 'none',
        touchAction: 'none', // ⭐ quan trọng cho mobile
    };

    return (
        <div ref={setNodeRef} style={style} {...(!disabled ? attributes : {})} {...(!disabled ? listeners : {})}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#94a3b8', display: 'inline-flex' }}>
                    <HolderOutlined />
                </span>
                <span style={{ fontWeight: disabled ? 600 : 500 }}>{label}</span>
            </div>

            {!disabled && (
                <span
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    style={{ color: '#94a3b8', cursor: 'pointer' }}
                >
                    <CloseOutlined />
                </span>
            )}
        </div>
    );
}

export default function ColumnManagerModal({
    open,
    onClose,

    allCols, // [{ key, label }]
    visibleOrder,
    setVisibleOrder,

    storageKey,
    lockedKeys = ['index'],

    texts = {
        title: 'Quản lý cột',
        searchPlaceholder: 'Tìm tên cột',
        visibleTitle: 'Cột hiển thị',
        hint: 'Kéo thả để đổi vị trí. Bỏ tick hoặc bấm X để ẩn cột.',
        apply: 'Áp dụng',
        cancel: 'Huỷ',
        reset: 'Đặt lại',
    },
}) {
    const [q, setQ] = useState('');

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 150, tolerance: 5 },
        }),
        useSensor(PointerSensor),
    );

    const visibleSet = useMemo(() => new Set(visibleOrder), [visibleOrder]);

    const filteredAll = useMemo(() => {
        const qq = q.trim().toLowerCase();
        if (!qq) return allCols;
        return allCols.filter((c) => String(c.label).toLowerCase().includes(qq));
    }, [allCols, q]);

    const rightItems = useMemo(() => {
        const map = new Map(allCols.map((c) => [c.key, c.label]));
        return visibleOrder.map((k) => ({ key: k, label: map.get(k) || k })).filter((x) => x.label);
    }, [allCols, visibleOrder]);

    const toggleCol = (key, checked) => {
        if (lockedKeys.includes(key)) return;

        setVisibleOrder((prev) => {
            const has = prev.includes(key);

            if (checked && !has) {
                const locked = prev.filter((k) => lockedKeys.includes(k));
                const rest = prev.filter((k) => !lockedKeys.includes(k));
                return [...locked, ...rest, key];
            }

            if (!checked && has) return prev.filter((k) => k !== key);
            return prev;
        });
    };

    const onDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;
        if (active.id === over.id) return;
        if (lockedKeys.includes(active.id) || lockedKeys.includes(over.id)) return;

        setVisibleOrder((prev) => {
            const oldIndex = prev.indexOf(active.id);
            const newIndex = prev.indexOf(over.id);
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    const handleApply = () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(visibleOrder));
        } catch {}
        onClose?.();
    };

    const handleReset = () => {
        const keys = allCols.map((c) => c.key);
        const locked = keys.filter((k) => lockedKeys.includes(k));
        const rest = keys.filter((k) => !lockedKeys.includes(k));
        const next = [...locked, ...rest];

        setVisibleOrder(next);
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            afterClose={() => setQ('')}
            title={texts.title}
            width={920}
            okText={texts.apply}
            cancelText={texts.cancel}
            onOk={handleApply}
            footer={(_, { OkBtn, CancelBtn }) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <Button onClick={handleReset}>{texts.reset}</Button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <CancelBtn />
                        <OkBtn />
                    </div>
                </div>
            )}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 480 }}>
                {/* LEFT */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <Input
                        placeholder={texts.searchPlaceholder}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        allowClear
                    />
                    <Divider style={{ margin: '12px 0' }} />

                    <div style={{ maxHeight: 400, overflow: 'auto', paddingRight: 6 }}>
                        {filteredAll.map((c) => (
                            <div
                                key={c.key}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 6px',
                                    borderRadius: 8,
                                }}
                            >
                                <Checkbox
                                    checked={visibleSet.has(c.key)}
                                    disabled={lockedKeys.includes(c.key)}
                                    onChange={(e) => toggleCol(c.key, e.target.checked)}
                                >
                                    {c.label}
                                </Checkbox>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT */}
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>{texts.visibleTitle}</div>

                    <div style={{ maxHeight: 420, overflow: 'auto', paddingRight: 6 }}>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                            <SortableContext
                                items={rightItems.map((x) => x.key)}
                                strategy={verticalListSortingStrategy}
                            >
                                {rightItems.map((item) => (
                                    <SortableRow
                                        key={item.key}
                                        id={item.key}
                                        label={item.label}
                                        disabled={lockedKeys.includes(item.key)}
                                        onRemove={() => toggleCol(item.key, false)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>

                    <div style={{ marginTop: 10, color: '#6b7280', fontSize: 12 }}>{texts.hint}</div>
                </div>
            </div>
        </Modal>
    );
}
