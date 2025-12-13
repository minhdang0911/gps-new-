// app/report/battery-summary/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Card,
    Form,
    Input,
    Button,
    Row,
    Col,
    Table,
    DatePicker,
    Space,
    Typography,
    Select,
    message,
    Tooltip,
    Grid,
} from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';

import { usePathname } from 'next/navigation';

import { getBatteryReport } from '../../lib/api/report';
import { getUserList } from '../../lib/api/user';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import * as XLSX from 'xlsx';

// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';
const { useBreakpoint } = Grid;

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

// ===== Helpers =====
const formatDateTime = (value, isEn = false) => {
    if (!value) return '--';
    const d = new Date(value);
    return d.toLocaleString(isEn ? 'en-US' : 'vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
};

const formatStatus = (value, type, isEn) => {
    if (!value) return '--';
    if (isEn) return value;

    const v = String(value).toLowerCase();

    switch (type) {
        case 'connection': {
            if (v === 'online') return 'Online';
            if (v === 'offline') return 'Offline';
            return value;
        }
        case 'utilization': {
            if (v === 'running') return 'Đang chạy';
            if (v === 'stop') return 'Dừng';
            return value;
        }
        case 'realtime': {
            if (v === 'idle') return 'Đang chờ';
            if (v === 'charging') return 'Đang sạc';
            if (v === 'discharging') return 'Đang xả';
            return value;
        }
        default:
            return value;
    }
};

const BatterySummaryReportPage = () => {
    const [form] = Form.useForm();
    const [distributorMap, setDistributorMap] = useState({});

    const [rawData, setRawData] = useState([]); // dữ liệu gốc từ API (đã attach biển số)
    const [data, setData] = useState([]); // dữ liệu sau filter FE
    const [loading, setLoading] = useState(false);

    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
    });

    const [tableScrollY, setTableScrollY] = useState(400);

    // ✅ device map
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath]);

    const customLocale = {
        emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ',
    };

    const rawLocale = isEn ? locales.en : locales.vi;
    const defaultT = {
        title: 'Báo cáo pin',
        subtitle: 'Tổng quan dữ liệu pin theo thiết bị',
        filter: {
            title: 'Bộ lọc',
            imei: 'IMEI',
            imeiPlaceholder: 'Nhập IMEI',
            licensePlate: 'Biển số',
            licensePlatePlaceholder: 'Nhập biển số',
            batteryId: 'Mã pin (Battery ID)',
            batteryIdPlaceholder: 'Nhập mã pin',
            connectionStatus: 'Trạng thái kết nối',
            connectionStatusPlaceholder: 'Chọn trạng thái',
            utilization: 'Trạng thái sử dụng',
            utilizationPlaceholder: 'Chọn trạng thái',
            timeRange: 'Khoảng ngày',
            search: 'Tìm kiếm',
            reset: 'Làm mới',
        },
        table: {
            title: 'Danh sách pin',
            index: 'STT',
            imei: 'IMEI',
            licensePlate: 'Biển số',
            batteryId: 'Battery ID',
            date: 'Ngày',
            chargingDurationToday: 'Thời gian sạc hôm nay',
            consumedKwToday: 'Điện năng tiêu thụ (kWh) hôm nay',
            consumedPercentToday: 'Phần trăm tiêu thụ hôm nay',
            mileageToday: 'Quãng đường hôm nay (km)',
            numberOfChargingToday: 'Số lần sạc hôm nay',
            socToday: 'SOC hôm nay (%)',
            sohToday: 'SOH hôm nay (%)',
            speedMaxToday: 'Tốc độ tối đa hôm nay',
            tempAvgToday: 'Nhiệt độ TB hôm nay',
            tempMaxToday: 'Nhiệt độ max hôm nay',
            tempMinToday: 'Nhiệt độ min hôm nay',
            usageDurationToday: 'Thời gian sử dụng hôm nay',
            voltageAvgToday: 'Điện áp TB hôm nay',
            voltageMaxToday: 'Điện áp max hôm nay',
            voltageMinToday: 'Điện áp min hôm nay',
            connectionStatus: 'Kết nối',
            utilization: 'Sử dụng',
            realtime_soc: 'SOC realtime',
            realtime_soh: 'SOH realtime',
            realtime_voltage: 'Điện áp realtime',
            realtime_temperature: 'Nhiệt độ realtime',
            realtime_status: 'Trạng thái realtime',
            realtime_lat: 'Lat realtime',
            realtime_lon: 'Lon realtime',
            createdAt: 'Tạo lúc',
            updatedAt: 'Cập nhật DB',
            last_update: 'Cập nhật thiết bị',
            distributor_id: 'Distributor',
            total: 'Tổng {total} bản ghi',
            showTotal: 'Tổng {total} bản ghi',
            // các key export bạn đang dùng (nếu locale thiếu thì vẫn OK khi export)
            currentBatteryPower: 'SOC realtime',
            currentMaxPower: 'Điện áp realtime',
            batteryUsageToday: 'Battery Usage Today',
            batteryConsumedToday: 'Phần trăm tiêu thụ hôm nay',
            wattageConsumedToday: 'Điện năng tiêu thụ (kWh) hôm nay',
            lastLocation: 'Last location',
        },
    };

    const t = rawLocale.batteryReport || defaultT;

    const getAuthToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    };

    const normalize = (s) =>
        String(s || '')
            .trim()
            .toLowerCase();

    // ===== Distributor helpers =====
    const getDistributorLabel = (id) => {
        if (!id) return '';
        return distributorMap[id] || id;
    };

    const fetchDistributors = async () => {
        try {
            const res = await getUserList({ position: 'distributor' });
            const items = res?.items || res?.data || [];

            const map = {};
            items.forEach((item) => {
                const label = (item.name && item.name.trim()) || item.email || item.username;
                map[item._id] = label;
            });

            setDistributorMap(map);
        } catch (err) {
            console.error('Lỗi lấy danh sách đại lý: ', err);
        }
    };

    // ✅ load imeiToPlate 1 lần
    useEffect(() => {
        const loadMap = async () => {
            try {
                setLoadingDeviceMap(true);
                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    return;
                }
                const { imeiToPlate } = await buildImeiToLicensePlateMap(token);
                setImeiToPlate(imeiToPlate);
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMap();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== FETCH battery summary =====
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getBatteryReport({});
            const list = res?.data || [];

            // ✅ attach biển số theo imei
            const enriched = attachLicensePlate(list, imeiToPlate);

            setRawData(enriched);
            setData(enriched);
            setPagination((prev) => ({
                ...prev,
                current: 1,
            }));
        } catch (err) {
            console.error('Lỗi lấy battery report: ', err);
        } finally {
            setLoading(false);
        }
    };

    // fetch lại khi imeiToPlate sẵn sàng để attach biển số đúng
    useEffect(() => {
        fetchData();
        fetchDistributors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate]);

    // ===== TÍNH CHIỀU CAO TABLE DỰA THEO VIEWPORT =====
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const calcTableHeight = () => {
            const reserved = 320;
            const h = window.innerHeight - reserved;
            setTableScrollY(h > 300 ? h : 300);
        };

        calcTableHeight();
        window.addEventListener('resize', calcTableHeight);

        return () => {
            window.removeEventListener('resize', calcTableHeight);
        };
    }, []);

    // ===== FILTER Ở FRONT-END =====
    const applyFilter = () => {
        const values = form.getFieldsValue();
        const { imei, license_plate, batteryId, connectionStatus, utilization, timeRange } = values;

        let filtered = [...rawData];

        // ✅ filter biển số FE
        if (license_plate) {
            const key = normalize(license_plate);
            filtered = filtered.filter((item) => normalize(item.license_plate).includes(key));
        }

        if (imei) {
            const key = normalize(imei);
            filtered = filtered.filter((item) => normalize(item.imei).includes(key));
        }

        if (batteryId) {
            const key = normalize(batteryId);
            filtered = filtered.filter((item) => normalize(item.batteryId).includes(key));
        }

        if (connectionStatus) {
            filtered = filtered.filter((item) => item.connectionStatus === connectionStatus);
        }

        if (utilization) {
            filtered = filtered.filter((item) => item.utilization === utilization);
        }

        if (timeRange && timeRange.length === 2) {
            const start = timeRange[0].startOf('day');
            const end = timeRange[1].endOf('day');

            filtered = filtered.filter((item) => {
                if (!item.date) return false;
                const d = new Date(item.date).getTime();
                return d >= start.valueOf() && d <= end.valueOf();
            });
        }

        setData(filtered);
        setPagination((prev) => ({
            ...prev,
            current: 1,
        }));
    };

    const onFinish = () => applyFilter();

    const onReset = () => {
        form.resetFields();
        setData(rawData);
        setPagination((prev) => ({
            ...prev,
            current: 1,
        }));
    };

    const handleTableChange = (pager) => {
        setPagination({
            current: pager.current,
            pageSize: pager.pageSize,
        });
    };

    // ===== EXPORT EXCEL =====
    const handleExportExcel = () => {
        if (!data || data.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = data.map((item) => {
            const lastLocation =
                item.realtime_lat && item.realtime_lon ? `${item.realtime_lat},${item.realtime_lon}` : '';

            return {
                // thêm biển số vào excel
                [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',

                [t.table.batteryId]: item.batteryId || '',
                [t.table.last_update]: formatDateTime(item.last_update, isEn),
                [t.table.connectionStatus]: formatStatus(item.connectionStatus, 'connection', isEn),
                [t.table.utilization]: formatStatus(item.utilization, 'utilization', isEn),
                [t.table.currentBatteryPower]: item.realtime_soc ?? '',
                [t.table.socToday]: item.socToday ?? '',
                [t.table.sohToday]: item.sohToday ?? '',
                [t.table.currentMaxPower]: item.realtime_voltage ?? '',
                [t.table.voltageMaxToday]: item.voltageMaxToday ?? '',
                [t.table.voltageMinToday]: item.voltageMinToday ?? '',
                [t.table.voltageAvgToday]: item.voltageAvgToday ?? '',
                [t.table.tempMaxToday]: item.tempMaxToday ?? '',
                [t.table.tempMinToday]: item.tempMinToday ?? '',
                [t.table.tempAvgToday]: item.tempAvgToday ?? '',
                [t.table.batteryUsageToday]: item.usageDurationToday ?? '',
                [t.table.usageDurationToday]: item.usageDurationToday ?? '',
                [t.table.batteryConsumedToday]: item.consumedPercentToday ?? '',
                [t.table.wattageConsumedToday]: item.consumedKwToday ?? '',
                [t.table.mileageToday]: item.mileageToday ?? '',
                [t.table.speedMaxToday]: item.speedMaxToday ?? '',
                [t.table.numberOfChargingToday]: item.numberOfChargingToday ?? '',
                [t.table.chargingDurationToday]: item.chargingDurationToday ?? '',
                [t.table.lastLocation]: lastLocation,
            };
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BatteryReport');

        const fileName = isEn ? 'battery_report.xlsx' : 'bao_cao_pin.xlsx';
        XLSX.writeFile(wb, fileName);
    };

    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const colHelp = {
        index: { vi: 'Số thứ tự của dòng trong bảng.', en: 'Order number of the row.' },

        imei: {
            vi: 'Mã thiết bị gắn trên xe. Hệ thống dùng mã này để nhận diện xe.',
            en: 'Device code installed on the vehicle (used to identify the vehicle).',
        },

        license_plate: {
            vi: 'Biển số xe tương ứng với thiết bị. Có thể trống nếu hệ thống chưa liên kết.',
            en: 'License plate linked to the device. May be empty if not linked yet.',
        },

        batteryId: {
            vi: 'Mã pin đang được theo dõi trong hệ thống.',
            en: 'Battery ID tracked in the system.',
        },

        date: {
            vi: 'Ngày ghi nhận số liệu tổng hợp (theo ngày).',
            en: 'Daily summary date (by day).',
        },

        chargingDurationToday: {
            vi: 'Tổng thời gian sạc trong ngày (cộng dồn các lần sạc).',
            en: 'Total charging time in the day (sum of all charging sessions).',
        },

        consumedKwToday: {
            vi: 'Tổng điện năng tiêu thụ trong ngày (kWh).',
            en: 'Total energy consumed in the day (kWh).',
        },

        consumedPercentToday: {
            vi: 'Tổng % pin đã tiêu hao trong ngày.',
            en: 'Total battery % consumed in the day.',
        },

        mileageToday: {
            vi: 'Quãng đường xe chạy trong ngày này (km). Đây là số km phát sinh trong ngày, không phải ODO. ODO là tổng quãng đường xe đã đi từ trước đến nay.',
            en: 'Distance traveled on this day (km). This is the distance added within the day, not the ODO. ODO is the vehicle’s total distance over time.',
        },

        numberOfChargingToday: {
            vi: 'Số lần sạc trong ngày.',
            en: 'Number of charging times in the day.',
        },

        socToday: {
            vi: 'Mức pin (%) ghi nhận theo ngày (tổng hợp trong ngày).',
            en: 'Daily battery level (%) summary.',
        },

        sohToday: {
            vi: 'Sức khỏe pin (%) theo ngày. Số càng cao thì pin càng “khỏe”.',
            en: 'Daily battery health (%). Higher means better battery condition.',
        },

        speedMaxToday: {
            vi: 'Tốc độ cao nhất ghi nhận trong ngày.',
            en: 'Highest speed recorded in the day.',
        },

        tempAvgToday: { vi: 'Nhiệt độ pin trung bình trong ngày.', en: 'Average battery temperature in the day.' },
        tempMaxToday: { vi: 'Nhiệt độ pin cao nhất trong ngày.', en: 'Maximum battery temperature in the day.' },
        tempMinToday: { vi: 'Nhiệt độ pin thấp nhất trong ngày.', en: 'Minimum battery temperature in the day.' },

        usageDurationToday: {
            vi: 'Tổng thời gian pin/xe được sử dụng trong ngày.',
            en: 'Total usage time in the day.',
        },

        voltageAvgToday: { vi: 'Điện áp trung bình trong ngày.', en: 'Average voltage in the day.' },
        voltageMaxToday: { vi: 'Điện áp cao nhất trong ngày.', en: 'Maximum voltage in the day.' },
        voltageMinToday: { vi: 'Điện áp thấp nhất trong ngày.', en: 'Minimum voltage in the day.' },

        connectionStatus: {
            vi: 'Trạng thái kết nối: Online (đang kết nối) / Offline (mất kết nối).',
            en: 'Connection status: Online / Offline.',
        },

        utilization: {
            vi: 'Trạng thái sử dụng: xe đang chạy hay đang dừng.',
            en: 'Utilization status: running or stopped.',
        },

        realtime_soc: {
            vi: 'Mức pin hiện tại (%) theo thời gian thực.',
            en: 'Current battery level (%) in real time.',
        },
        realtime_soh: {
            vi: 'Sức khỏe pin hiện tại (%) theo thời gian thực.',
            en: 'Current battery health (%) in real time.',
        },
        realtime_voltage: {
            vi: 'Điện áp pin hiện tại theo thời gian thực.',
            en: 'Current battery voltage in real time.',
        },
        realtime_temperature: {
            vi: 'Nhiệt độ pin hiện tại theo thời gian thực.',
            en: 'Current battery temperature in real time.',
        },

        realtime_status: {
            vi: 'Trạng thái hiện tại của pin: đang chờ / đang sạc / đang xả.',
            en: 'Current battery status: idle / charging / discharging.',
        },

        realtime_lat: { vi: 'Vĩ độ vị trí gần nhất (tọa độ bản đồ).', en: 'Latest latitude (map coordinate).' },
        realtime_lon: { vi: 'Kinh độ vị trí gần nhất (tọa độ bản đồ).', en: 'Latest longitude (map coordinate).' },

        distributor_id: {
            vi: 'Đại lý/đơn vị quản lý xe (theo tài khoản được gán).',
            en: 'Distributor / managing unit assigned to the vehicle.',
        },

        createdAt: {
            vi: 'Thời điểm bản ghi được tạo trên hệ thống.',
            en: 'Time when this record was created in the system.',
        },

        last_update: { vi: 'Thời điểm thiết bị gửi dữ liệu gần nhất.', en: 'Last time the device sent data.' },
    };

    const ColTitle = ({ label, tip }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{label}</span>

            <Tooltip
                title={tip}
                placement="top"
                trigger={isMobile ? ['click'] : ['hover']}
                classNames={{ root: 'table-col-tooltip' }}
                styles={{ root: { maxWidth: 260 }, container: { maxWidth: 260 } }}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
            >
                <span
                    className="table-col-help"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        cursor: 'help',
                        pointerEvents: 'auto',
                    }}
                >
                    <QuestionCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                </span>
            </Tooltip>
        </span>
    );

    // ===== COLUMNS =====
    const columns = [
        {
            title: <ColTitle label={t.table.index} tip={isEn ? colHelp.index.en : colHelp.index.vi} />,
            dataIndex: 'index',
            width: 65,
            fixed: 'left',
            render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },

        {
            title: <ColTitle label={t.table.imei} tip={isEn ? colHelp.imei.en : colHelp.imei.vi} />,
            dataIndex: 'imei',
            width: 150,
            ellipsis: true,
        },

        {
            title: (
                <ColTitle
                    label={t.table.licensePlate || (isEn ? 'License plate' : 'Biển số')}
                    tip={isEn ? colHelp.license_plate.en : colHelp.license_plate.vi}
                />
            ),
            dataIndex: 'license_plate',
            width: 140,
            ellipsis: true,
        },

        {
            title: <ColTitle label={t.table.batteryId} tip={isEn ? colHelp.batteryId.en : colHelp.batteryId.vi} />,
            dataIndex: 'batteryId',
            width: 140,
            ellipsis: true,
        },

        {
            title: <ColTitle label={t.table.date} tip={isEn ? colHelp.date.en : colHelp.date.vi} />,
            dataIndex: 'date',
            width: 160,
            render: (value) => formatDateTime(value, isEn),
        },

        {
            title: (
                <ColTitle
                    label={t.table.chargingDurationToday}
                    tip={isEn ? colHelp.chargingDurationToday.en : colHelp.chargingDurationToday.vi}
                />
            ),
            dataIndex: 'chargingDurationToday',
            width: 180,
        },
        {
            title: (
                <ColTitle
                    label={t.table.consumedKwToday}
                    tip={isEn ? colHelp.consumedKwToday.en : colHelp.consumedKwToday.vi}
                />
            ),
            dataIndex: 'consumedKwToday',
            width: 257,
        },
        {
            title: (
                <ColTitle
                    label={t.table.consumedPercentToday}
                    tip={isEn ? colHelp.consumedPercentToday.en : colHelp.consumedPercentToday.vi}
                />
            ),
            dataIndex: 'consumedPercentToday',
            width: 220,
        },
        {
            title: (
                <ColTitle label={t.table.mileageToday} tip={isEn ? colHelp.mileageToday.en : colHelp.mileageToday.vi} />
            ),
            dataIndex: 'mileageToday',
            width: 220,
        },
        {
            title: (
                <ColTitle
                    label={t.table.numberOfChargingToday}
                    tip={isEn ? colHelp.numberOfChargingToday.en : colHelp.numberOfChargingToday.vi}
                />
            ),
            dataIndex: 'numberOfChargingToday',
            width: 170,
        },
        {
            title: <ColTitle label={t.table.socToday} tip={isEn ? colHelp.socToday.en : colHelp.socToday.vi} />,
            dataIndex: 'socToday',
            width: 180,
        },
        {
            title: <ColTitle label={t.table.sohToday} tip={isEn ? colHelp.sohToday.en : colHelp.sohToday.vi} />,
            dataIndex: 'sohToday',
            width: 150,
        },
        {
            title: (
                <ColTitle
                    label={t.table.speedMaxToday}
                    tip={isEn ? colHelp.speedMaxToday.en : colHelp.speedMaxToday.vi}
                />
            ),
            dataIndex: 'speedMaxToday',
            width: 180,
        },

        {
            title: (
                <ColTitle label={t.table.tempAvgToday} tip={isEn ? colHelp.tempAvgToday.en : colHelp.tempAvgToday.vi} />
            ),
            dataIndex: 'tempAvgToday',
            width: 225,
        },
        {
            title: (
                <ColTitle label={t.table.tempMaxToday} tip={isEn ? colHelp.tempMaxToday.en : colHelp.tempMaxToday.vi} />
            ),
            dataIndex: 'tempMaxToday',
            width: 200,
        },
        {
            title: (
                <ColTitle label={t.table.tempMinToday} tip={isEn ? colHelp.tempMinToday.en : colHelp.tempMinToday.vi} />
            ),
            dataIndex: 'tempMinToday',
            width: 210,
        },

        {
            title: (
                <ColTitle
                    label={t.table.usageDurationToday}
                    tip={isEn ? colHelp.usageDurationToday.en : colHelp.usageDurationToday.vi}
                />
            ),
            dataIndex: 'usageDurationToday',
            width: 235,
        },

        {
            title: (
                <ColTitle
                    label={t.table.voltageAvgToday}
                    tip={isEn ? colHelp.voltageAvgToday.en : colHelp.voltageAvgToday.vi}
                />
            ),
            dataIndex: 'voltageAvgToday',
            width: 220,
        },
        {
            title: (
                <ColTitle
                    label={t.table.voltageMaxToday}
                    tip={isEn ? colHelp.voltageMaxToday.en : colHelp.voltageMaxToday.vi}
                />
            ),
            dataIndex: 'voltageMaxToday',
            width: 190,
        },
        {
            title: (
                <ColTitle
                    label={t.table.voltageMinToday}
                    tip={isEn ? colHelp.voltageMinToday.en : colHelp.voltageMinToday.vi}
                />
            ),
            dataIndex: 'voltageMinToday',
            width: 205,
        },

        {
            title: (
                <ColTitle
                    label={t.table.connectionStatus}
                    tip={isEn ? colHelp.connectionStatus.en : colHelp.connectionStatus.vi}
                />
            ),
            dataIndex: 'connectionStatus',
            width: 85,
            render: (value) => formatStatus(value, 'connection', isEn),
        },
        {
            title: (
                <ColTitle label={t.table.utilization} tip={isEn ? colHelp.utilization.en : colHelp.utilization.vi} />
            ),
            dataIndex: 'utilization',
            width: 120,
            render: (value) => formatStatus(value, 'utilization', isEn),
        },

        {
            title: (
                <ColTitle label={t.table.realtime_soc} tip={isEn ? colHelp.realtime_soc.en : colHelp.realtime_soc.vi} />
            ),
            dataIndex: 'realtime_soc',
            width: 80,
        },
        {
            title: (
                <ColTitle label={t.table.realtime_soh} tip={isEn ? colHelp.realtime_soh.en : colHelp.realtime_soh.vi} />
            ),
            dataIndex: 'realtime_soh',
            width: 80,
        },
        {
            title: (
                <ColTitle
                    label={t.table.realtime_voltage}
                    tip={isEn ? colHelp.realtime_voltage.en : colHelp.realtime_voltage.vi}
                />
            ),
            dataIndex: 'realtime_voltage',
            width: 100,
        },
        {
            title: (
                <ColTitle
                    label={t.table.realtime_temperature}
                    tip={isEn ? colHelp.realtime_temperature.en : colHelp.realtime_temperature.vi}
                />
            ),
            dataIndex: 'realtime_temperature',
            width: 100,
        },
        {
            title: (
                <ColTitle
                    label={t.table.realtime_status}
                    tip={isEn ? colHelp.realtime_status.en : colHelp.realtime_status.vi}
                />
            ),
            dataIndex: 'realtime_status',
            width: 110,
            render: (value) => formatStatus(value, 'realtime', isEn),
        },
        {
            title: (
                <ColTitle label={t.table.realtime_lat} tip={isEn ? colHelp.realtime_lat.en : colHelp.realtime_lat.vi} />
            ),
            dataIndex: 'realtime_lat',
            width: 110,
        },
        {
            title: (
                <ColTitle label={t.table.realtime_lon} tip={isEn ? colHelp.realtime_lon.en : colHelp.realtime_lon.vi} />
            ),
            dataIndex: 'realtime_lon',
            width: 110,
        },

        {
            title: (
                <ColTitle
                    label={t.table.distributor_id}
                    tip={isEn ? colHelp.distributor_id.en : colHelp.distributor_id.vi}
                />
            ),
            dataIndex: 'distributor_id',
            width: 130,
            render: (value) => getDistributorLabel(value),
        },

        {
            title: <ColTitle label={t.table.createdAt} tip={isEn ? colHelp.createdAt.en : colHelp.createdAt.vi} />,
            dataIndex: 'createdAt',
            width: 130,
            render: (value) => formatDateTime(value, isEn),
        },
        {
            title: (
                <ColTitle label={t.table.last_update} tip={isEn ? colHelp.last_update.en : colHelp.last_update.vi} />
            ),
            dataIndex: 'last_update',
            width: 165,
            render: (value) => formatDateTime(value, isEn),
        },
    ];

    const totalRecords = data.length;

    return (
        <div className="usage-report-page">
            <div className="usage-report-header">
                <Title level={4} style={{ margin: 0 }}>
                    {t.title}
                </Title>
                <Text type="secondary">{t.subtitle}</Text>
            </div>

            <Row gutter={[16, 16]} className="usage-report-row">
                {/* FILTER */}
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title={t?.filter?.title} size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            {/* ✅ biển số */}
                            <Form.Item
                                label={t?.filter?.licensePlate || (isEn ? 'License plate' : 'Biển số')}
                                name="license_plate"
                            >
                                <Input
                                    placeholder={
                                        t?.filter?.licensePlatePlaceholder ||
                                        (isEn ? 'Enter license plate' : 'Nhập biển số')
                                    }
                                    allowClear
                                />
                            </Form.Item>

                            <Form.Item label={t?.filter?.imei} name="imei">
                                <Input placeholder={t?.filter?.imeiPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.batteryId} name="batteryId">
                                <Input placeholder={t.filter.batteryIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.connectionStatus} name="connectionStatus">
                                <Select allowClear placeholder={t.filter.connectionStatusPlaceholder}>
                                    <Option value="online">Online</Option>
                                    <Option value="offline">Offline</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.utilization} name="utilization">
                                <Select allowClear placeholder={t.filter.utilizationPlaceholder}>
                                    <Option value="RUNNING">RUNNING</Option>
                                    <Option value="STOP">STOP</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.timeRange} name="timeRange">
                                <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                            </Form.Item>

                            <Form.Item>
                                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<SearchOutlined />}
                                        loading={loading}
                                    >
                                        {t.filter.search}
                                    </Button>
                                    <Button icon={<ReloadOutlined />} onClick={onReset} disabled={loading}>
                                        {t.filter.reset}
                                    </Button>
                                </Space>
                            </Form.Item>

                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {loadingDeviceMap
                                    ? isEn
                                        ? 'Loading devices…'
                                        : 'Đang tải danh sách xe…'
                                    : isEn
                                    ? 'Devices loaded'
                                    : 'Đã tải danh sách xe'}
                            </Text>
                        </Form>
                    </Card>
                </Col>

                {/* TABLE */}
                <Col xs={24} lg={17}>
                    <Card
                        className="usage-table-card"
                        size="small"
                        title={t.table.title}
                        extra={
                            <Space size="middle">
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(totalRecords))}
                                </Text>
                                <Button size="small" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            locale={customLocale}
                            rowKey={(record) => record._id || `${record.imei}-${record.date}`}
                            columns={columns}
                            dataSource={data}
                            loading={loading}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: totalRecords,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 2750, y: tableScrollY }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default BatterySummaryReportPage;
