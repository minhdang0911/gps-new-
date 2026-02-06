'use client';

import React, { useMemo, useState, useRef } from 'react';
import { Card, Typography, Divider, Button, Modal, Descriptions, Tag, Alert, Space, Spin, AutoComplete } from 'antd';
import { usePathname } from 'next/navigation';
import styles from '../SupportPage.module.css';
import logo from '../../assets/logo-iky.webp';

// =====================
// API imports (SỬA PATH cho đúng project của bạn)
// =====================
import { getDevices, getDeviceInfo } from '../../lib/api/devices';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';
import { getLastCruise } from '../../lib/api/cruise';

const { Title, Paragraph, Text } = Typography;

// =====================
// Helpers
// =====================
const isValidImei = (v) => /^\d{10,20}$/.test(String(v || '').trim());
const safe = (v, fallback = '--') => (v === null || v === undefined || v === '' ? fallback : v);

const minutesDiff = (iso) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.round((Date.now() - t) / 60000);
};

// Format time: DD/MM/YYYY HH:mm:ss
const pad2 = (n) => String(n).padStart(2, '0');
const formatDateTime = (iso, lang) => {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return safe(iso);
    const dd = pad2(d.getDate());
    const mm = pad2(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad2(d.getHours());
    const mi = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    // vi/en đều ok theo format này
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
};

const passFailTag = (ok, lang) => {
    if (ok === null) return <Tag>--</Tag>;
    const passText = lang === 'vi' ? 'ĐẠT' : 'PASS';
    const failText = lang === 'vi' ? 'KHÔNG ĐẠT' : 'FAIL';
    return <Tag color={ok ? 'green' : 'red'}>{ok ? passText : failText}</Tag>;
};

// highlight keyword trong label
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
    title: { vi: 'Quy trình nghiệm thu lắp đặt iKY-GPS', en: 'iKY-GPS Installation Acceptance Process' },

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
        vi: 'IMEI không hợp lệ. Vui lòng chọn từ danh sách hoặc nhập số (10–20 ký tự).',
        en: 'Invalid IMEI.',
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

    // ===== Original content (giữ nguyên phần checklist như bạn đang có) =====
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
    sim: { vi: 'SIM (nếu có) / ISIM', en: 'SIM (if any) / ISIM' },
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
};

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

    // =====================
    // DIAGNOSTIC STATES
    // =====================
    const [searchText, setSearchText] = useState('');
    const [selectedImei, setSelectedImei] = useState('');

    const [diagOpen, setDiagOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [diagErr, setDiagErr] = useState('');
    const [diagData, setDiagData] = useState(null);

    // all devices cache
    const [allDevices, setAllDevices] = useState([]);
    const loadedAllRef = useRef(false);

    // ✅ token key đúng
    const getToken = () => {
        try {
            return (
                localStorage.getItem('accessToken') ||
                localStorage.getItem('token') ||
                localStorage.getItem('access_token') ||
                localStorage.getItem('jwt') ||
                ''
            );
        } catch (e) {
            return '';
        }
    };

    // ✅ yêu cầu của bạn: getAllDevices = gọi getDevices() KHÔNG truyền params
    const ensureAllDevicesLoaded = async () => {
        if (loadedAllRef.current) return;
        loadedAllRef.current = true;
        setLoadingDevices(true);
        try {
            const res = await getDevices(); // <-- không truyền params
            const list = res?.devices || res?.data || res || [];
            setAllDevices(Array.isArray(list) ? list : []);
        } catch (e) {
            // nếu fail thì cho phép load lại lần sau
            loadedAllRef.current = false;
            console.error(e);
        } finally {
            setLoadingDevices(false);
        }
    };

    const normalizeBattery = (raw) => raw?.batteryStatus || raw;
    const normalizeCruise = (raw) => raw?.cruise || raw;

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

            // 1) Nếu đã có allDevices thì lấy device nhanh từ cache
            let fromCache = allDevices.find((d) => String(d?.imei || '') === imei) || null;

            // 2) Nếu cache không có, fallback gọi getDevices theo imei
            if (!fromCache) {
                const devicesRes = await getDevices({ imei, page: 1, limit: 10 });
                const list = devicesRes?.devices || devicesRes?.data || devicesRes || [];
                fromCache = Array.isArray(list) ? list[0] : null;
            }

            // 3) device detail (nếu cần)
            let deviceDetail = fromCache || null;
            if (fromCache?._id && token) {
                try {
                    deviceDetail = await getDeviceInfo(token, fromCache._id);
                } catch {
                    deviceDetail = fromCache;
                }
            }

            // 4) battery + lastCruise
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
            setLoading(true);
            setLoading(false);
        }
    };

    // =====================
    // OPTIONS FOR DROPDOWN (client-side filter + highlight)
    // =====================
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

    // =====================
    // CHECKS
    // =====================
    const checks = useMemo(() => {
        if (!diagData) return null;
        const { device, battery, lastCruise } = diagData;

        const lastCruiseAgeMin = minutesDiff(lastCruise?.updatedAt || lastCruise?.createdAt);
        const batteryAgeMin = minutesDiff(battery?.updatedAt || battery?.time);

        const deviceFound = !!device?._id;

        // tiêu chí
        const onlineOk = lastCruiseAgeMin !== null ? lastCruiseAgeMin <= 5 : null;
        const gpsOk = lastCruise?.lat && lastCruise?.lon ? true : lastCruise ? false : null;

        const voltOk = typeof battery?.voltage === 'number' ? battery.voltage > 0 : null;
        const socOk = typeof battery?.soc === 'number' ? battery.soc >= 0 && battery.soc <= 100 : null;

        return {
            deviceFound,
            onlineOk,
            gpsOk,
            voltOk,
            socOk,
            lastCruiseAgeMin,
            batteryAgeMin,
        };
    }, [diagData]);

    // =====================
    // UI
    // =====================
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

            {/* ===== SEARCH WITH DROPDOWN + HIGHLIGHT ===== */}
            <Card size="small" style={{ background: 'rgba(0,0,0,0.02)' }}>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    <Text strong>{tr('diagBlockTitle')}</Text>

                    <Space.Compact style={{ width: '100%' }}>
                        <AutoComplete
                            style={{ width: '100%' }}
                            options={options}
                            value={searchText}
                            onFocus={ensureAllDevicesLoaded}
                            onSearch={async (v) => {
                                setSearchText(v);
                                // nếu user bắt đầu gõ mà chưa load all
                                if (!loadedAllRef.current) await ensureAllDevicesLoaded();
                            }}
                            onSelect={(value) => {
                                // chọn -> set imei -> auto chẩn đoán
                                setSearchText(value);
                                setSelectedImei(value);
                                runDiagnostic(value);
                            }}
                            placeholder={tr('imeiPlaceholder')}
                            notFoundContent={loadingDevices ? <Spin size="small" /> : null}
                            allowClear
                        />

                        {/* vẫn giữ nút phòng khi user dán imei và muốn bấm */}
                        <Button
                            type="primary"
                            onClick={() => runDiagnostic(selectedImei || searchText)}
                            loading={loading}
                        >
                            {tr('diagnoseBtn')}
                        </Button>
                    </Space.Compact>

                    <Text type="secondary">{tr('diagHint')}</Text>
                </Space>
            </Card>

            {/* ===== MODAL ===== */}
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
                    <>
                        {/* ===== Thông tin cơ bản ===== */}
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
                                    {checks?.lastCruiseAgeMin !== null ? `(${checks.lastCruiseAgeMin}m)` : ''}
                                </Text>
                            </Descriptions.Item>

                            <Descriptions.Item label={tr('gpsHasCoord')}>
                                {passFailTag(checks?.gpsOk, lang)}
                            </Descriptions.Item>

                            <Descriptions.Item label={tr('batteryUpdated')}>
                                {diagData.battery
                                    ? `${formatDateTime(diagData.battery?.updatedAt || diagData.battery?.time, lang)}${
                                          checks?.batteryAgeMin !== null ? ` (${checks.batteryAgeMin}m)` : ''
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
                                {diagData.lastCruise
                                    ? `${safe(diagData.lastCruise?.lat)} / ${safe(diagData.lastCruise?.lon)}`
                                    : '--'}
                            </Descriptions.Item>

                            <Descriptions.Item label={tr('firmware')}>
                                {diagData.lastCruise ? safe(diagData.lastCruise?.fwr) : '--'}
                            </Descriptions.Item>
                        </Descriptions>

                        <Space>
                            <Button onClick={() => runDiagnostic(diagData.imei)}>{tr('refreshBtn')}</Button>
                            <Button type="primary" onClick={() => setDiagOpen(false)}>
                                {tr('closeBtn')}
                            </Button>
                        </Space>
                    </>
                )}
            </Modal>

            {/* ===== Bên dưới: checklist của bạn (mình giữ nguyên minimal) ===== */}
            <Divider />

            <Title level={4}>{t.safetyTitle[lang]}</Title>
            <ul className={styles.supportList}>
                <li>{t.safety1[lang]}</li>
                <li>{t.safety2[lang]}</li>
            </ul>

            <Divider />

            <Title level={4}>{t.deviceInfoTitle[lang]}</Title>
            <ul className={styles.supportList}>
                <li>{t.imei[lang]}: ____________________</li>
                <li>{t.sim[lang]}: ____________________</li>
                <li>{t.tech[lang]}: ____________________</li>
                <li>{t.customer[lang]}: ____________________</li>
                <li>{t.installTime[lang]}: ____________________</li>
                <li>{t.installPos[lang]}: ____________________</li>
            </ul>

            <Divider />

            <Title level={4}>{t.aTitle[lang]}</Title>
            <ul className={styles.checkList}>
                <li>☐ {t.a1[lang]}</li>
                <li>☐ {t.a2[lang]}</li>
                <li>☐ {t.a3[lang]}</li>
                <li>☐ {t.a4[lang]}</li>
                <li>☐ {t.a5[lang]}</li>
                <li>☐ {t.a6[lang]}</li>
            </ul>

            <Divider />

            <Title level={4}>{t.bTitle[lang]}</Title>
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

            <Title level={5}>{t.importantVehicleTitle?.[lang] || ''}</Title>
            <Paragraph>{t.importantVehicleP?.[lang] || ''}</Paragraph>

            <Divider />

            <Title level={4}>{t.dTitle[lang]}</Title>
            {/* phần còn lại bạn giữ như bản cũ của bạn */}
        </Card>
    );
}
