/**
 * OverviewIcons — EV GPS themed custom SVG icons
 * Chủ đề: xe điện + hệ thống định vị GPS
 * Hoàn toàn tự vẽ, không dựa vào bộ icon nào
 */

/** Xe điện đang chạy — silhouette xe điện nhìn ngang, bánh có tia tốc độ */
export const IconEvCar = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Thân xe */}
        <path d="M2 14h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Mái xe bo tròn */}
        <path d="M5 14c0-3 1.5-5 3-6h8c1.5 1 3 3 3 6" fill={color} fillOpacity="0.08" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {/* Kính trước & sau */}
        <path d="M8 14c0-2 .8-4 2-5h4c1.2 1 2 3 2 5" stroke={color} strokeWidth="1" strokeLinejoin="round" fill={color} fillOpacity="0.2" />
        {/* Bánh xe + vành */}
        <circle cx="6.5" cy="17" r="2" stroke={color} strokeWidth="1.5" fill="none" />
        <circle cx="17.5" cy="17" r="2" stroke={color} strokeWidth="1.5" fill="none" />
        <circle cx="6.5" cy="17" r=".8" fill={color} />
        <circle cx="17.5" cy="17" r=".8" fill={color} />
        {/* Tia tốc độ */}
        <line x1="0.5" y1="12.5" x2="2.5" y2="12.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="0.5" y1="14.5" x2="2" y2="14.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
);

/** GPS Satellite — vệ tinh với sóng phát */
export const IconSatellite = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Thân vệ tinh */}
        <rect x="9" y="9" width="6" height="6" rx="1" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
        {/* Cánh năng lượng mặt trời */}
        <rect x="2" y="10.5" width="5" height="3" rx=".5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
        <rect x="17" y="10.5" width="5" height="3" rx=".5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1.2" />
        {/* Ăng-ten phát */}
        <line x1="12" y1="9" x2="12" y2="5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        {/* Sóng tín hiệu */}
        <path d="M9.5 3.5a4 4 0 0 1 5 0" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        <path d="M11 5a1.5 1.5 0 0 1 2 0" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        {/* Chùm tín hiệu xuống đất */}
        <path d="M9 15l-4 5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5" />
        <circle cx="5" cy="20.5" r="1" fill={color} fillOpacity="0.6" />
    </svg>
);

/** Battery Lightning — pin điện với bolt, cho xe điện */
export const IconBattery = ({ size = 20, color = 'currentColor', level = 'high' }) => {
    const fill = level === 'high' ? '#22c55e' : level === 'low' ? '#ef4444' : '#f59e0b';
    const barWidth = level === 'high' ? 10 : level === 'low' ? 3 : 6;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Vỏ pin */}
            <rect x="1" y="7" width="18" height="10" rx="2" stroke={color} strokeWidth="1.6" fill="none" />
            {/* Cực dương */}
            <path d="M19 10v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <rect x="20" y="10.5" width="3" height="3" rx="1" fill={color} fillOpacity="0.5" />
            {/* Mức pin */}
            <rect x="3" y="9.5" width={barWidth} height="5" rx="1" fill={fill} fillOpacity="0.9" />
            {/* Lightning bolt */}
            <path d="M11 7l-3 5h4l-3 5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

/** Tín hiệu GPS đang hoạt động — pin định vị với sóng pulsing */
export const IconGpsSignal = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Pin định vị */}
        <path d="M12 2C8.5 2 6 4.8 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.2-2.5-6-6-6z"
            fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="8" r="2" fill={color} />
        {/* Sóng phát */}
        <path d="M5 5.5A9.5 9.5 0 0 1 12 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.5" fill="none" />
        <path d="M19 5.5A9.5 9.5 0 0 0 12 3" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.5" fill="none" />
    </svg>
);

/** Xe offline — xe với X, màu đỏ nhạt */
export const IconEvOffline = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 14h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z" fill="#ef4444" fillOpacity="0.12" stroke="#ef4444" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M5 14c0-3 1.5-5 3-6h8c1.5 1 3 3 3 6" fill="none" stroke="#ef4444" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="6.5" cy="17" r="2" stroke="#ef4444" strokeWidth="1.4" fill="none" />
        <circle cx="17.5" cy="17" r="2" stroke="#ef4444" strokeWidth="1.4" fill="none" />
        {/* X overlay */}
        <line x1="9" y1="8" x2="15" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
        <line x1="15" y1="8" x2="9" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

/** Xe online — xe với checkmark xanh */
export const IconEvOnline = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 14h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z" fill="#22c55e" fillOpacity="0.12" stroke="#22c55e" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M5 14c0-3 1.5-5 3-6h8c1.5 1 3 3 3 6" fill="none" stroke="#22c55e" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="6.5" cy="17" r="2" stroke="#22c55e" strokeWidth="1.4" fill="none" />
        <circle cx="17.5" cy="17" r="2" stroke="#22c55e" strokeWidth="1.4" fill="none" />
        {/* Checkmark */}
        <polyline points="8,10 11,13 16,8" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
);

/** Trạm sạc — cột sạc điện, hình chữ nhật + plug */
export const IconChargingStation = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Thân cột */}
        <rect x="5" y="3" width="10" height="14" rx="2" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" />
        {/* Màn hình */}
        <rect x="7" y="5" width="6" height="4" rx="1" fill={color} fillOpacity="0.3" />
        {/* Bolt trên màn hình */}
        <path d="M10 5.5l-1.5 2.5h2L9 10" stroke="#fff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dây sạc */}
        <path d="M15 10c3 0 3 4 3 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <rect x="17" y="14" width="3" height="2" rx=".5" fill={color} fillOpacity="0.6" />
        <line x1="18" y1="14" x2="18" y2="12.5" stroke={color} strokeWidth="1.2" />
        <line x1="20" y1="14" x2="20" y2="12.5" stroke={color} strokeWidth="1.2" />
        {/* Đế */}
        <rect x="4" y="17" width="12" height="3" rx="1.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.3" />
    </svg>
);

/** Đồng hồ tốc độ — speedometer style */
export const IconSpeedometer = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Nửa vòng */}
        <path d="M3 15A9 9 0 0 1 21 15" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* Vạch chia */}
        <line x1="3" y1="15" x2="4.5" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="12" y1="6" x2="12" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="21" y1="15" x2="19.5" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="6.5" y1="8.5" x2="7.5" y2="9.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="17.5" y1="8.5" x2="16.5" y2="9.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        {/* Kim đồng hồ — hơi lệch phải = 70 km/h */}
        <line x1="12" y1="15" x2="17" y2="9" stroke={color} strokeWidth="2" strokeLinecap="round" />
        {/* Tâm */}
        <circle cx="12" cy="15" r="1.5" fill={color} />
    </svg>
);

/** Đại lý / Distribution Hub — diamond chain */
export const IconDistributorEv = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Node trung tâm */}
        <circle cx="12" cy="12" r="3.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.7" />
        <circle cx="12" cy="12" r="1.2" fill={color} />
        {/* 4 node phụ theo góc */}
        <circle cx="4" cy="6" r="2" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.12" />
        <circle cx="20" cy="6" r="2" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.12" />
        <circle cx="4" cy="18" r="2" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.12" />
        <circle cx="20" cy="18" r="2" stroke={color} strokeWidth="1.4" fill={color} fillOpacity="0.12" />
        {/* Kết nối */}
        <line x1="6" y1="7.5" x2="9.5" y2="10.5" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5" />
        <line x1="18" y1="7.5" x2="14.5" y2="10.5" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5" />
        <line x1="6" y1="16.5" x2="9.5" y2="13.5" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5" />
        <line x1="18" y1="16.5" x2="14.5" y2="13.5" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5" />
    </svg>
);

/** Cảnh báo hết hạn — đồng hồ + tia sét nguy hiểm */
export const IconWarningExpiry = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Tam giác cảnh báo */}
        <path d="M12 3L2 20h20L12 3z" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
        {/* Số ! */}
        <line x1="12" y1="10" x2="12" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17.5" r="1" fill={color} />
        {/* Đồng hồ nhỏ góc trên phải */}
        <circle cx="19" cy="5" r="3" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.2" />
        <line x1="19" y1="3.8" x2="19" y2="5" stroke={color} strokeWidth="1" strokeLinecap="round" />
        <line x1="19" y1="5" x2="20.2" y2="5.8" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </svg>
);

/** Reset về toàn quốc — crosshair + globe */
export const IconResetView = ({ size = 20, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Vòng ngoài crosshair */}
        <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.06" />
        {/* Crosshair lines */}
        <line x1="12" y1="2" x2="12" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="12" x2="6" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="18" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="12" cy="12" r="2.5" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="1.4" />
        <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
);

/** Map topo — bản đồ với đường đồng mức EV route */
export const IconMapTopo = ({ size = 13, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 5l6-2 8 4 6-3v15l-6 3-8-4-6 2V5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={color} fillOpacity="0.1" />
        <path d="M8 13c1-2 4-3 6-1" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path d="M9.5 16c.8-1.2 3.2-1.2 4 0" stroke={color} strokeWidth="1.1" strokeLinecap="round" fill="none" />
        <circle cx="11" cy="11" r="1" fill={color} />
    </svg>
);

/** Chevron Right — breadcrumb */
export const IconChevronRight = ({ size = 12, color = '#9ca3af' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

/** Info */
export const IconInfo = ({ size = 13, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill={color} fillOpacity="0.08" />
        <line x1="12" y1="8" x2="12" y2="12.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1.1" fill={color} />
    </svg>
);

/** Fullscreen */
export const IconFullscreen = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
);
