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

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

// ===== Helpers =====
const formatDateTime = (value) => {
    if (!value) return '--';
    const d = new Date(value);
    return d.toLocaleString('vi-VN', {
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

    // EN: giữ nguyên
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
    const [rawData, setRawData] = useState([]); // dữ liệu gốc từ API
    const [data, setData] = useState([]); // dữ liệu sau filter FE
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
    });
    // chiều cao scroll cho table, chỉ dùng trong file này
    const [tableScrollY, setTableScrollY] = useState(400);

    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    // detect /en ở cuối URL
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

    // locale
    const rawLocale = isEn ? locales.en : locales.vi;
    const defaultT = {
        title: 'Báo cáo pin',
        subtitle: 'Tổng quan dữ liệu pin theo thiết bị',
        filter: {
            title: 'Bộ lọc',
            imei: 'IMEI',
            imeiPlaceholder: 'Nhập IMEI',
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
            __v: '__v',
            total: 'Tổng {total} bản ghi',
            showTotal: 'Tổng {total} bản ghi',
        },
    };

    const t = rawLocale.batteryReport || defaultT;

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

    // ===== FETCH battery summary (1 lần) =====
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getBatteryReport({});
            const list = res?.data || [];

            setRawData(list);
            setData(list);
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

    useEffect(() => {
        fetchData();
        fetchDistributors();
    }, []);

    // ===== TÍNH CHIỀU CAO TABLE DỰA THEO VIEWPORT (chỉ trong file này) =====
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const calcTableHeight = () => {
            // ước lượng phần header + filter + padding
            const reserved = 320; // px, chỉnh tuỳ UI nếu cần
            const h = window.innerHeight - reserved;
            setTableScrollY(h > 300 ? h : 300); // không thấp hơn 300px
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
        const { imei, batteryId, connectionStatus, utilization, timeRange } = values;

        let filtered = [...rawData];

        if (imei) {
            const key = imei.trim().toLowerCase();
            filtered = filtered.filter((item) => (item.imei || '').toLowerCase().includes(key));
        }

        if (batteryId) {
            const key = batteryId.trim().toLowerCase();
            filtered = filtered.filter((item) => (item.batteryId || '').toLowerCase().includes(key));
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

    const onFinish = () => {
        applyFilter();
    };

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
                // 1. Battery ID
                [t.table.batteryId]: item.batteryId || '',

                // 2. Last Updated time
                [t.table.last_update]: formatDateTime(item.last_update),

                // 3. Connection Status
                [t.table.connectionStatus]: formatStatus(item.connectionStatus, 'connection', isEn),

                // 4. Utilization Status
                [t.table.utilization]: formatStatus(item.utilization, 'utilization', isEn),

                // 5. Current battery power (SOC realtime)
                [t.table.currentBatteryPower]: item.realtime_soc ?? '',

                // 6. SoC Today
                [t.table.socToday]: item.socToday ?? '',

                // 7. SoH Today
                [t.table.sohToday]: item.sohToday ?? '',

                // 8. Current maximum power → realtime_voltage (BE không trả currentMaxPower)
                [t.table.currentMaxPower]: item.realtime_voltage ?? '',

                // 9. Voltage Maximum Today
                [t.table.voltageMaxToday]: item.voltageMaxToday ?? '',

                // 10. Voltage Minimum Today
                [t.table.voltageMinToday]: item.voltageMinToday ?? '',

                // 11. Voltage Average Today
                [t.table.voltageAvgToday]: item.voltageAvgToday ?? '',

                // 12. Temperature Maximum Today
                [t.table.tempMaxToday]: item.tempMaxToday ?? '',

                // 13. Temperature Minimum Today
                [t.table.tempMinToday]: item.tempMinToday ?? '',

                // 14. Temperature Average Today
                [t.table.tempAvgToday]: item.tempAvgToday ?? '',

                // 15. Battery Usage Today → Không có BE, để trống
                [t.table.batteryUsageToday]: item.usageDurationToday ?? '',

                // 16. Battery Usage Duration Today
                [t.table.usageDurationToday]: item.usageDurationToday ?? '',

                // 17. Battery Consumed Today → consumedPercentToday
                [t.table.batteryConsumedToday]: item.consumedPercentToday ?? '',

                // 18. Wattage Consumed Today → consumedKwToday
                [t.table.wattageConsumedToday]: item.consumedKwToday ?? '',

                // 19. Mileage Today
                [t.table.mileageToday]: item.mileageToday ?? '',

                // 20. Speed Maximum Today
                [t.table.speedMaxToday]: item.speedMaxToday ?? '',

                // 21. Number of Charging Today
                [t.table.numberOfChargingToday]: item.numberOfChargingToday ?? '',

                // 22. Charging Duration Today
                [t.table.chargingDurationToday]: item.chargingDurationToday ?? '',

                // 23. Last Location
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
        { title: t.table.batteryId, dataIndex: 'batteryId', width: 140, ellipsis: true },
        {
            title: t.table.date,
            dataIndex: 'date',
            width: 160,
            render: (value) => formatDateTime(value),
        },

        {
            title: t.table.chargingDurationToday,
            dataIndex: 'chargingDurationToday',
            width: 150,
        },
        {
            title: t.table.consumedKwToday,
            dataIndex: 'consumedKwToday',
            width: 150,
        },
        {
            title: t.table.consumedPercentToday,
            dataIndex: 'consumedPercentToday',
            width: 170,
        },
        {
            title: t.table.mileageToday,
            dataIndex: 'mileageToday',
            width: 150,
        },
        {
            title: t.table.numberOfChargingToday,
            dataIndex: 'numberOfChargingToday',
            width: 160,
        },
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
        {
            title: t.table.realtime_temperature,
            dataIndex: 'realtime_temperature',
            width: 160,
        },
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

        { title: t.table.createdAt, dataIndex: 'createdAt', width: 180, render: (value) => formatDateTime(value) },
        // { title: t.table.updatedAt, dataIndex: 'updatedAt', width: 180, render: (value) => formatDateTime(value) },
        { title: t.table.last_update, dataIndex: 'last_update', width: 180, render: (value) => formatDateTime(value) },
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
                                <Space
                                    style={{
                                        width: '100%',
                                        justifyContent: 'space-between',
                                    }}
                                >
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
                            scroll={{ x: 2600, y: tableScrollY }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default BatterySummaryReportPage;
