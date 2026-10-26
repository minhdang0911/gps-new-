/**
 * OverviewIcons — Custom handcrafted SVG icons for IKY GPS Platform
 * Thiết kế thủ công theo phong cách kỹ thuật cao:
 * - Chuẩn tỷ lệ hình học sắc nét, duotone opacity tinh tế
 * - Có ĐIỂM NHẤN (Focal Points) với các hạt tín hiệu, chi tiết 3D và highlight shine
 * - 100% tự vẽ thuần vector, không phụ thuộc thư viện ngoài
 */
import React from 'react';

/**
 * 1. FleetTotalIcon — Tổng số xe / GPS Fleet Center
 * Điểm nhấn: Vệ tinh phát tín hiệu vàng Amber trên nóc + Đầu kéo vận tải đa chi tiết + Bánh xe mạ crom
 */
export const FleetTotalIcon = ({ size = 26, color = '#1d4ed8', className = '', ...props }) => (
    <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Sóng radar GPS đa tầng */}
        <path d="M10 5a9 9 0 0 1 12 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.5" />
        <path d="M12.5 7.5a5 5 0 0 1 7 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.8" />
        {/* Điểm nhấn: Hạt phát sóng vàng Amber nổi bật */}
        <circle cx="16" cy="10" r="2.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />
        <line x1="16" y1="12.2" x2="16" y2="15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />

        {/* Khung thùng xe tải / Thiết bị giám sát */}
        <rect
            x="3"
            y="14"
            width="17"
            height="11"
            rx="2.5"
            fill={color}
            fillOpacity="0.14"
            stroke={color}
            strokeWidth="1.8"
        />
        {/* Thanh gân thùng & vạch phản quang */}
        <line x1="8.5" y1="14" x2="8.5" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <line x1="14" y1="14" x2="14" y2="25" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
        <line x1="3" y1="21" x2="20" y2="21" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="2 1.5" />

        {/* Đầu cabin xe */}
        <path
            d="M20 16.5h5.5a1.5 1.5 0 0 1 1.2.6l2.3 3.4c.3.4.4.9.4 1.5v3h-9.4v-8.5z"
            fill={color}
            fillOpacity="0.22"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
        />
        {/* Kính cabin có ánh sáng phản chiếu */}
        <path d="M22 18h3.2l1.6 2.5h-4.8V18z" fill="#ffffff" fillOpacity="0.75" />
        {/* Đèn pha trước */}
        <rect x="28.2" y="22.5" width="1.6" height="2" rx="0.5" fill="#f59e0b" />

        {/* Bánh xe hợp kim có viền & tâm mạ */}
        <circle cx="8" cy="25.5" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="8" cy="25.5" r="1.3" fill={color} />
        <circle cx="23.5" cy="25.5" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="23.5" cy="25.5" r="1.3" fill={color} />

        {/* Trục lộ tọa độ */}
        <line x1="1.5" y1="29.5" x2="30.5" y2="29.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.25" strokeDasharray="3 2" />
    </svg>
);

/**
 * 2. FleetOnlineIcon — Thiết bị Online / Trực tuyến hoạt động
 * Điểm nhấn: Đèn Live Beacon xanh ngọc nhấp nháy + 3 sóng radar quét + Dáng xe lướt gió khí động học
 */
export const FleetOnlineIcon = ({ size = 26, color = '#16a34a', className = '', ...props }) => (
    <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Điểm nhấn: Huy hiệu LIVE BEACON phát sáng góc trên */}
        <circle cx="27" cy="6" r="4.5" fill="#16a34a" fillOpacity="0.18" />
        <circle cx="27" cy="6" r="3" fill="#16a34a" />
        <circle cx="27" cy="6" r="1.2" fill="#ffffff" />
        <circle cx="27" cy="6" r="5.5" stroke="#16a34a" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 1.5" />

        {/* Chùm sóng truyền phát tín hiệu vệ tinh */}
        <path d="M10 8a8 8 0 0 1 12 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12.5 11a4.5 4.5 0 0 1 7 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="16" cy="13.5" r="1.5" fill={color} />

        {/* Thân xe EV thể thao hiện đại đang di chuyển */}
        <path
            d="M3 20h26l-2-4.5a3 3 0 0 0-2.8-1.8H12a4 4 0 0 0-3.6 2.3L6 20z"
            fill={color}
            fillOpacity="0.15"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
        />
        {/* Kính xe thể thao bóng */}
        <path d="M12.5 15h5.5l2 2.5h-9l1.5-2.5z" fill="#ffffff" fillOpacity="0.75" />

        {/* Cản dưới xe & Pin sạc */}
        <rect x="4" y="20" width="24" height="4" rx="1.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
        {/* Đèn pha LED xanh lướt */}
        <path d="M28.5 20.8L31 21.5L28.5 22.2Z" fill="#16a34a" />

        {/* Bánh xe mạ crom xoay chuyển động */}
        <circle cx="9" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="9" cy="25" r="1.3" fill={color} />
        <circle cx="23" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="23" cy="25" r="1.3" fill={color} />

        {/* Vệt gió tốc độ */}
        <line x1="1" y1="17" x2="3.5" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="0.5" y1="19.5" x2="2.5" y2="19.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1.5" y1="22" x2="3" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/**
 * 3. FleetOfflineIcon — Thiết bị Offline / Mất tín hiệu
 * Điểm nhấn: Huy hiệu cảnh báo tam giác đỏ rực + Đường gạch chéo cắt đứt kết nối + Sét ngắt tín hiệu
 */
export const FleetOfflineIcon = ({ size = 26, color = '#dc2626', className = '', ...props }) => (
    <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Vỏ xe bị ngắt tín hiệu */}
        <path
            d="M4 20h24l-2.2-4.5a3 3 0 0 0-2.7-1.8H12a3.5 3.5 0 0 0-3.2 2.1L6 20z"
            fill={color}
            fillOpacity="0.1"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
        />
        <rect x="4" y="20" width="24" height="4" rx="1.5" fill={color} fillOpacity="0.16" stroke={color} strokeWidth="1.6" />

        {/* Bánh xe */}
        <circle cx="9" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="9" cy="25" r="1.3" fill={color} />
        <circle cx="23" cy="25" r="3.2" fill="#ffffff" stroke={color} strokeWidth="1.8" />
        <circle cx="23" cy="25" r="1.3" fill={color} />

        {/* Tháp anten ngắt sóng */}
        <path d="M12 10a6 6 0 0 1 8 0" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.35" strokeDasharray="2 2" />
        <circle cx="16" cy="12" r="1.2" fill={color} opacity="0.4" />

        {/* Điểm nhấn: Huy hiệu báo động tam giác đỏ rực góc trên phải */}
        <path d="M26 3L31 11H21L26 3Z" fill="#dc2626" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round" />
        <line x1="26" y1="5.8" x2="26" y2="8.2" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="26" cy="9.8" r="0.6" fill="#ffffff" />

        {/* Đường gạch chéo cắt đứt tín hiệu 2 lớp (Signal Disconnect Slash) */}
        <line x1="4" y1="5" x2="28" y2="28" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" />
        <line x1="4" y1="5" x2="28" y2="28" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
);

/**
 * 4. FleetExpiringIcon — Thiết bị sắp hết hạn cước
 * Điểm nhấn: Tấm lịch lật với gáy kẹp kim loại sáng + Mặt đồng hồ đếm ngược vàng cam + Chuông báo gấp
 */
export const FleetExpiringIcon = ({ size = 26, color = '#d97706', className = '', ...props }) => (
    <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Thân cuốn lịch */}
        <rect
            x="4"
            y="6"
            width="22"
            height="21"
            rx="3"
            fill={color}
            fillOpacity="0.12"
            stroke={color}
            strokeWidth="1.8"
        />
        {/* Đầu gáy lịch màu cam đậm */}
        <path
            d="M4 9a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v3H4V9z"
            fill={color}
            stroke={color}
            strokeWidth="1.5"
        />
        {/* Điểm nhấn: 2 móc treo kim loại sáng bạc */}
        <rect x="9" y="3" width="2.4" height="5" rx="1.2" fill="#ffffff" stroke={color} strokeWidth="1.2" />
        <rect x="19" y="3" width="2.4" height="5" rx="1.2" fill="#ffffff" stroke={color} strokeWidth="1.2" />

        {/* Các dòng kẻ ngày kiểm định */}
        <line x1="8" y1="16" x2="12" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="8" y1="20" x2="11" y2="20" stroke={color} strokeWidth="1.8" strokeLinecap="round" />

        {/* Điểm nhấn: Mặt đồng hồ đếm ngược viền đôi nổi bật góc dưới phải */}
        <circle cx="22" cy="22" r="7.5" fill="#ffffff" stroke={color} strokeWidth="2" />
        <circle cx="22" cy="22" r="6" fill="#fffbeb" />
        {/* Vạch chia giờ */}
        <line x1="22" y1="16.5" x2="22" y2="17.8" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        <line x1="27.5" y1="22" x2="26.2" y2="22" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        {/* Kim đồng hồ góc gấp (11 giờ) có kim giây đỏ */}
        <polyline points="22,18 22,22 24.5,23.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="22" y1="22" x2="20" y2="24.5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="22" cy="22" r="1.3" fill="#dc2626" />
    </svg>
);

/**
 * 5. FleetDistributorIcon — Đại lý / Hệ thống phân phối
 * Điểm nhấn: Trụ sở điều hành kính cao cấp + Trạm đại lý vệ tinh + Mạng lưới nút liên kết chuẩn xanh IKY
 */
export const FleetDistributorIcon = ({ size = 26, color = '#0284c7', className = '', ...props }) => (
    <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Tòa nhà trung tâm điều hành trụ sở */}
        <rect
            x="11"
            y="4"
            width="10"
            height="20"
            rx="2"
            fill={color}
            fillOpacity="0.16"
            stroke={color}
            strokeWidth="1.8"
        />
        {/* Cột ăng-ten phát sóng nóc trụ sở */}
        <line x1="16" y1="1" x2="16" y2="4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="16" cy="1" r="1.3" fill="#38bdf8" />

        {/* Các tầng kính phản chiếu ánh sáng kỹ thuật */}
        <rect x="13.5" y="7" width="2" height="2" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="16.5" y="7" width="2" height="2" rx="0.5" fill="#ffffff" opacity="0.9" />
        <rect x="13.5" y="11" width="2" height="2" rx="0.5" fill={color} />
        <rect x="16.5" y="11" width="2" height="2" rx="0.5" fill={color} />
        <rect x="13.5" y="15" width="2" height="2" rx="0.5" fill={color} />
        <rect x="16.5" y="15" width="2" height="2" rx="0.5" fill={color} />

        {/* Trạm phân phối / Đại lý vệ tinh khu vực bên trái */}
        <rect x="3" y="12" width="7" height="12" rx="1.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" />
        <rect x="5" y="15" width="3" height="2.5" rx="0.5" fill={color} opacity="0.7" />

        {/* Trạm phân phối / Đại lý vệ tinh khu vực bên phải */}
        <rect x="22" y="12" width="7" height="12" rx="1.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.6" />
        <rect x="24" y="15" width="3" height="2.5" rx="0.5" fill={color} opacity="0.7" />

        {/* Mạng lưới bus liên kết các đại lý trên toàn quốc */}
        <line x1="2" y1="27" x2="30" y2="27" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="6.5" cy="27" r="2" fill="#ffffff" stroke={color} strokeWidth="1.6" />
        {/* Điểm nhấn: Trạm trung tâm kết nối phát sáng màu xanh thương hiệu IKY */}
        <circle cx="16" cy="27" r="2.8" fill="#0284c7" stroke="#ffffff" strokeWidth="1.3" />
        <circle cx="16" cy="27" r="1.1" fill="#ffffff" />
        <circle cx="25.5" cy="27" r="2" fill="#ffffff" stroke={color} strokeWidth="1.6" />
    </svg>
);

/**
 * 6. IconFleetCommandHub — Huy hiệu trung tâm điều hành thiết bị bản đồ (Header Badge)
 * Điểm nhấn: Vệ tinh quỹ đạo GPS phát chùm sóng đa tầng xuống trạm mặt đất
 */
export const IconFleetCommandHub = ({ size = 18, color = '#ffffff', className = '', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Khung thân vệ tinh quỹ đạo */}
        <rect x="9.5" y="3.5" width="5" height="6.5" rx="1.2" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
        {/* Tấm pin solar bên trái */}
        <rect x="3" y="5.2" width="5" height="3.2" rx="0.6" stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.15" />
        <line x1="5.5" y1="5.2" x2="5.5" y2="8.4" stroke={color} strokeWidth="0.9" />
        <line x1="8" y1="6.8" x2="9.5" y2="6.8" stroke={color} strokeWidth="1.3" />
        {/* Tấm pin solar bên phải */}
        <rect x="16" y="5.2" width="5" height="3.2" rx="0.6" stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.15" />
        <line x1="18.5" y1="5.2" x2="18.5" y2="8.4" stroke={color} strokeWidth="0.9" />
        <line x1="14.5" y1="6.8" x2="16" y2="6.8" stroke={color} strokeWidth="1.3" />
        {/* Chùm sóng vô tuyến phát thanh hướng tâm */}
        <path d="M8.5 13a5 5 0 0 0 7 0" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6.5 16a8 8 0 0 0 11 0" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
        {/* Trạm đích mặt đất GPS */}
        <circle cx="12" cy="19.2" r="2.2" fill="#38bdf8" stroke={color} strokeWidth="1.2" />
        <circle cx="12" cy="19.2" r="0.8" fill="#ffffff" />
    </svg>
);

/**
 * 7. IconMapTab — Chế độ Bản đồ: Radar định vị quỹ đạo vệ tinh (Telemetry Satellite Radar Reticle)
 * Thay đổi hoàn toàn style: Không dùng bản đồ giấy gấp kiểu du lịch cũ,
 * chuyển sang màn hình Radar HUD điều hướng thời gian thực với vòng quét và kim phương vị Bắc!
 */
export const IconMapTab = ({ size = 15, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Vòng quét radar ngoài cùng ngắt đoạn */}
        <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 2.5" />
        {/* Vòng cự ly mục tiêu bên trong */}
        <circle cx="10" cy="10" r="4.2" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45" />
        {/* 4 Trục ngắm góc phương vị B-N-Đ-T */}
        <line x1="10" y1="1" x2="10" y2="4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="15.8" x2="10" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="1" y1="10" x2="4.2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15.8" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Mũi tên định hướng viễn thám phương vị (Heading Beacon) */}
        <path
            d="M10 6L12.6 12.8L10 11.4L7.4 12.8L10 6Z"
            fill="#0284c7"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinejoin="round"
        />
        <circle cx="10" cy="10" r="0.9" fill="#ffffff" />
    </svg>
);

/**
 * 8. IconTableTab — Chế độ Danh sách: Luồng dữ liệu cảm biến (Telemetry Sensor Data Stream)
 * Thay đổi hoàn toàn style: Không dùng lưới Excel 4 ô phổ thông,
 * chuyển sang mô hình Bus truyền tín hiệu viễn thông đa kênh với các node cảm biến thời gian thực!
 */
export const IconTableTab = ({ size = 15, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Trục bus truyền tín hiệu viễn thông */}
        <line x1="4.2" y1="3" x2="4.2" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* 3 Khoang gói tin thiết bị (Telemetry Data Capsules) */}
        <rect x="7.5" y="3" width="10" height="3.2" rx="1.6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="8.4" width="10" height="3.2" rx="1.6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        <rect x="7.5" y="13.8" width="10" height="3.2" rx="1.6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.2" />
        {/* Node tín hiệu kết nối sensor */}
        <circle cx="4.2" cy="4.6" r="1.6" fill="#0284c7" />
        <circle cx="4.2" cy="10" r="1.6" fill="currentColor" />
        <circle cx="4.2" cy="15.4" r="1.6" fill="#10b981" />
        {/* Vạch dữ liệu telemetry bên trong */}
        <line x1="10" y1="4.6" x2="14.5" y2="4.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="10" x2="15.5" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="15.4" x2="13.5" y2="15.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

/**
 * 9. IconSearchOptic — Ô tìm kiếm: Khung ngắm quét Lidar HUD (HUD Lidar Target Reticle)
 * Thay đổi hoàn toàn style: Không dùng kính lúp tròn có cán thông thường,
 * chuyển sang khung ngắm bắt mục tiêu IMEI / Biển số với góc ngắm Lidar & tia laser quét tâm!
 */
export const IconSearchOptic = ({ size = 14, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* 4 Góc ngắm Lidar đo cự ly */}
        <path d="M5.5 3H3V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 3H17V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 17H3V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 17H17V14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Vòng vi sai tâm ngắm */}
        <circle cx="10" cy="10" r="4.2" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.08" />
        {/* Tia laser quét ngang bắt sóng RFID/IMEI */}
        <line x1="6" y1="10" x2="14" y2="10" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
        {/* Điểm đỏ / xanh khóa mục tiêu */}
        <circle cx="10" cy="10" r="1.3" fill="#0284c7" />
    </svg>
);

/**
 * 10. IconFullscreenExpand — Toàn màn hình: Phóng chiếu khung hình đa hướng (HUD Viewport Projector)
 * Thay đổi hoàn toàn style: Không dùng 4 ngoặc đơn giản,
 * chuyển sang khung hiển thị vệ tinh với 4 tia phóng chiếu vector mở rộng không gian!
 */
export const IconFullscreenExpand = ({ size = 14, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Khung màn hình hiển thị trung tâm */}
        <rect x="6.5" y="6.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
        {/* 4 Mũi tên phóng tia ra 4 góc màn hình */}
        <path d="M3.5 7.5V3.5H7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 7.5V3.5H12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 12.5V16.5H7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 12.5V16.5H12.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        {/* Điểm nhắm vector xanh IKY tại 4 góc */}
        <line x1="5" y1="5" x2="7" y2="7" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="15" y1="5" x2="13" y2="7" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="5" y1="15" x2="7" y2="13" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="15" y1="15" x2="13" y2="13" stroke="#0284c7" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

/**
 * 11. IconFullscreenCollapse — Thu nhỏ màn hình (HUD Viewport Retractor)
 */
export const IconFullscreenCollapse = ({ size = 14, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        {/* Khung viền ngoài nét đứt */}
        <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.4" strokeDasharray="2 2" />
        {/* 4 Mũi tên hội tụ vào tâm */}
        <path d="M7.5 3.5V7.5H3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 3.5V7.5H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.5 16.5V12.5H3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.5 16.5V12.5H16.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/**
 * 11. IconCloseMini — Nút xóa / Đóng nhanh
 */
export const IconCloseMini = ({ size = 12, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

/**
 * 12. IconGpsPin — Ghim định vị GPS (Thay thế EnvironmentOutlined)
 */
export const IconGpsPin = ({ size = 12, color = '#3b82f6', className = '', ...props }) => (
    <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path
            d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="1.5"
            strokeLinejoin="round"
        />
        <circle cx="8" cy="6" r="1.8" fill={color} />
    </svg>
);

/**
 * 13. IconGpsSlash — Không có tín hiệu GPS (Thay thế StopOutlined)
 */
export const IconGpsSlash = ({ size = 12, color = '#94a3b8', className = '', ...props }) => (
    <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5" fill="none" />
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

/**
 * 14. IconRefreshCustom — Nút làm mới xoay đồng bộ
 */
export const IconRefreshCustom = ({ size = 14, spinning = false, className = '', color = 'currentColor', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{
            transformOrigin: 'center',
            animation: spinning ? 'ov-spin 0.65s linear infinite' : 'none',
            display: 'inline-block',
            verticalAlign: 'middle',
        }}
        {...props}
    >
        <path d="M20 4v5h-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20v-5h5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path
            d="M4.93 9.01A8 8 0 0 1 18.89 6.2L20 9M4 15l1.11 2.8a8 8 0 0 0 13.96-2.81"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

/**
 * 15. IconExcelCustom — Xuất báo cáo Excel
 */
export const IconExcelCustom = ({ size = 15, color = '#15803d', className = '', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path
            d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"
            fill={color}
            fillOpacity="0.12"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
        />
        <path d="M14 2v6h6" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <rect x="7" y="11" width="10" height="8" rx="1" stroke={color} strokeWidth="1.4" fill="#ffffff" />
        <line x1="7" y1="15" x2="17" y2="15" stroke={color} strokeWidth="1.2" />
        <line x1="12" y1="11" x2="12" y2="19" stroke={color} strokeWidth="1.2" />
    </svg>
);

/**
 * 16. IconRegionCustom — Bộ lọc khu vực tỉnh thành
 */
export const IconRegionCustom = ({ size = 15, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill={color}
            fillOpacity="0.15"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
        />
        <circle cx="12" cy="9" r="2.8" fill={color} />
    </svg>
);

/**
 * 17. IconChevronDownCustom
 */
export const IconChevronDownCustom = ({ size = 11, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path d="M3.5 6L8 10.5L12.5 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/**
 * 18. IconLayersCustom — Lớp bản đồ
 */
export const IconLayersCustom = ({ size = 16, color = 'currentColor', className = '', ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
    >
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.15" />
        <path d="M2 12l10 5 10-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
