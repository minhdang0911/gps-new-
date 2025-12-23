'use client';

import React, { useMemo } from 'react';
import { Modal, Table, Tag, Tooltip, Divider, Button } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

const formatValue = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.join(', ');
    if (isPlainObject(v)) return JSON.stringify(v);
    return String(v);
};

const getRowTitle = (row, idx) => {
    // Chỉ hiển thị số thứ tự, không hiển thị ID
    return `Mẫu ${idx + 1}`;
};

const flattenColumns = (cols) => {
    const out = [];
    (cols || []).forEach((c) => {
        if (!c) return;
        if (Array.isArray(c.children) && c.children.length) out.push(...flattenColumns(c.children));
        else out.push(c);
    });
    return out;
};

const getValByDataIndex = (record, dataIndex) => {
    if (!record) return undefined;
    if (Array.isArray(dataIndex)) return dataIndex.reduce((acc, k) => (acc ? acc[k] : undefined), record);
    return record[dataIndex];
};

const buildCompareRowsFromColumns = (selectedRows, uiColumns, colLabelMap) => {
    const cols = flattenColumns(uiColumns || []);

    const usableCols = cols.filter((c) => {
        const di = c?.dataIndex;
        const hasDataIndex = di !== undefined && di !== null && di !== '';
        if (!hasDataIndex) return false;

        // bỏ mấy cột kỹ thuật
        if (c?.key === '__rowNo' || di === '__rowNo') return false;
        if (c?.key === 'selection') return false;

        return true;
    });

    return usableCols.map((col, colIdx) => {
        const k = col?.key || (Array.isArray(col?.dataIndex) ? col.dataIndex.join('.') : col?.dataIndex);

        const fieldLabel = colLabelMap?.get(k) || k;

        const rowObj = {
            field: fieldLabel,
            __key: `${k}__${colIdx}`,
        };

        selectedRows.forEach((r, idx) => {
            const rawValue = getValByDataIndex(r, col.dataIndex);
            rowObj[`v${idx}`] = formatValue(rawValue);
        });

        return rowObj;
    });
};

export default function ReportCompareModal({
    open,
    onClose,
    rows = [],
    uiColumns = [],
    colLabelMap,
    ctx,
    buildInsight, // optional
    width,
    tipText,
}) {
    const compareData = useMemo(
        () => buildCompareRowsFromColumns(rows, uiColumns, colLabelMap),
        [rows, uiColumns, colLabelMap],
    );

    const insight = useMemo(() => {
        if (typeof buildInsight !== 'function') return null;
        return buildInsight(rows, ctx);
    }, [rows, ctx, buildInsight]);

    const columns = useMemo(() => {
        const base = [
            {
                title: ctx?.isEn ? 'Field' : 'Trường',
                dataIndex: 'field',
                key: 'field',
                width: 260,
                fixed: 'left',
                render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
            },
        ];

        const dyn = rows.map((r, idx) => ({
            title: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>{ctx?.isEn ? `Item ${idx + 1}` : `Mẫu ${idx + 1}`}</span>
                    {/* <Tag style={{ marginInlineEnd: 0, width: 'fit-content' }}>{getRowTitle(r)}</Tag> */}
                </div>
            ),
            dataIndex: `v${idx}`,
            key: `v${idx}`,
            width: 360,
            render: (v) => (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {v === '' ? <span style={{ color: '#94a3b8' }}>—</span> : v}
                </div>
            ),
        }));

        return [...base, ...dyn];
    }, [rows, ctx?.isEn]);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={ctx?.isEn ? 'Compare' : 'So sánh'}
            width={width || Math.min(1200, 420 + (rows?.length || 0) * 380)}
            footer={[
                <Button key="close" onClick={onClose}>
                    {ctx?.isEn ? 'Close' : 'Đóng'}
                </Button>,
            ]}
        >
            <div style={{ marginBottom: 10, color: '#6b7280', fontSize: 12 }}>
                {tipText || (ctx?.isEn ? 'Tip: Select 2–3 rows to compare.' : 'Tip: Tick chọn 2–3 dòng để so sánh.')}
            </div>

            {insight && (
                <div
                    style={{
                        border: '1px solid #e5e7eb',
                        background: '#f8fafc',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 12,
                    }}
                >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>🔍 {insight.headline}</div>

                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {(insight.lines || []).map((line, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                                <span>{line.text}</span>

                                {line.tooltip ? (
                                    <Tooltip
                                        title={
                                            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                                                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                                    {ctx?.isEn ? 'Formula' : 'Công thức'}
                                                </div>
                                                <div style={{ marginBottom: 6 }}>
                                                    {line.tooltip.formula} ≈ <b>{line.tooltip.value}</b>
                                                </div>
                                                {line.tooltip.explain ? (
                                                    <div style={{ color: '#64748b' }}>{line.tooltip.explain}</div>
                                                ) : null}
                                            </div>
                                        }
                                    >
                                        <span
                                            style={{
                                                marginLeft: 8,
                                                cursor: 'help',
                                                textDecoration: 'underline dotted',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                            }}
                                        >
                                            {ctx?.isEn ? 'How calculated' : 'Cách tính'} <InfoCircleOutlined />
                                        </span>
                                    </Tooltip>
                                ) : null}
                            </li>
                        ))}
                    </ul>

                    {insight.warnings?.length ? <Divider style={{ margin: '10px 0' }} /> : null}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(insight.warnings || []).map((w, i) => (
                            <div key={i} style={{ color: '#b45309' }}>
                                ⚠️ {w}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <Table
                rowKey="__key"
                columns={columns}
                dataSource={compareData}
                pagination={false}
                size="small"
                scroll={{ x: 260 + (rows?.length || 0) * 360, y: 420 }}
            />
        </Modal>
    );
}
