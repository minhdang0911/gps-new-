// app/report/battery-summary/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, message } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getBatteryReport } from '../../lib/api/report';
import { getUserList } from '../../lib/api/user';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import * as XLSX from 'xlsx';

// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

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

    // ===== COLUMNS =====
    const columns = [
        {
            title: t.table.index,
            dataIndex: 'index',
            width: 60,
            fixed: 'left',
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        { title: t.table.imei, dataIndex: 'imei', width: 150, ellipsis: true },

        // ✅ cột biển số
        {
            title: t.table.licensePlate || (isEn ? 'License plate' : 'Biển số'),
            dataIndex: 'license_plate',
            width: 140,
            ellipsis: true,
        },

        { title: t.table.batteryId, dataIndex: 'batteryId', width: 140, ellipsis: true },
        {
            title: t.table.date,
            dataIndex: 'date',
            width: 160,
            render: (value) => formatDateTime(value, isEn),
        },

        { title: t.table.chargingDurationToday, dataIndex: 'chargingDurationToday', width: 150 },
        { title: t.table.consumedKwToday, dataIndex: 'consumedKwToday', width: 150 },
        { title: t.table.consumedPercentToday, dataIndex: 'consumedPercentToday', width: 170 },
        { title: t.table.mileageToday, dataIndex: 'mileageToday', width: 150 },
        { title: t.table.numberOfChargingToday, dataIndex: 'numberOfChargingToday', width: 160 },
        { title: t.table.socToday, dataIndex: 'socToday', width: 130 },
        { title: t.table.sohToday, dataIndex: 'sohToday', width: 130 },
        { title: t.table.speedMaxToday, dataIndex: 'speedMaxToday', width: 150 },

        { title: t.table.tempAvgToday, dataIndex: 'tempAvgToday', width: 150 },
        { title: t.table.tempMaxToday, dataIndex: 'tempMaxToday', width: 150 },
        { title: t.table.tempMinToday, dataIndex: 'tempMinToday', width: 150 },
        { title: t.table.usageDurationToday, dataIndex: 'usageDurationToday', width: 170 },
        { title: t.table.voltageAvgToday, dataIndex: 'voltageAvgToday', width: 160 },
        { title: t.table.voltageMaxToday, dataIndex: 'voltageMaxToday', width: 160 },
        { title: t.table.voltageMinToday, dataIndex: 'voltageMinToday', width: 160 },

        {
            title: t.table.connectionStatus,
            dataIndex: 'connectionStatus',
            width: 120,
            render: (value) => formatStatus(value, 'connection', isEn),
        },
        {
            title: t.table.utilization,
            dataIndex: 'utilization',
            width: 120,
            render: (value) => formatStatus(value, 'utilization', isEn),
        },

        { title: t.table.realtime_soc, dataIndex: 'realtime_soc', width: 140 },
        { title: t.table.realtime_soh, dataIndex: 'realtime_soh', width: 140 },
        { title: t.table.realtime_voltage, dataIndex: 'realtime_voltage', width: 150 },
        { title: t.table.realtime_temperature, dataIndex: 'realtime_temperature', width: 160 },
        {
            title: t.table.realtime_status,
            dataIndex: 'realtime_status',
            width: 140,
            render: (value) => formatStatus(value, 'realtime', isEn),
        },
        { title: t.table.realtime_lat, dataIndex: 'realtime_lat', width: 150 },
        { title: t.table.realtime_lon, dataIndex: 'realtime_lon', width: 150 },

        {
            title: t.table.distributor_id,
            dataIndex: 'distributor_id',
            width: 200,
            render: (value) => getDistributorLabel(value),
        },

        {
            title: t.table.createdAt,
            dataIndex: 'createdAt',
            width: 180,
            render: (value) => formatDateTime(value, isEn),
        },
        {
            title: t.table.last_update,
            dataIndex: 'last_update',
            width: 180,
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
