'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Card,
    Typography,
    Divider,
    Button,
    Modal,
    Descriptions,
    Tag,
    Alert,
    Space,
    Spin,
    AutoComplete,
    Input,
} from 'antd';
import { usePathname } from 'next/navigation';
import styles from '../SupportPage.module.css';
import logo from '../../assets/logo-iky.webp';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// =====================
// API imports
// =====================
import { getDevices, getDeviceInfo } from '../../lib/api/devices';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';
import { getLastCruise } from '../../lib/api/cruise';
import Image from 'next/image';

const { Title, Paragraph, Text } = Typography;

// =====================
// Helpers
// =====================
const isValidImei = (v) => /^\d{10,20}$/.test(String(v || '').trim());
const safe = (v, fallback = '--') => (v === null || v === undefined || v === '' ? fallback : v);
const lineValue = (v, fallback = '____________________') => (v === null || v === undefined || v === '' ? fallback : v);

const minutesDiff = (iso) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.round((Date.now() - t) / 60000);
};

const pad2 = (n) => String(n).padStart(2, '0');

const formatDateTime = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return safe(iso);
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
};

const formatNow = () => {
    const d = new Date();
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
};

const formatFileDateTime = (date = new Date()) => {
    const hh = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    const dd = pad2(date.getDate());
    const mm = pad2(date.getMonth() + 1);
    const yyyy = date.getFullYear();
    return `${hh}-${mi}_${dd}-${mm}-${yyyy}`;
};

const slugFileName = (str = '') =>
    String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

const passFailTag = (ok, lang) => {
    if (ok === null || ok === undefined) return <Tag>--</Tag>;
    const passText = lang === 'vi' ? 'ĐẠT' : 'PASS';
    const failText = lang === 'vi' ? 'KHÔNG ĐẠT' : 'FAIL';
    return <Tag color={ok ? 'green' : 'red'}>{ok ? passText : failText}</Tag>;
};

const passFailText = (ok, lang) => {
    if (ok === null || ok === undefined) return '--';
    if (lang === 'en') return ok ? 'PASS' : 'FAIL';
    return ok ? 'ĐẠT' : 'KHÔNG ĐẠT';
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlight = (text, keyword) => {
    const str = String(text ?? '');
    const key = String(keyword ?? '').trim();
    if (!key) return str;

    const re = new RegExp(escapeRegExp(key), 'ig');
    const parts = str.split(re);
    const matches = str.match(re) || [];

    const out = [];
    for (let i = 0; i < parts.length; i++) {
        out.push(<span key={`p-${i}`}>{parts[i]}</span>);
        if (i < matches.length) {
            out.push(
                <span key={`m-${i}`} style={{ background: '#fff2b8', padding: '0 2px', borderRadius: 3 }}>
                    {matches[i]}
                </span>,
            );
        }
    }
    return <>{out}</>;
};

// ===== i18n =====
const t = {
    title: { vi: 'Quy trình nghiệm thu lắp đặt IKY-GPS', en: 'IKY-GPS Installation Acceptance Process' },
    date: { vi: 'Ngày: 2026-02-03', en: 'Date: 2026-02-03' },

    diagBlockTitle: { vi: 'Chẩn đoán nhanh để nghiệm thu', en: 'Quick diagnostics for acceptance' },
    imeiPlaceholder: { vi: 'Nhập IMEI / biển số / loại xe để tìm...', en: 'Type IMEI / plate / vehicle...' },
    diagnoseBtn: { vi: 'Chẩn đoán', en: 'Diagnose' },
    refreshBtn: { vi: 'Làm mới', en: 'Refresh' },
    closeBtn: { vi: 'Đóng', en: 'Close' },
    diagModalTitle: { vi: 'Chẩn đoán nghiệm thu', en: 'Acceptance diagnostics' },
    diagHint: {
        vi: 'Gõ để tìm → chọn dòng trong dropdown để tự chẩn đoán. (Có thể lọc theo IMEI / biển số / loại xe)',
        en: 'Type to search → pick an option to auto diagnose. (Search by IMEI / plate / vehicle)',
    },
    invalidImei: {
        vi: 'IMEI không hợp lệ',
        en: 'Invalid IMEI. Please pick from list or input 10–20 digits.',
    },
    diagEmpty: { vi: 'Chọn 1 thiết bị trong dropdown để xem kết quả.', en: 'Pick a device from dropdown.' },
    errPrefix: { vi: 'Lỗi chẩn đoán: ', en: 'Diagnostic error: ' },

    imeiLabel: { vi: 'IMEI', en: 'IMEI' },
    deviceIdLabel: { vi: 'ID thiết bị', en: 'Device ID' },
    plateLabel: { vi: 'Biển số', en: 'License plate' },
    vehicleTypeLabel: { vi: 'Loại xe', en: 'Vehicle type' },
    deviceNameLabel: { vi: 'Thiết bị', en: 'Device' },

    criteriaTitle: { vi: 'Tiêu chí đánh giá', en: 'Evaluation criteria' },
    foundDevice: { vi: 'Tìm thấy thiết bị', en: 'Device found' },
    online: { vi: 'Online (Vị trí cập nhật cuối ≤ 5 phút)', en: 'Online (Last update ≤ 5 minutes)' },
    gpsHasCoord: { vi: 'GPS có tọa độ', en: 'GPS has coordinates' },
    batteryUpdated: { vi: 'Cập nhật pin', en: 'Battery updated' },
    batteryVoltage: { vi: 'Điện áp pin', en: 'Battery voltage' },
    soc: { vi: 'SOC', en: 'SOC' },
    batteryStatus: { vi: 'Trạng thái pin', en: 'Battery status' },
    lastCruiseLatLon: { vi: 'Tọa độ vị trí cuối', en: 'Last position lat/lon' },
    firmware: { vi: 'Firmware', en: 'Firmware' },
    acc: { vi: 'ACC', en: 'ACC' },

    safetyTitle: { vi: 'LƯU Ý AN TOÀN', en: 'SAFETY NOTES' },
    safety1: {
        vi: 'Ngắt nguồn chính / rút chìa trước khi thao tác.',
        en: 'Turn off main power / remove the key before working.',
    },
    safety2: {
        vi: 'Dùng găng tay cách điện, dụng cụ cách điện; tháo trang sức kim loại.',
        en: 'Use insulated gloves/tools; remove metallic jewelry.',
    },

    deviceInfoTitle: { vi: 'Thông tin thiết bị', en: 'Device Information' },
    imei: { vi: 'IMEI / Serial', en: 'IMEI / Serial' },
    sim: { vi: 'SIM (nếu có) / IMSI', en: 'SIM (if any) / IMSI' },
    tech: { vi: 'Kỹ thuật viên', en: 'Technician' },
    customer: { vi: 'Khách hàng (nếu có)', en: 'Customer (if any)' },
    installTime: { vi: 'Ngày / Giờ lắp', en: 'Install Date / Time' },
    installPos: { vi: 'Vị trí lắp (mô tả)', en: 'Install Location (description)' },

    aTitle: { vi: 'A. Kiểm tra vật lý & điện', en: 'A. Physical & Power Check' },
    a1: { vi: 'Nguồn xe đã ngắt trước khi thao tác', en: 'Vehicle power was disconnected before installation' },
    a2: {
        vi: 'Thiết bị cố định chắc, bề mặt trên hướng lên trên',
        en: 'Device firmly mounted, top surface facing upward',
    },
    a3: {
        vi: 'Không đặt thiết bị dưới tấm kim loại kín / trong hộp kim loại',
        en: 'Do not place under a sealed metal plate / inside a metal box',
    },
    a4: {
        vi: 'Dây nguồn & mass (GND) nối chắc, bọc cách điện',
        en: 'Power & ground (GND) wiring secured and insulated',
    },
    a5: {
        vi: 'Các kết nối CAN / shunt / IGN (nếu có) đã nối đúng',
        en: 'CAN / shunt / IGN connections (if any) are correct',
    },
    a6: { vi: 'Ảnh vị trí lắp đã chụp và lưu', en: 'Installation photo captured and saved' },

    bTitle: { vi: 'B. Cấp nguồn & LED (thiết bị có 2 LED: GSM & GPS)', en: 'B. Power On & LEDs (2 LEDs: GSM & GPS)' },
    bP1: { vi: '- Cấp lại nguồn, bật chìa.', en: '- Restore power, turn the key on.' },
    bP2: { vi: '- Ghi trạng thái LED ban đầu:', en: '- Record initial LED status:' },
    ledMeaningTitle: { vi: 'Ý nghĩa LED (áp dụng cho thiết bị này)', en: 'LED Meanings (for this device)' },

    gsmTitle: { vi: 'LED GSM', en: 'GSM LED' },
    gsmOff: { vi: 'Tắt (Off): Thiết bị chưa khởi động.', en: 'Off: Device not started.' },
    gsmOn: { vi: 'Sáng: đang tìm mạng / chưa đăng ký mạng.', en: 'On: Searching network / not registered.' },
    gsmBlink: {
        vi: 'Nhấp nháy: đã đăng ký mạng, đang truyền dữ liệu (kết nối 4G LTE).',
        en: 'Blinking: Registered and transmitting data (4G LTE).',
    },

    gpsTitle: { vi: 'LED GPS', en: 'GPS LED' },
    gpsOff: { vi: 'Tắt (Off): Thiết bị chưa khởi động.', en: 'Off: Device not started.' },
    gpsOn: { vi: 'Sáng: tìm vệ tinh.', en: 'On: Searching satellites.' },
    gpsBlink: {
        vi: 'Nhấp nháy: đã có GPS fix, vị trí có thể gửi lên server.',
        en: 'Blinking: GPS fix acquired, location can be sent.',
    },

    bCheck: { vi: 'LED GSM / GPS hoạt động theo mô tả trên', en: 'GSM/GPS LEDs behave as described above' },

    cTitle: {
        vi: 'C. Xác minh trên ev.iky.vn (đăng nhập → tìm thiết bị theo IMEI/Serial)',
        en: 'C. Verify on ev.iky.vn (login → search by IMEI/Serial)',
    },
    c1: { vi: 'Thiết bị Online trên ev.iky.vn (timestamp mới)', en: 'Device is Online on ev.iky.vn (fresh timestamp)' },
    c2: { vi: 'Vị trí GPS trên bản đồ khớp với thực tế', en: 'GPS location matches the real position' },
    c3: { vi: 'Ảnh màn hình ev.iky.vn (trạng thái + timestamp) đã lưu', en: 'Screenshot saved (status + timestamp)' },

    importantVehicleTitle: { vi: 'Quan trọng — cấu hình loại xe', en: 'Important — Vehicle Type Configuration' },
    importantVehicleP: {
        vi: 'Lưu ý: Thiết bị xuất xưởng chưa biết sẽ lắp cho loại xe nào. Nếu loại xe (Vehicle type / Profile) trên ev.iky.vn chưa khớp với xe thực tế, cần cấu hình lại trước khi nghiệm thu.',
        en: 'Note: Factory default profile may not match the actual vehicle. If Vehicle type/Profile on ev.iky.vn is incorrect, reconfigure it before acceptance.',
    },

    dTitle: {
        vi: 'D. Thông tin GPS / Pin cần kiểm tra kỹ trên ev.iky.vn (Giá trị mẫu hiện trường để so sánh)',
        en: 'D. GPS / Battery parameters to verify on ev.iky.vn (sample field values for reference)',
    },

    d_speed: { vi: 'Vận tốc (Speed)', en: 'Speed' },
    d_speed_sample: { vi: 'Giá trị mẫu kiểm tra: ~10 km/h', en: 'Sample: ~10 km/h' },
    d_speed_check: { vi: 'Vận tốc hiển thị ≈ 10 km/h (±2 km/h)', en: 'Speed ≈ 10 km/h (±2 km/h)' },

    d_odo: { vi: 'Odo (Quãng đường tích lũy)', en: 'Odometer (Accumulated distance)' },
    d_odo_sample: { vi: 'Giá trị mẫu: 2269.8 km', en: 'Sample: 2269.8 km' },
    d_odo_check: { vi: 'Odo trên web tương ứng / tăng khi chạy thử', en: 'Odo matches / increases during test drive' },

    d_volt: { vi: 'Điện áp (Battery Voltage)', en: 'Battery Voltage' },
    d_volt_sample: { vi: 'Giá trị mẫu: 65.48 V', en: 'Sample: 65.48 V' },
    d_volt_check: { vi: 'Điện áp ≈ 65.48 V (±0.5 V)', en: 'Voltage ≈ 65.48 V (±0.5 V)' },

    d_current: { vi: 'Dòng sạc/xả (Current)', en: 'Charge/Discharge Current' },
    d_current_sample: { vi: 'Giá trị mẫu: 5 A', en: 'Sample: 5 A' },
    d_current_check: { vi: 'Dòng ≈ 5 A (±10% hoặc ±0.5 A)', en: 'Current ≈ 5 A (±10% or ±0.5 A)' },

    d_status: { vi: 'Trạng thái (Status)', en: 'Status' },
    d_status_sample: { vi: 'Giá trị mẫu: Đang sạc', en: 'Sample: Charging' },
    d_status_check: { vi: 'Web hiển thị “Đang sạc” khi cắm sạc', en: 'Web shows “Charging” when plugged in' },

    d_soc: { vi: 'Trạng thái sạc (SOC)', en: 'SOC' },
    d_soc_sample: { vi: 'Giá trị mẫu: 100%', en: 'Sample: 100%' },
    d_soc_check: { vi: 'SOC = 100% (hoặc khớp với đồng hồ xe ±2–3%)', en: 'SOC = 100% (or matches dashboard ±2–3%)' },

    d_soh: { vi: 'Sức khỏe pin (SOH)', en: 'SOH' },
    d_soh_sample: { vi: 'Giá trị mẫu: 100%', en: 'Sample: 100%' },
    d_soh_check: { vi: 'SOH = 100% (hoặc khớp dữ liệu bảo dưỡng)', en: 'SOH = 100% (or matches service data)' },

    screenshotBtn: { vi: 'Lưu ảnh', en: 'Save Screenshot' },

    d_cycle: { vi: 'Chu kỳ sạc/xả (Cycle count)', en: 'Cycle count' },
    d_cycle_sample: { vi: 'Giá trị mẫu: 24', en: 'Sample: 24' },
    d_cycle_check: { vi: 'Cycle count = 24 (hoặc khớp lịch sử)', en: 'Cycle count = 24 (or matches history)' },

    d_temp: { vi: 'Nhiệt độ pin (Battery Temperature)', en: 'Battery Temperature' },
    d_temp_sample: { vi: 'Giá trị mẫu: 23 °C', en: 'Sample: 23 °C' },
    d_temp_check: { vi: 'Nhiệt độ ≈ 23 °C (±1–3 °C)', en: 'Temperature ≈ 23 °C (±1–3 °C)' },

    eTitle: { vi: 'E. Kịch bản kiểm tra ngắn (thực hiện tại hiện trường)', en: 'E. Short field test scenario' },
    e1: {
        vi: 'Trạng thái ban đầu: bật khóa, chụp ảnh màn hình trang thiết bị trên ev.iky.vn (hiển thị tất cả thông số).',
        en: 'Initial state: key on, screenshot device page on ev.iky.vn (showing all parameters).',
    },
    e2: {
        vi: 'Sạc: cắm sạc → web hiển thị “Đang sạc”, Điện áp tăng, Dòng ≈ 5 A, SOC tiến tới 100% (nếu pin gần đầy).',
        en: 'Charging: plug in → web shows “Charging”, voltage increases, current ≈ 5 A, SOC approaches 100% (if near full).',
    },
    e3: {
        vi: 'Chạy thử: chạy ~200–500 m ở tốc độ ~10 km/h → kiểm tra Vận tốc ≈ 10 km/h trên web, Odo tăng tương ứng.',
        en: 'Test drive: ~200–500 m at ~10 km/h → verify speed ≈ 10 km/h on web, Odo increases accordingly.',
    },
    e4: {
        vi: 'Quan sát SOH, Cycle count, Nhiệt độ: ghi lại nếu có bất thường.',
        en: 'Observe SOH, cycle count, temperature: record anomalies if any.',
    },
    e5: {
        vi: 'Lưu ảnh màn hình (có timestamp) và ảnh vị trí lắp.',
        en: 'Save screenshots (with timestamp) and installation photo.',
    },

    fTitle: {
        vi: 'F. Xử lý nhanh theo trạng thái LED / lỗi thường gặp',
        en: 'F. Quick handling by LED status / common issues',
    },
    f1: {
        vi: 'GSM tắt: kiểm tra nguồn, cầu chì, SIM, đo điện áp.',
        en: 'GSM off: check power, fuse, SIM, measure voltage.',
    },
    f2: {
        vi: 'GSM sáng (tìm mạng): kiểm tra SIM, vị trí lắp, chờ 1–3 phút.',
        en: 'GSM on (searching): check SIM, placement, wait 1–3 minutes.',
    },
    f3: {
        vi: 'GSM nhấp nháy nhưng offline trên web: kiểm tra mapping IMEI → thiết bị trên ev.iky.vn, chụp ảnh LED và báo support.',
        en: 'GSM blinking but offline on web: check IMEI mapping on ev.iky.vn, take LED photo and contact support.',
    },
    f4: {
        vi: 'GPS tắt / tìm vệ tinh lâu: đưa xe ra khu vực mở, chờ 2–5 phút, kiểm tra vị trí lắp.',
        en: 'GPS off / long fix: move to open area, wait 2–5 minutes, check installation position.',
    },
    f5: {
        vi: 'Giá trị điện/SOC sai: kiểm tra dây đo/shunt/CAN mapping, scaling, firmware.',
        en: 'Wrong voltage/SOC: check measurement wiring/shunt/CAN mapping, scaling, firmware.',
    },

    gTitle: { vi: 'G. Tiêu chí nghiệm thu tổng quát', en: 'G. General acceptance criteria' },
    gNote: {
        vi: 'Lưu ý: các giá trị kiểm tra trong checklist là tham khảo; các giá trị thực tế có thể khác nhau tùy vào model xe, cấu hình pin, cảm biến và cách tích hợp. Kỹ thuật viên cần đánh giá tính hợp lý theo thông số kỹ thuật của xe cụ thể và ghi rõ nếu có sai lệch.',
        en: 'Note: checklist values are for reference; actual values may vary by vehicle model, battery configuration, sensors, and integration. Technician should judge reasonableness per vehicle specs and note deviations.',
    },
    g1: {
        vi: 'Thiết bị Online trên ev.iky.vn với timestamp mới',
        en: 'Device online on ev.iky.vn with fresh timestamp',
    },
    g2: {
        vi: 'LED GSM thể hiện trạng thái mạng; nhấp nháy = truyền dữ liệu qua 4G LTE',
        en: 'GSM LED indicates network; blinking = transmitting via 4G LTE',
    },
    g3: { vi: 'LED GPS nhấp nháy khi có fix ở vùng mở', en: 'GPS LED blinks when fixed in open area' },
    g4: { vi: 'Vị trí GPS trên web khớp với thực tế', en: 'GPS location matches reality' },
    g5: {
        vi: 'Vận tốc ≈ 10 km/h (±2 km/h) — (giá trị có thể tùy theo xe)',
        en: 'Speed ≈ 10 km/h (±2 km/h) — (may vary by vehicle)',
    },
    g6: {
        vi: 'Odo tương ứng và tăng khi chạy — (giá trị có thể tùy theo xe)',
        en: 'Odo matches and increases while driving — (may vary)',
    },
    g7: {
        vi: 'Điện áp ≈ 65.48 V (±0.5 V) — (ngưỡng chấp nhận có thể thay đổi theo hệ thống pin)',
        en: 'Voltage ≈ 65.48 V (±0.5 V) — (threshold may vary by battery system)',
    },
    g8: {
        vi: 'Dòng ≈ 5 A (±10% hoặc ±0.5 A) — (giá trị phụ thuộc vào cấu hình sạc)',
        en: 'Current ≈ 5 A (±10% or ±0.5 A) — (depends on charger config)',
    },
    g9: { vi: 'Trạng thái hiển thị “Đang sạc” khi cắm sạc', en: 'Status shows “Charging” when plugged in' },
    g10: {
        vi: 'SOC = 100% (±2–3%) — (có thể khác theo cách tính của BMS)',
        en: 'SOC = 100% (±2–3%) — (may differ by BMS calculation)',
    },
    g11: { vi: 'SOH = 100% — (tham khảo theo dữ liệu BMS)', en: 'SOH = 100% — (reference from BMS)' },
    g12: { vi: 'Cycle count = 24 — (tham khảo)', en: 'Cycle count = 24 — (reference)' },
    g13: { vi: 'Nhiệt độ pin ≈ 23 °C (±1–3 °C)', en: 'Battery temperature ≈ 23 °C (±1–3 °C)' },
    hTitle: {
        vi: 'H. Ghi chú / bất thường (ghi rõ giá trị web và giá trị đo thực tế)',
        en: 'H. Notes / anomalies (record web vs measured values)',
    },
    h1: { vi: 'Ghi chú:', en: 'Notes:' },
    h2: { vi: 'Ảnh / bằng chứng lưu ở:', en: 'Photos / evidence stored at:' },
    hFooter: {
        vi: '(Không yêu cầu chữ ký nghiệm thu — tài liệu dùng cho test nội bộ)',
        en: '(No acceptance signature required — internal testing document)',
    },
};

function PdfSection({ title, children }) {
    return (
        <div
            style={{
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
                marginBottom: 16,
                paddingBottom: 4,
                borderBottom: '1px solid #f0f0f0',
            }}
        >
            <Title level={4} style={{ marginTop: 0, marginBottom: 12 }}>
                {title}
            </Title>
            {children}
        </div>
    );
}

function AcceptanceDocument({
    tr,
    lang,
    formatToday,
    acceptanceData,
    diagData,
    checks,
    technicianName,
    simNumber,
    installPosition,
    noteText,
    evidenceText,
    isPdf = false,
}) {
    const wrapperStyle = isPdf
        ? {
              width: '760px',
              background: '#fff',
              color: '#000',
              padding: '20px 24px',
              boxSizing: 'border-box',
              fontSize: 12,
              lineHeight: 1.45,
              fontFamily: 'RobotoPDF, Arial, sans-serif',
          }
        : {};

    const listStyle = isPdf ? { paddingLeft: 20, marginBottom: 8 } : undefined;
    const textSecondaryStyle = isPdf ? { color: '#666' } : {};
    const SectionWrapper = isPdf ? PdfSection : React.Fragment;

    const renderSection = (title, content) => {
        if (isPdf) {
            return <PdfSection title={title}>{content}</PdfSection>;
        }
        return (
            <>
                <Title level={4}>{title}</Title>
                {content}
                <Divider />
            </>
        );
    };

    return (
        <div style={wrapperStyle}>
            <div
                className={styles.acceptanceHeader}
                style={isPdf ? { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 } : {}}
            >
                <img
                    src={logo?.src}
                    alt="IKY-GPS Logo"
                    className={styles.acceptanceLogo}
                    style={isPdf ? { width: 54, height: 'auto' } : {}}
                />
                <div>
                    <Title
                        level={3}
                        className={styles.acceptanceTitle}
                        style={isPdf ? { margin: 0, fontSize: 24, lineHeight: 1.2 } : {}}
                    >
                        {tr('title')}
                    </Title>
                    <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                        {formatToday(lang)}
                    </Text>
                </div>
            </div>

            {!isPdf && <Divider />}

            {renderSection(
                tr('safetyTitle'),
                <ul className={styles.supportList} style={listStyle}>
                    <li>{tr('safety1')}</li>
                    <li>{tr('safety2')}</li>
                </ul>,
            )}

            {renderSection(
                tr('deviceInfoTitle'),
                <ul className={styles.supportList} style={listStyle}>
                    <li>
                        {tr('imei')}: {lineValue(acceptanceData?.imei)}
                    </li>
                    <li>
                        {tr('sim')}: {lineValue(simNumber)}
                    </li>
                    <li>
                        {tr('tech')}: {lineValue(technicianName)}
                    </li>
                    <li>
                        {tr('customer')}: {lineValue(acceptanceData?.customer)}
                    </li>
                    <li>
                        {tr('installTime')}: {lineValue(acceptanceData?.installTime)}
                    </li>
                    <li>
                        {tr('installPos')}: {lineValue(installPosition)}
                    </li>
                    <li>
                        {tr('plateLabel')}: {lineValue(acceptanceData?.plate)}
                    </li>
                    <li>
                        {tr('vehicleTypeLabel')}: {lineValue(acceptanceData?.vehicle)}
                    </li>
                    <li>
                        {tr('deviceNameLabel')}: {lineValue(acceptanceData?.deviceName)}
                    </li>
                </ul>,
            )}

            {renderSection(
                tr('aTitle'),
                <ul className={styles.checkList} style={listStyle}>
                    <li>☐ {tr('a1')}</li>
                    <li>☐ {tr('a2')}</li>
                    <li>☐ {tr('a3')}</li>
                    <li>☐ {tr('a4')}</li>
                    <li>☐ {tr('a5')}</li>
                    <li>☐ {tr('a6')}</li>
                </ul>,
            )}

            {renderSection(
                tr('bTitle'),
                <>
                    <Paragraph>{tr('bP1')}</Paragraph>
                    <Paragraph>
                        {tr('bP2')} <b>GSM</b> ______ <b>GPS</b> ______
                    </Paragraph>

                    <Title level={5}>{tr('ledMeaningTitle')}</Title>

                    <Paragraph>
                        <b>{tr('gsmTitle')}:</b>
                    </Paragraph>
                    <ul className={styles.supportList} style={listStyle}>
                        <li>{tr('gsmOff')}</li>
                        <li>{tr('gsmOn')}</li>
                        <li>{tr('gsmBlink')}</li>
                    </ul>

                    <Paragraph>
                        <b>{tr('gpsTitle')}:</b>
                    </Paragraph>
                    <ul className={styles.supportList} style={listStyle}>
                        <li>{tr('gpsOff')}</li>
                        <li>{tr('gpsOn')}</li>
                        <li>{tr('gpsBlink')}</li>
                    </ul>

                    <ul className={styles.checkList} style={listStyle}>
                        <li>☐ {tr('bCheck')}</li>
                    </ul>
                </>,
            )}

            {renderSection(
                tr('cTitle'),
                <>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>☐ {tr('c1')}</li>
                        <li>☐ {tr('c2')}</li>
                        <li>☐ {tr('c3')}</li>
                    </ul>

                    <Title level={5}>{tr('importantVehicleTitle')}</Title>
                    <Paragraph>{tr('importantVehicleP')}</Paragraph>
                </>,
            )}

            {renderSection(
                tr('dTitle'),
                <div style={{ marginBottom: 12 }}>
                    <Paragraph>
                        <b>{tr('d_speed')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_speed_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_speed_check')}
                            {acceptanceData?.speed !== undefined && acceptanceData?.speed !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.speed} km/h)
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_odo')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_odo_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_odo_check')}
                            {acceptanceData?.odo !== undefined && acceptanceData?.odo !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.odo} km)
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_volt')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_volt_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_volt_check')}
                            {acceptanceData?.voltage !== undefined && acceptanceData?.voltage !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.voltage} V)
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_current')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_current_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_current_check')}
                            {acceptanceData?.current !== undefined && acceptanceData?.current !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.current} A)
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_status')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_status_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_status_check')}
                            {acceptanceData?.batteryStatus && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.batteryStatus})
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_soc')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_soc_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_soc_check')}
                            {acceptanceData?.soc !== undefined && acceptanceData?.soc !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.soc}%)
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_soh')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_soh_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_soh_check')}
                            {acceptanceData?.soh !== undefined && acceptanceData?.soh !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.soh}%)
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_cycle')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_cycle_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_cycle_check')}
                            {acceptanceData?.cycle !== undefined && acceptanceData?.cycle !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.cycle})
                                </Text>
                            )}
                        </li>
                    </ul>

                    <Paragraph>
                        <b>{tr('d_temp')}</b>
                        <br />
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            - {tr('d_temp_sample')}
                        </Text>
                    </Paragraph>
                    <ul className={styles.checkList} style={listStyle}>
                        <li>
                            ☐ {tr('d_temp_check')}
                            {acceptanceData?.temperature !== undefined && acceptanceData?.temperature !== null && (
                                <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                                    {' '}
                                    ({acceptanceData.temperature} °C)
                                </Text>
                            )}
                        </li>
                    </ul>
                </div>,
            )}

            {renderSection(
                tr('eTitle'),
                <ol className={styles.supportList} style={listStyle}>
                    <li>{tr('e1')}</li>
                    <li>{tr('e2')}</li>
                    <li>{tr('e3')}</li>
                    <li>{tr('e4')}</li>
                    <li>{tr('e5')}</li>
                </ol>,
            )}

            {renderSection(
                tr('fTitle'),
                <ul className={styles.supportList} style={listStyle}>
                    <li>{tr('f1')}</li>
                    <li>{tr('f2')}</li>
                    <li>{tr('f3')}</li>
                    <li>{tr('f4')}</li>
                    <li>{tr('f5')}</li>
                </ul>,
            )}

            {renderSection(
                tr('gTitle'),
                <>
                    {isPdf ? (
                        <Paragraph style={{ marginBottom: 12 }}>
                            <Text type="secondary" style={textSecondaryStyle}>
                                {tr('gNote')}
                            </Text>
                        </Paragraph>
                    ) : (
                        <Alert message={tr('gNote')} type="warning" showIcon style={{ marginBottom: 12 }} />
                    )}

                    <ul className={styles.checkList} style={listStyle}>
                        <li>☐ {tr('g1')}</li>
                        <li>☐ {tr('g2')}</li>
                        <li>☐ {tr('g3')}</li>
                        <li>☐ {tr('g4')}</li>
                        <li>☐ {tr('g5')}</li>
                        <li>☐ {tr('g6')}</li>
                        <li>☐ {tr('g7')}</li>
                        <li>☐ {tr('g8')}</li>
                        <li>☐ {tr('g9')}</li>
                        <li>☐ {tr('g10')}</li>
                        <li>☐ {tr('g11')}</li>
                        <li>☐ {tr('g12')}</li>
                        <li>☐ {tr('g13')}</li>
                    </ul>
                </>,
            )}

            {renderSection(
                tr('criteriaTitle'),
                <ul className={styles.supportList} style={listStyle}>
                    <li>
                        {tr('foundDevice')}: {passFailText(!!checks?.deviceFound, lang)}
                    </li>
                    <li>
                        {tr('online')}:{' '}
                        {checks?.onlineOk === null
                            ? '--'
                            : `${passFailText(checks?.onlineOk, lang)}${
                                  checks?.lastCruiseAgeMin !== null
                                      ? lang === 'en'
                                          ? ` (${checks?.lastCruiseAgeMin} min)`
                                          : ` (${checks?.lastCruiseAgeMin} phút)`
                                      : ''
                              }`}
                    </li>
                    <li>
                        {tr('gpsHasCoord')}: {passFailText(checks?.gpsOk, lang)}
                    </li>
                    <li>
                        {tr('batteryUpdated')}:{' '}
                        {lineValue(formatDateTime(diagData?.battery?.updatedAt || diagData?.battery?.time), '--')}
                    </li>
                    <li>
                        {tr('batteryVoltage')}: {lineValue(acceptanceData?.voltage, '--')} V
                    </li>
                    <li>
                        {tr('soc')}: {lineValue(acceptanceData?.soc, '--')} %
                    </li>
                    <li>
                        {tr('batteryStatus')}: {lineValue(acceptanceData?.batteryStatus, '--')}
                    </li>
                    <li>
                        {tr('lastCruiseLatLon')}:{' '}
                        {acceptanceData?.lat !== undefined && acceptanceData?.lon !== undefined
                            ? `${acceptanceData.lat} / ${acceptanceData.lon}`
                            : '____________________'}
                    </li>
                    <li>
                        {tr('firmware')}: {lineValue(acceptanceData?.firmware)}
                    </li>
                    <li>Odo: {lineValue(acceptanceData?.odo)}</li>
                    <li>Speed: {lineValue(acceptanceData?.speed)}</li>
                    <li>Current: {lineValue(acceptanceData?.current)}</li>
                    <li>SOH: {lineValue(acceptanceData?.soh)}</li>
                    <li>Cycle: {lineValue(acceptanceData?.cycle)}</li>
                    <li>Temperature: {lineValue(acceptanceData?.temperature)} °C</li>
                </ul>,
            )}

            {renderSection(
                tr('hTitle'),
                <>
                    <ul className={styles.supportList} style={listStyle}>
                        <li>
                            <b>{tr('h1')}</b>{' '}
                            {lineValue(noteText, '___________________________________________________________')}
                        </li>
                        <li>
                            <b>{tr('h2')}</b> {lineValue(evidenceText, '_____________________________________________')}
                        </li>
                    </ul>
                    <Paragraph>
                        <Text type="secondary" style={isPdf ? textSecondaryStyle : {}}>
                            {tr('hFooter')}
                        </Text>
                    </Paragraph>
                </>,
            )}
        </div>
    );
}

export default function InstallAcceptanceProcess() {
    const pathname = usePathname() || '/';

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    const lang = useMemo(() => {
        if (typeof window === 'undefined') return 'vi';
        if (isEnFromPath) {
            try {
                localStorage.setItem('iky_lang', 'en');
            } catch {}
            return 'en';
        }
        try {
            const saved = localStorage.getItem('iky_lang');
            return saved === 'en' ? 'en' : 'vi';
        } catch {
            return 'vi';
        }
    }, [isEnFromPath]);

    const formatToday = (lang = 'vi') => {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return lang === 'en' ? `Date: ${dd}/${mm}/${yyyy}` : `Ngày: ${dd}/${mm}/${yyyy}`;
    };

    const formatMinutesToHm = (totalMinutes, lang = 'vi') => {
        if (totalMinutes === null || totalMinutes === undefined) return '--';
        const m = Math.max(0, Math.floor(Number(totalMinutes)));
        const h = Math.floor(m / 60);
        const r = m % 60;

        if (lang === 'en') return h > 0 ? `${h}h ${r}m` : `${r}m`;
        return h > 0 ? `${h} giờ ${r} phút` : `${r} phút`;
    };

    const tr = (key) => t[key]?.[lang] ?? key;

    const [searchText, setSearchText] = useState('');
    const [selectedImei, setSelectedImei] = useState('');

    const [diagOpen, setDiagOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [diagErr, setDiagErr] = useState('');
    const [diagData, setDiagData] = useState(null);

    const [technicianName, setTechnicianName] = useState('');
    const [simNumber, setSimNumber] = useState('');
    const [installPosition, setInstallPosition] = useState('');
    const [noteText, setNoteText] = useState('');
    const [evidenceText, setEvidenceText] = useState('');

    const [allDevices, setAllDevices] = useState([]);
    const loadedAllRef = useRef(false);
    const captureRef = useRef(null);
    const pdfRef = useRef(null);

    const getToken = () => {
        try {
            return (
                localStorage.getItem('accessToken') ||
                localStorage.getItem('token') ||
                localStorage.getItem('access_token') ||
                localStorage.getItem('jwt') ||
                ''
            );
        } catch {
            return '';
        }
    };

    const normalizeBattery = (raw) => raw?.batteryStatus || raw;
    const normalizeCruise = (raw) => raw?.cruise || raw;

    const buildAcceptanceData = (sourceDiagData) => {
        if (!sourceDiagData) return null;

        const device = sourceDiagData.device || {};
        const battery = sourceDiagData.battery || {};
        const cruise = sourceDiagData.lastCruise || {};

        return {
            imei: device?.imei || sourceDiagData.imei || '',
            vehicle: device?.vehicle_category_id?.name || '',
            deviceName: device?.device_category_id?.name || '',
            plate: device?.license_plate || '',
            customer: device?.driver || '',
            distributor: device?.distributor_id?.username || '',
            installTime: formatNow(),

            firmware: cruise?.fwr || '',
            lat: cruise?.lat,
            lon: cruise?.lon,
            speed: cruise?.vgp,
            odo: cruise?.mil,
            acc: cruise?.acc,
            cruiseTime: cruise?.updatedAt || cruise?.createdAt || null,

            voltage: battery?.voltage,
            current: battery?.current,
            soc: battery?.soc,
            soh: battery?.soh,
            temperature: battery?.temperature,
            batteryStatus: battery?.status,
            cycle: battery?.chc,
            batteryTime: battery?.updatedAt || battery?.time || null,
        };
    };

    const acceptanceData = useMemo(() => buildAcceptanceData(diagData), [diagData]);

    const checks = useMemo(() => {
        if (!diagData) return null;
        const { device, battery, lastCruise } = diagData;

        const lastCruiseAgeMin = minutesDiff(lastCruise?.updatedAt || lastCruise?.createdAt);
        const batteryAgeMin = minutesDiff(battery?.updatedAt || battery?.time);

        const deviceFound = !!device?._id;
        const onlineOk = lastCruiseAgeMin !== null ? lastCruiseAgeMin <= 5 : null;
        const gpsOk =
            lastCruise?.lat !== undefined &&
            lastCruise?.lat !== null &&
            lastCruise?.lon !== undefined &&
            lastCruise?.lon !== null
                ? true
                : lastCruise
                  ? false
                  : null;

        const voltOk = typeof battery?.voltage === 'number' ? battery.voltage > 0 : null;
        const socOk = typeof battery?.soc === 'number' ? battery.soc >= 0 && battery.soc <= 100 : null;

        return { deviceFound, onlineOk, gpsOk, voltOk, socOk, lastCruiseAgeMin, batteryAgeMin };
    }, [diagData]);

    const exportScreenshot = async () => {
        if (!captureRef.current) return;

        try {
            const canvas = await html2canvas(captureRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
            });

            const link = document.createElement('a');
            link.download = `iky-diagnostic-${diagData?.imei || 'device'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Screenshot error:', err);
        }
    };

    console.log('acceptanceData', acceptanceData);

    const buildPdfFileName = () => {
        const deviceName = slugFileName(acceptanceData?.plate || acceptanceData?.vehicle || 'device');
        const dateStr = formatFileDateTime(new Date());

        if (lang === 'en') {
            return `acceptance-report-${deviceName}-${dateStr}.pdf`;
        }

        return `phieu-nghiem-thu-${deviceName}-${dateStr}.pdf`;
    };

    const exportAcceptancePDF = async () => {
        if (!diagData || !pdfRef.current) return;

        try {
            const fileName = buildPdfFileName();

            if (document?.fonts?.ready) {
                await document.fonts.ready;
            }

            const canvas = await html2canvas(pdfRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: 760,
                windowWidth: 760,
            });

            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const totalPages = pdf.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(9);
                pdf.setTextColor(120);
                pdf.text(`${i}/${totalPages}`, pageWidth - 18, pageHeight - 6);
            }

            pdf.save(fileName);
        } catch (err) {
            console.error('PDF export error:', err);
        }
    };

    const ensureAllDevicesLoaded = async () => {
        if (loadedAllRef.current) return;
        loadedAllRef.current = true;
        setLoadingDevices(true);
        try {
            const res = await getDevices();
            const list = res?.devices || res?.data || res || [];
            setAllDevices(Array.isArray(list) ? list : []);
        } catch (e) {
            loadedAllRef.current = false;
            console.error(e);
        } finally {
            setLoadingDevices(false);
        }
    };

    const runDiagnostic = async (imeiArg) => {
        const imei = String(imeiArg || '').trim();
        setDiagErr('');
        setDiagData(null);

        if (!isValidImei(imei)) {
            setDiagErr(tr('invalidImei'));
            setDiagOpen(true);
            return;
        }

        setDiagOpen(true);
        setLoading(true);

        try {
            const token = getToken();

            let fromCache = allDevices.find((d) => String(d?.imei || '') === imei) || null;

            if (!fromCache) {
                const devicesRes = await getDevices({ imei, page: 1, limit: 10 });
                const list = devicesRes?.devices || devicesRes?.data || devicesRes || [];
                fromCache = Array.isArray(list) ? list[0] : null;
            }

            let deviceDetail = fromCache || null;
            if (fromCache?._id && token) {
                try {
                    const detailRes = await getDeviceInfo(token, fromCache._id);
                    deviceDetail = detailRes?.device || detailRes?.data || detailRes || fromCache;
                } catch {
                    deviceDetail = fromCache;
                }
            }

            let battery = null;
            let lastCruise = null;

            if (token) {
                const [bRes, cRes] = await Promise.allSettled([
                    getBatteryStatusByImei(token, imei),
                    getLastCruise(token, imei),
                ]);

                if (bRes.status === 'fulfilled') battery = normalizeBattery(bRes.value);
                if (cRes.status === 'fulfilled') lastCruise = normalizeCruise(cRes.value);
            }

            setDiagData({
                imei,
                tokenPresent: !!token,
                device: deviceDetail,
                battery,
                lastCruise,
            });
        } catch (e) {
            const msg = e?.message || e?.error || (typeof e === 'string' ? e : JSON.stringify(e));
            setDiagErr(tr('errPrefix') + msg);
        } finally {
            setLoading(false);
        }
    };

    const options = useMemo(() => {
        const kw = String(searchText || '')
            .trim()
            .toLowerCase();
        const src = allDevices || [];
        if (!src.length) return [];

        const filtered = !kw
            ? src.slice(0, 30)
            : src
                  .filter((d) => {
                      const imei = String(d?.imei || '').toLowerCase();
                      const plate = String(d?.license_plate || '').toLowerCase();
                      const vname = String(d?.vehicle_category_id?.name || '').toLowerCase();
                      const dname = String(d?.device_category_id?.name || '').toLowerCase();
                      return imei.includes(kw) || plate.includes(kw) || vname.includes(kw) || dname.includes(kw);
                  })
                  .slice(0, 50);

        return filtered.map((d) => {
            const imei = String(d?.imei || '');
            const plate = String(d?.license_plate || '');
            const vname = String(d?.vehicle_category_id?.name || '');
            const dname = String(d?.device_category_id?.name || '');

            return {
                value: imei,
                label: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <Text strong>{highlight(imei, searchText)}</Text>
                            {plate ? <Text type="secondary">{highlight(plate, searchText)}</Text> : null}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {vname ? <Text type="secondary">{highlight(vname, searchText)}</Text> : null}
                            {dname ? <Text type="secondary">• {highlight(dname, searchText)}</Text> : null}
                        </div>
                    </div>
                ),
            };
        });
    }, [allDevices, searchText]);

    useEffect(() => {
        if (!diagData) return;

        if (!installPosition) {
            const v = diagData?.device?.vehicle_category_id?.name || '';
            if (v) setInstallPosition(v);
        }
    }, [diagData, installPosition]);

    return (
        <>
            <Card variant={false} className={styles.supportCard}>
                <div className={styles.acceptanceHeader}>
                    <Image
                        src={logo?.src}
                        alt="IKY-GPS Logo"
                        width={120}
                        height={40}
                        className={styles.acceptanceLogo}
                    />
                    <div>
                        <Title level={3} className={styles.acceptanceTitle}>
                            {tr('title')}
                        </Title>
                        <Text type="secondary">{formatToday(lang)}</Text>
                    </div>
                </div>

                <Divider />

                <Card size="small" style={{ background: 'rgba(0,0,0,0.02)' }}>
                    <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                        <Text strong>{tr('diagBlockTitle')}</Text>

                        <div className={styles.diagRow}>
                            <AutoComplete
                                className={styles.imeiAuto}
                                options={options}
                                value={searchText}
                                onFocus={ensureAllDevicesLoaded}
                                onSearch={async (v) => {
                                    setSearchText(v);
                                    setSelectedImei(v);
                                    if (!loadedAllRef.current) await ensureAllDevicesLoaded();
                                }}
                                onSelect={(value) => {
                                    setSearchText(value);
                                    setSelectedImei(value);
                                    runDiagnostic(value);
                                }}
                                notFoundContent={loadingDevices ? <Spin size="small" /> : null}
                                allowClear
                                popupMatchSelectWidth={false}
                            >
                                <Input
                                    placeholder={tr('imeiPlaceholder')}
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="off"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            runDiagnostic(selectedImei || searchText);
                                        }
                                    }}
                                />
                            </AutoComplete>

                            <Button
                                className={styles.diagBtn}
                                type="primary"
                                onClick={() => runDiagnostic(selectedImei || searchText)}
                                loading={loading}
                            >
                                {tr('diagnoseBtn')}
                            </Button>
                        </div>

                        <Text type="secondary">{tr('diagHint')}</Text>
                    </Space>
                </Card>

                <Divider />

                <Title level={5}>Thông tin bổ sung trước khi xuất PDF</Title>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input
                        placeholder="Kỹ thuật viên"
                        value={technicianName}
                        onChange={(e) => setTechnicianName(e.target.value)}
                    />
                    <Input placeholder="SIM / IMSI" value={simNumber} onChange={(e) => setSimNumber(e.target.value)} />
                    <Input
                        placeholder="Vị trí lắp"
                        value={installPosition}
                        onChange={(e) => setInstallPosition(e.target.value)}
                    />
                    <Input
                        placeholder="Ghi chú / bất thường"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                    />
                    <Input
                        placeholder="Ảnh / bằng chứng lưu ở"
                        value={evidenceText}
                        onChange={(e) => setEvidenceText(e.target.value)}
                    />
                </div>

                <Divider />

                <AcceptanceDocument
                    tr={tr}
                    lang={lang}
                    formatToday={formatToday}
                    acceptanceData={acceptanceData}
                    diagData={diagData}
                    checks={checks}
                    technicianName={technicianName}
                    simNumber={simNumber}
                    installPosition={installPosition}
                    noteText={noteText}
                    evidenceText={evidenceText}
                    isPdf={false}
                />

                <Divider />

                <Space wrap>
                    <Button onClick={exportScreenshot} disabled={!diagData}>
                        {tr('screenshotBtn')}
                    </Button>
                    <Button type="primary" onClick={exportAcceptancePDF} disabled={!diagData}>
                        Xuất PDF nghiệm thu
                    </Button>
                </Space>

                <Modal
                    open={diagOpen}
                    onCancel={() => setDiagOpen(false)}
                    footer={null}
                    width={920}
                    title={tr('diagModalTitle')}
                >
                    {loading ? (
                        <div style={{ padding: 24, textAlign: 'center' }}>
                            <Spin />
                        </div>
                    ) : diagErr ? (
                        <Alert type="error" message={diagErr} showIcon />
                    ) : !diagData ? (
                        <Alert type="info" message={tr('diagEmpty')} showIcon />
                    ) : (
                        <div ref={captureRef}>
                            <Descriptions bordered size="small" column={2} style={{ marginBottom: 12 }}>
                                <Descriptions.Item label={tr('imeiLabel')}>{diagData.imei}</Descriptions.Item>
                                <Descriptions.Item label={tr('deviceIdLabel')}>
                                    {safe(diagData.device?._id)}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('plateLabel')}>
                                    {safe(diagData.device?.license_plate)}
                                </Descriptions.Item>
                                <Descriptions.Item label={tr('vehicleTypeLabel')}>
                                    {safe(diagData.device?.vehicle_category_id?.name)}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('deviceNameLabel')}>
                                    {safe(diagData.device?.device_category_id?.name)}
                                </Descriptions.Item>
                                <Descriptions.Item label={tr('acc')}>
                                    {diagData.lastCruise ? safe(diagData.lastCruise?.acc) : '--'}
                                </Descriptions.Item>
                            </Descriptions>

                            <Title level={5} style={{ marginTop: 0 }}>
                                {tr('criteriaTitle')}
                            </Title>

                            <Descriptions bordered size="small" column={2} style={{ marginBottom: 12 }}>
                                <Descriptions.Item label={tr('foundDevice')}>
                                    {passFailTag(!!checks?.deviceFound, lang)}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('online')}>
                                    {passFailTag(checks?.onlineOk, lang)}{' '}
                                    <Text type="secondary">
                                        {checks?.lastCruiseAgeMin !== null
                                            ? `(${formatMinutesToHm(checks?.lastCruiseAgeMin, lang)})`
                                            : ''}
                                    </Text>
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('gpsHasCoord')}>
                                    {passFailTag(checks?.gpsOk, lang)}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('batteryUpdated')}>
                                    {diagData.battery
                                        ? `${formatDateTime(diagData.battery?.updatedAt || diagData.battery?.time)}${
                                              checks?.batteryAgeMin !== null
                                                  ? ` (${formatMinutesToHm(checks?.batteryAgeMin, lang)})`
                                                  : ''
                                          }`
                                        : '--'}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('batteryVoltage')}>
                                    {diagData.battery ? (
                                        <>
                                            {passFailTag(checks?.voltOk, lang)} {safe(diagData.battery?.voltage)} V
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('soc')}>
                                    {diagData.battery ? (
                                        <>
                                            {passFailTag(checks?.socOk, lang)} {safe(diagData.battery?.soc)} %
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('batteryStatus')}>
                                    {diagData.battery ? safe(diagData.battery?.status) : '--'}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('lastCruiseLatLon')}>
                                    {acceptanceData?.lat !== undefined && acceptanceData?.lon !== undefined
                                        ? `${acceptanceData.lat} / ${acceptanceData.lon}`
                                        : '--'}
                                </Descriptions.Item>

                                <Descriptions.Item label={tr('firmware')}>
                                    {acceptanceData?.firmware || '--'}
                                </Descriptions.Item>
                            </Descriptions>

                            <Space wrap>
                                <Button onClick={() => runDiagnostic(diagData.imei)}>{tr('refreshBtn')}</Button>
                                <Button onClick={exportScreenshot}>{tr('screenshotBtn')}</Button>
                                <Button type="primary" onClick={exportAcceptancePDF} disabled={!diagData}>
                                    Xuất PDF nghiệm thu
                                </Button>
                                <Button onClick={() => setDiagOpen(false)}>{tr('closeBtn')}</Button>
                            </Space>
                        </div>
                    )}
                </Modal>
            </Card>

            {/* Hidden PDF content */}
            <div
                style={{
                    position: 'fixed',
                    left: '-99999px',
                    top: 0,
                    zIndex: -1,
                    background: '#fff',
                    width: '760px',
                }}
            >
                <div ref={pdfRef}>
                    <AcceptanceDocument
                        tr={tr}
                        lang={lang}
                        formatToday={formatToday}
                        acceptanceData={acceptanceData}
                        diagData={diagData}
                        checks={checks}
                        technicianName={technicianName}
                        simNumber={simNumber}
                        installPosition={installPosition}
                        noteText={noteText}
                        evidenceText={evidenceText}
                        isPdf={true}
                    />
                </div>
            </div>
        </>
    );
}
