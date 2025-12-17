'use client';

import React, { useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// reusable
import ReportSortSelect from '../../components/report/ReportSortSelect';
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';

// extracted
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/batteryReport/constants';
import { useLangFromPath } from '../../features/batteryReport/locale/useLangFromPath';
import { buildAllColsMeta } from '../../features/batteryReport/columns/buildAllColsMeta';
import { useBatteryReportDeviceMap } from '../../features/batteryReport/hooks/useBatteryReportDeviceMap';
import { useBatteryReportData } from '../../features/batteryReport/hooks/useBatteryReportData';
import { useBatteryReportExcel } from '../../features/batteryReport/hooks/useBatteryReportExcel';

import { getBatteryReport } from '../../lib/api/report';
import { getUserList } from '../../lib/api/user';
import { buildImeiToLicensePlateMap } from '../../util/deviceMap';
import { formatDateTime } from '../../util/FormatDate';
import { formatStatus } from '../../util/FormatStatus';

const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

const BatterySummaryReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const { isEn } = useLangFromPath(pathname);

    const screens = useBreakpoint();
    const isMobile = !screens.lg;

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
            last_update: 'Cập nhật thiết bị',
            distributor_id: 'Distributor',
            total: 'Tổng {total} bản ghi',
            showTotal: 'Tổng {total} bản ghi',
            currentBatteryPower: 'SOC realtime',
            currentMaxPower: 'Điện áp realtime',
            batteryUsageToday: 'Battery Usage Today',
            batteryConsumedToday: 'Phần trăm tiêu thụ hôm nay',
            wattageConsumedToday: 'Điện năng tiêu thụ (kWh) hôm nay',
            lastLocation: 'Last location',
        },
    };

    const t = rawLocale.batteryReport || defaultT;

    const customLocale = { emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ' };

    const [colModalOpen, setColModalOpen] = useState(false);

    // device map
    const { imeiToPlate, loadingDeviceMap } = useBatteryReportDeviceMap({ buildImeiToLicensePlateMap });

    // data
    const {
        loading,
        pagination,
        setPagination,
        tableScrollY,

        sortMode,
        setSortMode,
        filterValues,
        setFilterValues,

        distributorMap,
        getDistributorLabel,

        totalRecords,
        tableData,
        processedData,

        onSearch,
        onReset,
        handleTableChange,
    } = useBatteryReportData({
        form,
        getBatteryReport,
        getUserList,
        imeiToPlate,
        isEn,
        t,
    });

    // excel
    const { exportExcel } = useBatteryReportExcel({
        processedData,
        isEn,
        t,
        formatDateTime,
        formatStatus,
    });

    // columns
    const allColsMeta = useMemo(() => {
        return buildAllColsMeta({
            t,
            isEn,
            isMobile,
            distributorMap,
            getDistributorLabel,
            formatDateTime,
            formatStatus,
        });
    }, [t, isEn, isMobile, distributorMap, getDistributorLabel, formatDateTime, formatStatus]);

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

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
                    <Card className="usage-filter-card" title={t.filter.title} size="small">
                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={() => {
                                const values = form.getFieldsValue();
                                setFilterValues(values);
                                onSearch();
                            }}
                        >
                            <Form.Item
                                label={t.filter.licensePlate || (isEn ? 'License plate' : 'Biển số')}
                                name="license_plate"
                            >
                                <Input placeholder={t.filter.licensePlatePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.imei} name="imei">
                                <Input placeholder={t.filter.imeiPlaceholder} allowClear />
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
                            <Space size="middle" wrap>
                                {/* <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(totalRecords))}
                                </Text> */}

                                <ReportSortSelect
                                    locale={isEn ? 'en' : 'vi'}
                                    value={sortMode}
                                    onChange={(v) => setSortMode(v)}
                                />

                                <Button size="small" icon={<SettingOutlined />} onClick={() => setColModalOpen(true)}>
                                    {isEn ? 'Columns' : 'Cột'}
                                </Button>

                                <Button size="small" icon={<DownloadOutlined />} onClick={exportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            locale={customLocale}
                            rowKey={(record) => record._id || `${record.imei}-${record.date}-${record.batteryId || ''}`}
                            columns={columns}
                            dataSource={tableData}
                            loading={loading}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: totalRecords,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showQuickJumper: true,
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 2750, y: tableScrollY }}
                        />
                    </Card>
                </Col>
            </Row>

            <ColumnManagerModal
                open={colModalOpen}
                onClose={() => setColModalOpen(false)}
                allCols={allColsForModal}
                visibleOrder={visibleOrder}
                setVisibleOrder={setVisibleOrder}
                storageKey={STORAGE_KEY}
                lockedKeys={LOCKED_KEYS}
                texts={{
                    title: isEn ? 'Manage columns' : 'Quản lý cột',
                    searchPlaceholder: isEn ? 'Search column' : 'Tìm tên cột',
                    visibleTitle: isEn ? 'Visible columns' : 'Cột hiển thị',
                    hint: isEn
                        ? 'Drag to reorder. Uncheck or press X to hide.'
                        : 'Kéo thả để đổi vị trí. Bỏ tick hoặc bấm X để ẩn cột.',
                    apply: isEn ? 'Apply' : 'Áp dụng',
                    cancel: isEn ? 'Cancel' : 'Huỷ',
                    reset: isEn ? 'Reset' : 'Đặt lại',
                }}
            />
        </div>
    );
};

export default BatterySummaryReportPage;
