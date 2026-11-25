/**
 * @file DeviceTable.jsx
 * @description Bảng danh sách thiết bị có phân trang, tìm kiếm, và sắp xếp tốc độ cao.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Pagination } from 'antd';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import DeviceTableRow from './DeviceTableRow';

const isOnlineCruise = (cruise) => {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

export default function DeviceTable({ devices = [], cruiseByImei = {}, isEn, onlineMap }) {
    const t = (vi, en) => (isEn ? en : vi);
    const [sortKey, setSortKey] = useState('status');
    const [sortDir, setSortDir] = useState('asc');
    const [tableSearch, setTableSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const handleSort = (key) => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('asc'); }
        setPage(1);
    };

    const SortIcon = ({ col }) => {
        if (sortKey !== col) return <ArrowUpDown size={11} style={{ opacity: 0.35 }} />;
        return sortDir === 'asc' ? <ArrowUp size={11} style={{ color: '#1677ff' }} /> : <ArrowDown size={11} style={{ color: '#1677ff' }} />;
    };

    const rows = useMemo(() => {
        const kw = tableSearch.trim().toLowerCase();
        let list = devices.filter((d) => {
            if (!kw) return true;
            return (
                (d.license_plate || '').toLowerCase().includes(kw) ||
                (d.imei || '').toLowerCase().includes(kw) ||
                (d.driver || '').toLowerCase().includes(kw)
            );
        });

        return [...list].sort((a, b) => {
            const ca = cruiseByImei[a.imei];
            const cb = cruiseByImei[b.imei];
            let va, vb;
            if (sortKey === 'status') {
                const aOn = onlineMap ? onlineMap.get(a.imei) : isOnlineCruise(ca);
                const bOn = onlineMap ? onlineMap.get(b.imei) : isOnlineCruise(cb);
                va = aOn ? 0 : 1;
                vb = bOn ? 0 : 1;
            } else if (sortKey === 'plate') {
                va = (a.license_plate || a.imei || '').toLowerCase();
                vb = (b.license_plate || b.imei || '').toLowerCase();
            } else if (sortKey === 'spd') {
                va = ca?.spd ?? -1;
                vb = cb?.spd ?? -1;
            } else if (sortKey === 'mil') {
                va = Number(ca?.mil ?? -1);
                vb = Number(cb?.mil ?? -1);
            } else if (sortKey === 'updated') {
                va = new Date(ca?.updatedAt || ca?.createdAt || 0).getTime();
                vb = new Date(cb?.updatedAt || cb?.createdAt || 0).getTime();
            } else if (sortKey === 'exp') {
                va = new Date(a.date_exp || 0).getTime();
                vb = new Date(b.date_exp || 0).getTime();
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [devices, cruiseByImei, onlineMap, sortKey, sortDir, tableSearch]);

    const paginatedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return rows.slice(start, start + pageSize);
    }, [rows, page, pageSize]);

    const thStyle = (col) => ({
        padding: '10px 12px', textAlign: col === 'spd' || col === 'mil' ? 'right' : col === 'action' ? 'center' : 'left',
        fontSize: 11.5, fontWeight: 700, color: '#475569',
        borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
        cursor: col === 'action' ? 'default' : 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                <input
                    value={tableSearch}
                    onChange={(e) => { setTableSearch(e.target.value); setPage(1); }}
                    placeholder={isEn ? 'Filter by plate / IMEI / driver…' : 'Lọc biển số / IMEI / tài xế…'}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 12, outline: 'none', width: 240, color: '#0f172a' }}
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>
                    {t(`Tổng cộng: ${rows.length} thiết bị`, `Total: ${rows.length} devices`)}
                </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr>
                            <th style={thStyle('status')} onClick={() => handleSort('status')}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('Trạng thái', 'Status')} <SortIcon col="status" /></span>
                            </th>
                            <th style={thStyle('plate')} onClick={() => handleSort('plate')}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('Biển số / IMEI', 'Plate / IMEI')} <SortIcon col="plate" /></span>
                            </th>
                            <th style={thStyle('driver')}>{t('Tài xế', 'Driver')}</th>
                            <th style={thStyle('type')}>{t('Loại xe', 'Type')}</th>
                            <th style={thStyle('spd')} onClick={() => handleSort('spd')}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('Tốc độ', 'Speed')} <SortIcon col="spd" /></span>
                            </th>
                            <th style={thStyle('mil')} onClick={() => handleSort('mil')}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('ODO', 'Odometer')} <SortIcon col="mil" /></span>
                            </th>
                            <th style={thStyle('updated')} onClick={() => handleSort('updated')}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('Cập nhật', 'Updated')} <SortIcon col="updated" /></span>
                            </th>
                            <th style={thStyle('exp')} onClick={() => handleSort('exp')}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{t('Hết hạn', 'Expires')} <SortIcon col="exp" /></span>
                            </th>
                            <th style={thStyle('action')}>{t('Thao tác', 'Action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedRows.map((d, i) => (
                            <DeviceTableRow key={d._id || d.imei} device={d} cruise={cruiseByImei[d.imei]} index={i} onlineMap={onlineMap} isEn={isEn} />
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                    {tableSearch ? t('Không tìm thấy kết quả', 'No results found') : t('Không có thiết bị', 'No devices')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {rows.length > pageSize && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8, padding: '4px 2px' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                        {t(`Hiển thị ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, rows.length)} trong ${rows.length} thiết bị`,
                           `Showing ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, rows.length)} of ${rows.length} devices`)}
                    </span>
                    <Pagination
                        size="small"
                        current={page}
                        pageSize={pageSize}
                        total={rows.length}
                        showSizeChanger
                        pageSizeOptions={['25', '50', '100', '200']}
                        onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
                    />
                </div>
            )}
        </div>
    );
}
