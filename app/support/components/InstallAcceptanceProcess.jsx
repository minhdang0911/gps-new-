'use client';

import React, { useMemo } from 'react';
import { Card, Typography, Divider } from 'antd';
import { usePathname } from 'next/navigation';
import styles from '../SupportPage.module.css';
import logo from '../../assets/logo-iky.webp';

const { Title, Paragraph } = Typography;

// ====== i18n labels ======
const t = {
    title: { vi: 'Quy trình nghiệm thu lắp đặt iKY-GPS', en: 'iKY-GPS Installation Acceptance Process' },

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

    gsmTitle: { vi: 'LED GSM:', en: 'GSM LED:' },
    gsmOff: { vi: 'Tắt (Off): Thiết bị chưa khởi động.', en: 'Off: Device not started.' },
    gsmOn: { vi: 'Sáng: đang tìm mạng / chưa đăng ký mạng.', en: 'On: Searching network / not registered.' },
    gsmBlink: {
        vi: 'Nhấp nháy: đã đăng ký mạng, đang truyền dữ liệu (kết nối 4G LTE).',
        en: 'Blinking: Registered and transmitting data (4G LTE).',
    },

    gpsTitle: { vi: 'LED GPS:', en: 'GPS LED:' },
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
        vi: 'Lưu ý: Thiết bị xuất xưởng chưa biết sẽ lắp cho loại xe nào. Nếu loại xe (Vehicle type / Profile) trên ev.iky.vn chưa khớp với xe thực tế, cần cấu hình lại trước khi nghiệm thu',
        en: 'Note: Factory default profile may not match the actual vehicle. If Vehicle type/Profile on ev.iky.vn is incorrect, reconfigure it before acceptance.',
    },

    dTitle: {
        vi: 'D. Thông tin GPS / Pin cần kiểm tra kỹ trên ev.iky.vn (Giá trị mẫu hiện trường để so sánh)',
        en: 'D. GPS / Battery parameters to verify on ev.iky.vn (sample field values for reference)',
    },

    speed: { vi: 'Vận tốc (Speed)', en: 'Speed' },
    odo: { vi: 'Odo (Quãng đường tích lũy)', en: 'Odometer (Accumulated distance)' },
    voltage: { vi: 'Điện áp (Battery Voltage)', en: 'Battery Voltage' },
    current: { vi: 'Dòng sạc/xả (Current)', en: 'Charge/Discharge Current' },
    status: { vi: 'Trạng thái (Status)', en: 'Status' },
    soc: { vi: 'Trạng thái sạc (SOC)', en: 'State of Charge (SOC)' },
    soh: { vi: 'Sức khỏe pin (SOH)', en: 'State of Health (SOH)' },
    cycle: { vi: 'Chu kỳ sạc/xả (Cycle count)', en: 'Cycle Count' },
    temp: { vi: 'Nhiệt độ pin (Battery Temperature)', en: 'Battery Temperature' },

    sample: { vi: 'Giá trị mẫu', en: 'Sample value' },
    check: { vi: 'Kiểm tra', en: 'Check' },

    eTitle: { vi: 'E. Kịch bản kiểm tra ngắn (thực hiện tại hiện trường)', en: 'E. Quick Field Test Scenario' },

    fTitle: {
        vi: 'F. Xử lý nhanh theo trạng thái LED / lỗi thường gặp',
        en: 'F. Quick Troubleshooting (LED status / common issues)',
    },

    gTitle: { vi: 'G. Tiêu chí nghiệm thu tổng quát', en: 'G. General Acceptance Criteria' },

    hTitle: {
        vi: 'H. Ghi chú / bất thường (ghi rõ giá trị web và giá trị đo thực tế)',
        en: 'H. Notes / Abnormalities (record web values and measured values)',
    },
    note: { vi: 'Ghi chú', en: 'Notes' },
    evidence: { vi: 'Ảnh / bằng chứng lưu ở', en: 'Photos / evidence saved at' },

    internalOnly: {
        vi: '(Không yêu cầu chữ ký nghiệm thu — tài liệu dùng cho test nội bộ)',
        en: '(No acceptance signature required — for internal testing only)',
    },
};

export default function InstallAcceptanceProcess() {
    const pathname = usePathname() || '/';

    // detect /en from URL (giống Navbar: check segment cuối)
    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    // derive ngôn ngữ, KHÔNG setState trong effect nữa
    const lang = useMemo(() => {
        if (typeof window === 'undefined') return 'vi'; // SSR fallback
        if (isEnFromPath) {
            // optional: sync lại localStorage (không setState)
            try {
                localStorage.setItem('iky_lang', 'en');
            } catch (e) {}
            return 'en';
        }
        try {
            const saved = localStorage.getItem('iky_lang');
            return saved === 'en' ? 'en' : 'vi';
        } catch (e) {
            return 'vi';
        }
    }, [isEnFromPath]);

    const tr = (key) => t[key][lang];

    return (
        <Card variant={false} className={styles.supportCard}>
            <div className={styles.acceptanceHeader}>
                <img src={logo?.src} alt="iKY-GPS Logo" className={styles.acceptanceLogo} />
                <div>
                    <Title level={3} className={styles.acceptanceTitle}>
                        {tr('title')}
                    </Title>
                </div>
            </div>

            <Divider />

            <Title level={4}>{tr('safetyTitle')}</Title>
            <ul className={styles.supportList}>
                <li>{tr('safety1')}</li>
                <li>{tr('safety2')}</li>
            </ul>

            <Divider />

            <Title level={4}>{tr('deviceInfoTitle')}</Title>
            <ul className={styles.supportList}>
                <li>{tr('imei')}: ____________________</li>
                <li>{tr('sim')}: ____________________</li>
                <li>{tr('tech')}: ____________________</li>
                <li>{tr('customer')}: ____________________</li>
                <li>{tr('installTime')}: ____________________</li>
                <li>{tr('installPos')}: ____________________</li>
            </ul>

            <Divider />

            <Title level={4}>{tr('aTitle')}</Title>
            <ul className={styles.checkList}>
                <li>☐ {tr('a1')}</li>
                <li>☐ {tr('a2')}</li>
                <li>☐ {tr('a3')}</li>
                <li>☐ {tr('a4')}</li>
                <li>☐ {tr('a5')}</li>
                <li>☐ {tr('a6')}</li>
            </ul>

            <Divider />

            <Title level={4}>{tr('bTitle')}</Title>
            <Paragraph>{t.bP1[lang]}</Paragraph>
            <Paragraph>
                {t.bP2[lang]} <b>GSM</b> ______ <b>GPS</b> ______
            </Paragraph>

            <Title level={5}>{t.ledMeaningTitle[lang]}</Title>

            <Paragraph>
                <b>{t.gsmTitle[lang]}</b>
            </Paragraph>
            <ul className={styles.supportList}>
                <li>
                    <b>Off:</b> {t.gsmOff[lang]}
                </li>
                <li>
                    <b>On:</b> {t.gsmOn[lang]}
                </li>
                <li>
                    <b>Blink:</b> {t.gsmBlink[lang]}
                </li>
            </ul>

            <Paragraph>
                <b>{t.gpsTitle[lang]}</b>
            </Paragraph>
            <ul className={styles.supportList}>
                <li>
                    <b>Off:</b> {t.gpsOff[lang]}
                </li>
                <li>
                    <b>On:</b> {t.gpsOn[lang]}
                </li>
                <li>
                    <b>Blink:</b> {t.gpsBlink[lang]}
                </li>
            </ul>

            <ul className={styles.checkList}>
                <li>☐ {t.bCheck[lang]}</li>
            </ul>

            <Divider />

            <Title level={4}>{t.cTitle[lang]}</Title>
            <ul className={styles.checkList}>
                <li>☐ {t.c1[lang]}</li>
                <li>☐ {t.c2[lang]}</li>
                <li>☐ {t.c3[lang]}</li>
            </ul>

            <Title level={5}>{t.importantVehicleTitle[lang]}</Title>
            <Paragraph>{t.importantVehicleP[lang]}</Paragraph>

            <Divider />

            <Title level={4}>{t.dTitle[lang]}</Title>

            <div className={styles.acceptanceBlock}>
                <Paragraph>
                    <b>{t.speed[lang]}</b>
                    <br />- {t.sample[lang]}: ~10 km/h
                    <br />☐ {t.check[lang]}: ≈ 10 km/h (±2 km/h)
                </Paragraph>

                <Paragraph>
                    <b>{t.odo[lang]}</b>
                    <br />- {t.sample[lang]}: 2269.8 km
                    <br />☐{' '}
                    {lang === 'vi'
                        ? 'Odo trên web tương ứng / tăng khi chạy thử'
                        : 'Odo matches / increases during test drive'}
                </Paragraph>

                <Paragraph>
                    <b>{t.voltage[lang]}</b>
                    <br />- {t.sample[lang]}: 65.48 V
                    <br />☐ {t.check[lang]}: ≈ 65.48 V (±0.5 V)
                </Paragraph>

                <Paragraph>
                    <b>{t.current[lang]}</b>
                    <br />- {t.sample[lang]}: 5 A
                    <br />☐ {t.check[lang]}: ≈ 5 A (±10% hoặc ±0.5 A)
                </Paragraph>

                <Paragraph>
                    <b>{t.status[lang]}</b>
                    <br />- {t.sample[lang]}: {lang === 'vi' ? 'Đang sạc' : 'Charging'}
                    <br />☐{' '}
                    {lang === 'vi' ? 'Web hiển thị “Đang sạc” khi cắm sạc' : 'Web shows “Charging” when plugged in'}
                </Paragraph>

                <Paragraph>
                    <b>{t.soc[lang]}</b>
                    <br />- {t.sample[lang]}: 100%
                    <br />☐ {t.check[lang]}: 100% (±2–3%)
                </Paragraph>

                <Paragraph>
                    <b>{t.soh[lang]}</b>
                    <br />- {t.sample[lang]}: 100%
                    <br />☐ {t.check[lang]}: 100%
                </Paragraph>

                <Paragraph>
                    <b>{t.cycle[lang]}</b>
                    <br />- {t.sample[lang]}: 24
                    <br />☐ {t.check[lang]}: 24
                </Paragraph>

                <Paragraph>
                    <b>{t.temp[lang]}</b>
                    <br />- {t.sample[lang]}: 23 °C
                    <br />☐ {t.check[lang]}: ≈ 23 °C (±1–3 °C)
                </Paragraph>
            </div>

            <Divider />

            <Title level={4}>{t.eTitle[lang]}</Title>
            <ol className={styles.supportList}>
                <li>
                    {lang === 'vi'
                        ? 'Trạng thái ban đầu: bật khóa, chụp ảnh màn hình trang thiết bị trên ev.iky.vn (hiển thị tất cả thông số).'
                        : 'Initial state: turn the key on and capture a screenshot of the device page on ev.iky.vn (all parameters visible).'}
                </li>
                <li>
                    {lang === 'vi'
                        ? 'Sạc: cắm sạc → web hiển thị “Đang sạc”, Điện áp tăng, Dòng ≈ 5 A, SOC tiến tới 100% (nếu pin gần đầy).'
                        : 'Charging: plug in → web shows “Charging”, voltage increases, current ≈ 5 A, SOC moves toward 100% (if near full).'}
                </li>
                <li>
                    {lang === 'vi'
                        ? 'Chạy thử: chạy ~200–500 m ở tốc độ ~10 km/h → kiểm tra Vận tốc ≈ 10 km/h trên web, Odo tăng tương ứng.'
                        : 'Test drive: run ~200–500 m at ~10 km/h → verify speed ≈ 10 km/h on web and odometer increases accordingly.'}
                </li>
                <li>
                    {lang === 'vi'
                        ? 'Quan sát SOH, Cycle count, Nhiệt độ: ghi lại nếu có bất thường.'
                        : 'Observe SOH, cycle count, temperature: record anomalies.'}
                </li>
                <li>
                    {lang === 'vi'
                        ? 'Lưu ảnh màn hình (có timestamp) và ảnh vị trí lắp.'
                        : 'Save screenshots (with timestamp) and install photos.'}
                </li>
            </ol>

            <Divider />

            <Title level={4}>{t.fTitle[lang]}</Title>
            <ul className={styles.supportList}>
                <li>
                    <b>{lang === 'vi' ? 'GSM tắt' : 'GSM off'}:</b>{' '}
                    {lang === 'vi'
                        ? 'kiểm tra nguồn, cầu chì, SIM, đo điện áp.'
                        : 'check power, fuse, SIM, measure voltage.'}
                </li>
                <li>
                    <b>{lang === 'vi' ? 'GSM sáng (tìm mạng)' : 'GSM on (searching)'}:</b>{' '}
                    {lang === 'vi'
                        ? 'kiểm tra SIM, vị trí lắp, chờ 1–3 phút.'
                        : 'check SIM, mounting location, wait 1–3 minutes.'}
                </li>
                <li>
                    <b>{lang === 'vi' ? 'GSM nhấp nháy nhưng offline' : 'GSM blinking but offline'}:</b>{' '}
                    {lang === 'vi'
                        ? 'kiểm tra mapping IMEI → thiết bị trên ev.iky.vn, chụp ảnh LED và báo support.'
                        : 'check IMEI mapping on ev.iky.vn, take LED photo and contact support.'}
                </li>
                <li>
                    <b>{lang === 'vi' ? 'GPS tắt / tìm vệ tinh lâu' : 'GPS off / slow fix'}:</b>{' '}
                    {lang === 'vi'
                        ? 'đưa xe ra khu vực mở, chờ 2–5 phút, kiểm tra vị trí lắp.'
                        : 'move to open area, wait 2–5 minutes, check mounting location.'}
                </li>
                <li>
                    <b>{lang === 'vi' ? 'Giá trị điện/SOC sai' : 'Wrong voltage/SOC'}:</b>{' '}
                    {lang === 'vi'
                        ? 'kiểm tra dây đo/shunt/CAN mapping, scaling, firmware.'
                        : 'check wiring/shunt/CAN mapping, scaling, firmware.'}
                </li>
            </ul>

            <Divider />

            <Title level={4}>{t.gTitle[lang]}</Title>
            <Paragraph>
                <i>
                    {lang === 'vi'
                        ? 'Lưu ý: các giá trị kiểm tra trong checklist là tham khảo; các giá trị thực tế có thể khác nhau tùy vào model xe, cấu hình pin, cảm biến và cách tích hợp. Kỹ thuật viên cần đánh giá tính hợp lý theo thông số kỹ thuật của xe cụ thể và ghi rõ nếu có sai lệch.'
                        : 'Note: checklist values are for reference; real values may vary by vehicle model, battery config, sensors, and integration. Technicians should judge reasonableness against the specific vehicle specs and record deviations.'}
                </i>
            </Paragraph>

            <Divider />

            <Title level={4}>{t.hTitle[lang]}</Title>
            <Paragraph>
                <b>{t.note[lang]}:</b> ___________________________________________________________
                <br />
                <b>{t.evidence[lang]}:</b> _____________________________________________
            </Paragraph>

            <Paragraph>
                <b>{t.internalOnly[lang]}</b>
            </Paragraph>
        </Card>
    );
}
