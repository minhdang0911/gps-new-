/**
 * @file OverviewActionIcons.jsx
 * @description Biểu tượng SVG chức năng cho trang Overview (Tabs, Radar, HUD, Fullscreen, Lidar, v.v.).
 */

import React from 'react';

export const IconFleetCommandHub = ({ size = 18, color = '#ffffff', className = '', ...props }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <rect x="9.5" y="3.5" width="5" height="6.5" rx="1.2" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
        <rect x="3" y="5.2" width="5" height="3.2" rx="0.6" stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.15" />
        <line x1="5.5" y1="5.2" x2="5.5" y2="8.4" stroke={color} strokeWidth="0.9" />
        <line x1="8" y1="6.8" x2="9.5" y2="6.8" stroke={color} strokeWidth="1.3" />
        <rect x="16" y="5.2" width="5" height="3.2" rx="0.6" stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.15" />
        <line x1="18.5" y1="5.2" x2="18.5" y2="8.4" stroke={color} strokeWidth="0.9" />
        <line x1="14.5" y1="6.8" x2="16" y2="6.8" stroke={color} strokeWidth="1.3" />
        <path d="M8.5 13a5 5 0 0 0 7 0" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6.5 16a8 8 0 0 0 11 0" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
        <circle cx="12" cy="19.2" r="2.2" fill="#38bdf8" stroke={color} strokeWidth="1.2" />
        <circle cx="12" cy="19.2" r="0.8" fill="#ffffff" />
    </svg>
);

export const IconMapTab = ({ size = 15, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 2.5" />
        <circle cx="10" cy="10" r="4.2" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45" />
        <line x1="10" y1="1" x2="10" y2="4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="15.8" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1" y1="10" x2="4.2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15.8" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 6L12.6 12.8L10 11.4L7.4 12.8L10 6Z" fill="#0284c7" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="0.9" fill="#ffffff" />
    </svg>
);

export const IconTableTab = ({ size = 15, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <line x1="4.2" y1="3" x2="4.2" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="7.5" y="3" width="10" height="3.2" rx="1.6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="8.4" width="10" height="3.2" rx="1.6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="13.8" width="10" height="3.2" rx="1.6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="4.2" cy="4.6" r="1.6" fill="#0284c7" />
        <circle cx="4.2" cy="10" r="1.6" fill="currentColor" />
        <circle cx="4.2" cy="15.4" r="1.6" fill="#10b981" />
        <line x1="10" y1="4.6" x2="14.5" y2="4.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="10" x2="15.5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="15.4" x2="13.5" y2="15.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

export const IconSearchOptic = ({ size = 14, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M5.5 3H3V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 3H17V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 17H3V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 17H17V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="10" r="4.2" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.08" />
        <line x1="6" y1="10" x2="14" y2="10" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.3" fill="#0284c7" />
    </svg>
);

export const IconFullscreenExpand = ({ size = 14, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <rect x="6.5" y="6.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
        <path d="M3.5 7.5V3.5H7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 7.5V3.5H12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 12.5V16.5H7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 12.5V16.5H12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="5" y1="5" x2="7" y2="7" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="15" y1="5" x2="13" y2="7" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="5" y1="15" x2="7" y2="13" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="15" y1="15" x2="13" y2="13" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

export const IconFullscreenCollapse = ({ size = 14, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.4" strokeDasharray="2 2" />
        <path d="M7.5 3.5V7.5H3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 3.5V7.5H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 16.5V12.5H3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 16.5V12.5H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const IconCloseMini = ({ size = 12, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

export const IconGpsPin = ({ size = 12, color = '#3b82f6', className = '', ...props }) => (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="8" cy="6" r="1.8" fill={color} />
    </svg>
);

export const IconGpsSlash = ({ size = 12, color = '#94a3b8', className = '', ...props }) => (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export const IconRefreshCustom = ({ size = 14, spinning = false, className = '', color = 'currentColor', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ transformOrigin: 'center', animation: spinning ? 'ov-spin 0.65s linear infinite' : 'none', display: 'inline-block', verticalAlign: 'middle' }}
        {...props}
    >
        <path d="M20 4v5h-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20v-5h5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.93 9.01A8 8 0 0 1 18.89 6.2L20 9M4 15l1.11 2.8a8 8 0 0 0 13.96-2.81" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const IconExcelCustom = ({ size = 15, color = '#15803d', className = '', ...props }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 2v6h6" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="7" y="11" width="10" height="8" rx="1" stroke={color} strokeWidth="1.4" fill="#ffffff" />
        <line x1="7" y1="15" x2="17" y2="15" stroke={color} strokeWidth="1.2" />
        <line x1="12" y1="11" x2="12" y2="19" stroke={color} strokeWidth="1.2" />
    </svg>
);

export const IconRegionCustom = ({ size = 15, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="12" cy="9" r="2.8" fill={color} />
    </svg>
);

export const IconChevronDownCustom = ({ size = 11, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M3.5 6L8 10.5L12.5 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const IconLayersCustom = ({ size = 16, color = 'currentColor', className = '', ...props }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
        <path d="M2 12l10 5 10-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
