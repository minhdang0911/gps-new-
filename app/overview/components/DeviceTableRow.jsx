/**
 * @file DeviceTableRow.jsx
 * @description Dòng dữ liệu thiết bị đơn lẻ trong bảng DeviceTable.
 */

'use client';

import React from 'react';

const isOnlineCruise = (cruise) => {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

const formatUpdated = (cruise) => {
    if (!cruise) return '—';
    const d = cruise.updatedAt || cruise.createdAt;
    if (!d) return '—';
    return new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
};

const formatExp = (dateExp) => {
    if (!dateExp) return '—';
    const d = new Date(dateExp);
    const diff = d - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const str = d.toLocaleDateString('vi-VN');
    if (days < 0) return <span style={{ color: '#dc2626', fontWeight: 600 }}>{str} (Hết hạn)</span>;
    if (days <= 30) return <span style={{ color: '#d97706', fontWeight: 600 }}>{str} ({days} ngày)</span>;
    return <span style={{ color: '#16a34a' }}>{str}</span>;
};

export default function DeviceTableRow({ device: d, cruise, index: i, onlineMap, isEn }) {
    const t = (vi, en) => (isEn ? en : vi);
    const online = onlineMap ? Boolean(onlineMap.get(d.imei)) : isOnlineCruise(cruise);
    const moving = online && cruise?.acc === 0;

    return (
        <tr
            style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', transition: 'background .1s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'; }}
        >
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 20,
                    background: online ? (moving ? '#eff6ff' : '#f0fdf4') : '#fef2f2',
                    color: online ? (moving ? '#1d4ed8' : '#15803d') : '#dc2626',
                    border: `1px solid ${online ? (moving ? '#bfdbfe' : '#bbf7d0') : '#fecaca'}`,
                }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                    {online ? (moving ? t('Đang chạy', 'Moving') : t('Online', 'Online')) : t('Offline', 'Offline')}
                </span>
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#0f172a' }}>
                {d.license_plate || '—'}
                <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400, marginTop: 1 }}>{d.imei}</div>
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                {d.driver || '—'}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                {d.vehicle_category_id?.name || '—'}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: cruise?.spd > 0 ? 700 : 400, color: cruise?.spd > 80 ? '#dc2626' : cruise?.spd > 0 ? '#1677ff' : '#94a3b8' }}>
                {cruise?.spd != null ? `${cruise.spd} km/h` : '—'}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#475569' }}>
                {cruise?.mil != null ? `${Number(cruise.mil).toLocaleString()} km` : '—'}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#64748b', whiteSpace: 'nowrap' }}>
                {formatUpdated(cruise)}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', color: '#475569' }}>
                {formatExp(d.date_exp)}
            </td>
            <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <a
                    href={`/cruise?imei=${encodeURIComponent(d.imei || '')}`}
                    title={t('Xem hành trình', 'View Route')}
                    style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: 7, background: '#eff6ff',
                        border: '1px solid #bfdbfe', color: '#1d4ed8', textDecoration: 'none', marginRight: 5,
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="6" x2="15" y2="18" />
                    </svg>
                </a>
                <a
                    href={`/?imei=${encodeURIComponent(d.imei || '')}&deviceId=${encodeURIComponent(d._id || '')}`}
                    onClick={() => {
                        try {
                            localStorage.setItem('iky_preselect_imei', d.imei || '');
                            localStorage.setItem('iky_preselect_device_id', d._id || '');
                        } catch (_) {}
                    }}
                    title={t('Giám sát', 'Monitor')}
                    style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: 7,
                        background: online ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${online ? '#bbf7d0' : '#fecaca'}`,
                        color: online ? '#15803d' : '#dc2626', textDecoration: 'none',
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="2" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                </a>
            </td>
        </tr>
    );
}
