/**
 * @file DevicePopup.jsx
 * @description Popup chi tiết thiết bị khi click vào marker trên bản đồ Overview.
 */

'use client';

import React from 'react';

const isOnline = (cruise) => {
    if (!cruise) return false;
    const updated = cruise.updatedAt || cruise.createdAt;
    if (!updated) return false;
    return Date.now() - new Date(updated).getTime() < 24 * 60 * 60 * 1000;
};

const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('vi-VN');
};

export default function DevicePopup({ device, cruise, onClose }) {
    if (!device) return null;

    const online = isOnline(cruise);
    const color = online ? '#22c55e' : '#ef4444';

    return (
        <div
            className="ov-device-popup"
            style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 295,
                zIndex: 1000,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                border: '1px solid #e5e7eb',
                fontFamily: 'system-ui,-apple-system,sans-serif',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    padding: '10px 14px',
                    background: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                        {device.license_plate || device.imei}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span
                        style={{
                            background: 'rgba(255,255,255,0.25)',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 9,
                        }}
                    >
                        {online ? 'Online' : 'Offline'}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            fontSize: 17,
                            cursor: 'pointer',
                            lineHeight: 1,
                            padding: '0 2px',
                        }}
                    >
                        ×
                    </button>
                </div>
            </div>

            <div style={{ padding: '10px 14px' }}>
                {!cruise ? (
                    <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                        Chưa có dữ liệu hành trình
                    </div>
                ) : (
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <tbody>
                            {[
                                ['IMEI', device.imei],
                                ['Lái xe', device.driver || '—'],
                                ['Loại xe', device.vehicle_category_id?.name || '—'],
                                [
                                    'Tọa độ',
                                    cruise.lat && cruise.lon
                                        ? `${cruise.lat.toFixed(5)}, ${cruise.lon.toFixed(5)}`
                                        : '—',
                                ],
                                ['Tốc độ', cruise.spd != null ? `${cruise.spd} km/h` : '—'],
                                ['ODO', cruise.mil != null ? `${cruise.mil.toLocaleString()} km` : '—'],
                                ['ACC', cruise.acc === 1 ? 'Tắt máy' : 'Mở máy'],
                                ['Cập nhật', formatDateTime(cruise.updatedAt || cruise.createdAt)],
                            ].map(([k, v]) => (
                                <tr key={k}>
                                    <td style={{ color: '#6b7280', padding: '3px 0', width: 80 }}>{k}</td>
                                    <td style={{ color: '#111827', fontWeight: 500 }}>{v}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    padding: '10px 14px 12px',
                    borderTop: '1px solid #f3f4f6',
                    background: '#fafafa',
                }}
            >
                <a
                    href={`/cruise?imei=${encodeURIComponent(device.imei || '')}&deviceId=${encodeURIComponent(device._id || '')}`}
                    onClick={() => {
                        try {
                            localStorage.setItem('iky_preselect_imei', device.imei || '');
                            localStorage.setItem('iky_preselect_device_id', device._id || '');
                        } catch (_) {}
                    }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                        cursor: 'pointer',
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                        <line x1="15" y1="6" x2="15" y2="18" />
                    </svg>
                    Hành trình
                </a>

                <a
                    href={`/?imei=${encodeURIComponent(device.imei || '')}&deviceId=${encodeURIComponent(device._id || '')}`}
                    onClick={() => {
                        try {
                            localStorage.setItem('iky_preselect_imei', device.imei || '');
                            localStorage.setItem('iky_preselect_device_id', device._id || '');
                        } catch (_) {}
                    }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: online ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${online ? '#bbf7d0' : '#fecaca'}`,
                        color: online ? '#15803d' : '#dc2626',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                        cursor: 'pointer',
                    }}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="2" />
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
                    </svg>
                    Giám sát
                </a>
            </div>
        </div>
    );
}
