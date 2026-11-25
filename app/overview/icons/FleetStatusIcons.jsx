/**
 * @file FleetStatusIcons.jsx
 * @description Các biểu tượng SVG thủ công cho 5 trạng thái hạm đội xe (Tổng, Online, Offline, Hết hạn, Đại lý).
 */

import React from 'react';

/**
 * 1. FleetTotalIcon — Tổng số xe / GPS Fleet Center
 */
export const FleetTotalIcon = ({ size = 26, color = '#1d4ed8', className = '', ...props }) => (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M10 5a9 9 0 0 1 12 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.5" />
        <path d="M12.5 7.5a5 5 0 0 1 7 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.8" />
        <circle cx="16" cy="10" r="2.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
        <line x1="16" y1="12.2" x2="16" y2="15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="3" y="14" width="17" height="11" rx="2.5" fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.8" />
        <line x1="8.5" y1="14" x2="8.5" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <line x1="14" y1="14" x2="14" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <line x1="3" y1="21" x2="20" y2="21" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="2 1.5" />
        <path d="M20 16.5h5.5a1.5 1.5 0 0 1 1.2.6l2.3 3.4c.3.4.4.9.4 1.5v3h-9.4v-8.5z" fill={color} fillOpacity="0.22" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M22 18h3.2l1.6 2.5h-4.8V18z" fill="#ffffff" fillOpacity="0.75" />
        <rect x="28.2" y="22.5" width="1.6" height="2" rx="0.5" fill="#f59e0b" />
        <circle cx="8" cy="25.5" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="8" cy="25.5" r="1.3" fill={color} />
        <circle cx="23.5" cy="25.5" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="23.5" cy="25.5" r="1.3" fill={color} />
        <line x1="1.5" y1="29.5" x2="30.5" y2="29.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.25" strokeDasharray="3 2" />
    </svg>
);

/**
 * 2. FleetOnlineIcon — Thiết bị Online / Trực tuyến hoạt động
 */
export const FleetOnlineIcon = ({ size = 26, color = '#16a34a', className = '', ...props }) => (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <circle cx="27" cy="6" r="4.5" fill="#16a34a" fillOpacity="0.18" />
        <circle cx="27" cy="6" r="3" fill="#16a34a" />
        <circle cx="27" cy="6" r="1.2" fill="#ffffff" />
        <circle cx="27" cy="6" r="5.5" stroke="#16a34a" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 1.5" />
        <path d="M10 8a8 8 0 0 1 12 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12.5 11a4.5 4.5 0 0 1 7 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="13.5" r="1.5" fill={color} />
        <path d="M3 20h26l-2-4.5a3 3 0 0 0-2.8-1.8H12a4 4 0 0 0-3.6 2.3L6 20z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12.5 15h5.5l2 2.5h-9l1.5-2.5z" fill="#ffffff" fillOpacity="0.75" />
        <rect x="4" y="20" width="24" height="4" rx="1.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
        <path d="M28.5 20.8L31 21.5L28.5 22.2Z" fill="#16a34a" />
        <circle cx="9" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="9" cy="25" r="1.3" fill={color} />
        <circle cx="23" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="23" cy="25" r="1.3" fill={color} />
        <line x1="1" y1="17" x2="3.5" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0.5" y1="19.5" x2="2.5" y2="19.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1.5" y1="22" x2="3" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/**
 * 3. FleetOfflineIcon — Thiết bị Offline / Mất tín hiệu
 */
export const FleetOfflineIcon = ({ size = 26, color = '#dc2626', className = '', ...props }) => (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M4 20h24l-2.2-4.5a3 3 0 0 0-2.7-1.8H12a3.5 3.5 0 0 0-3.2 2.1L6 20z" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="4" y="20" width="24" height="4" rx="1.5" fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.6" />
        <circle cx="9" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="9" cy="25" r="1.3" fill={color} />
        <circle cx="23" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="23" cy="25" r="1.3" fill={color} />
        <path d="M12 10a6 6 0 0 1 8 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.35" strokeDasharray="2 2" />
        <circle cx="16" cy="12" r="1.2" fill={color} opacity="0.4" />
        <path d="M26 3L31 11H21L26 3Z" fill="#dc2626" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round" />
        <line x1="26" y1="5.8" x2="26" y2="8.2" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="26" cy="9.8" r="0.6" fill="#ffffff" />
        <line x1="4" y1="5" x2="28" y2="28" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" />
        <line x1="4" y1="5" x2="28" y2="28" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
);

/**
 * 4. FleetExpiringIcon — Thiết bị sắp hết hạn cước
 */
export const FleetExpiringIcon = ({ size = 26, color = '#d97706', className = '', ...props }) => (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <rect x="4" y="6" width="22" height="21" rx="3" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.8" />
        <path d="M4 9a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v3H4V9z" fill={color} stroke={color} strokeWidth="1.5" />
        <rect x="9" y="3" width="2.4" height="5" rx="1.2" fill="#ffffff" stroke={color} strokeWidth="1.2" />
        <rect x="19" y="3" width="2.4" height="5" rx="1.2" fill="#ffffff" stroke={color} strokeWidth="1.2" />
        <line x1="8" y1="16" x2="12" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="8" y1="20" x2="11" y2="20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="22" cy="22" r="7.5" fill="#ffffff" stroke={color} strokeWidth="2" />
        <circle cx="22" cy="22" r="6" fill="#fffbeb" />
        <line x1="22" y1="16.5" x2="22" y2="17.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="27.5" y1="22" x2="26.2" y2="22" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <polyline points="22,18 22,22 24.5,23.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="22" y1="22" x2="20" y2="24.5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="22" cy="22" r="1.3" fill="#dc2626" />
    </svg>
);

/**
 * 5. FleetDistributorIcon — Đại lý / Hệ thống phân phối
 */
export const FleetDistributorIcon = ({ size = 26, color = '#0284c7', className = '', ...props }) => (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <rect x="11" y="4" width="10" height="20" rx="2" fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.8" />
        <line x1="16" y1="1" x2="16" y2="4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="16" cy="1" r="1.3" fill="#38bdf8" />
        <rect x="13.5" y="7" width="2" height="2" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="16.5" y="7" width="2" height="2" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="13.5" y="11" width="2" height="2" rx="0.5" fill={color} />
        <rect x="16.5" y="11" width="2" height="2" rx="0.5" fill={color} />
        <rect x="13.5" y="15" width="2" height="2" rx="0.5" fill={color} />
        <rect x="16.5" y="15" width="2" height="2" rx="0.5" fill={color} />
        <rect x="3" y="12" width="7" height="12" rx="1.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" />
        <rect x="5" y="15" width="3" height="2.5" rx="0.5" fill={color} opacity="0.7" />
        <rect x="22" y="12" width="7" height="12" rx="1.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" />
        <rect x="24" y="15" width="3" height="2.5" rx="0.5" fill={color} opacity="0.7" />
        <line x1="2" y1="27" x2="30" y2="27" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="6.5" cy="27" r="2" fill="#ffffff" stroke={color} strokeWidth="1.6" />
        <circle cx="16" cy="27" r="2.8" fill="#0284c7" stroke="#ffffff" strokeWidth="1.3" />
        <circle cx="16" cy="27" r="1.1" fill="#ffffff" />
        <circle cx="25.5" cy="27" r="2" fill="#ffffff" stroke={color} strokeWidth="1.6" />
    </svg>
);
