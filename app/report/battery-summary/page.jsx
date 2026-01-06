'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildBatteryInsight } from '../../features/batteryReport/compare/batteryCompareInsight';

// reusable
import ReportSortSelect from '../../components/report/ReportSortSelect';
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';

// ✅ NEW: generic report components
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';

// ✅ NEW: report config adapter
import { buildBatteryReportConfig } from '../../features/batteryReport/reportConfig';

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

    // ✅ view mode
    const [viewMode, setViewMode] = useState('table');

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
            showTotal: 'Tổng {total} bản ghi',
        },
    };

    const t = rawLocale.batteryReport || defaultT;

    const customLocale = { emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ' };

    const [colModalOpen, setColModalOpen] = useState(false);

    // ✅ compare states
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
    }, []);

    const { imeiToPlate, plateToImeis, loadingDeviceMap } = useBatteryReportDeviceMap({ buildImeiToLicensePlateMap });

    // data
    const {
        loading,
        pagination,
        setPagination,
        tableScrollY,

        sortMode,
        setSortMode,
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
        plateToImeis,
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
    }, [t, isEn, isMobile, distributorMap, getDistributorLabel]);

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

    // ✅ label map cho compare
    const colLabelMap = useMemo(() => {
        const m = new Map();
        (allColsForModal || []).forEach((c) => m.set(c.key, c.label));
        return m;
    }, [allColsForModal]);

    const rowSelection = useMemo(
        () => ({
            selectedRowKeys,
            onChange: (keys, rows) => {
                if (keys.length > 3) {
                    setSelectedRowKeys(keys.slice(0, 3));
                    setSelectedRows(rows.slice(0, 3));
                    return;
                }
                setSelectedRowKeys(keys);
                setSelectedRows(rows);
            },
        }),
        [selectedRowKeys],
    );

    // ✅ report config from processedData
    const reportConfig = useMemo(() => {
        return buildBatteryReportConfig({
            rows: processedData || [],
            isEn,
            t,
        });
    }, [processedData, isEn, t]);

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
                            onFinish={async () => {
                                // ✅ option: ép refresh device map khi search (nếu bạn muốn chắc chắn hết dính cache)
                                // await refreshDeviceMap();

                                onSearch();
                                clearSelection();
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
                                        loading={loading || loadingDeviceMap}
                                    >
                                        {t.filter.search}
                                    </Button>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={async () => {
                                            // ✅ reset data + clear selection
                                            onReset();
                                            clearSelection();

                                            // ✅ option: clear cache map + refresh lại map cho chắc
                                            // clearDeviceMapCache();
                                            // await refreshDeviceMap();
                                        }}
                                        disabled={loading || loadingDeviceMap}
                                    >
                                        {t.filter.reset}
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Form>
                    </Card>
                </Col>

                {/* TABLE / REPORT */}
                <Col xs={24} lg={17}>
                    <Card
                        className="usage-table-card"
                        size="small"
                        title={t.table.title}
                        extra={
                            <Space size="middle" wrap>
                                {/* ✅ Toggle mode */}
                                <ReportViewToggle value={viewMode} onChange={setViewMode} locale={isEn ? 'en' : 'vi'} />

                                <ReportSortSelect
                                    locale={isEn ? 'en' : 'vi'}
                                    value={sortMode}
                                    onChange={(v) => {
                                        setSortMode(v);
                                        clearSelection();
                                        onSearch();
                                    }}
                                    disabled={viewMode !== 'table'}
                                />

                                {/* ✅ Compare */}
                                <Button
                                    size="small"
                                    disabled={viewMode !== 'table' || selectedRows.length < 2}
                                    onClick={() => setCompareOpen(true)}
                                >
                                    {isEn ? `Compare (${selectedRows.length})` : `So sánh (${selectedRows.length})`}
                                </Button>

                                {selectedRows.length > 0 && viewMode === 'table' && (
                                    <Button size="small" onClick={clearSelection}>
                                        {isEn ? 'Clear selection' : 'Bỏ chọn'}
                                    </Button>
                                )}

                                <Button
                                    size="small"
                                    icon={<SettingOutlined />}
                                    onClick={() => setColModalOpen(true)}
                                    disabled={viewMode !== 'table'}
                                >
                                    {isEn ? 'Columns' : 'Cột'}
                                </Button>

                                <Button size="small" icon={<DownloadOutlined />} onClick={exportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        {viewMode === 'table' ? (
                            <Table
                                locale={customLocale}
                                rowKey={(record) =>
                                    record._id || `${record.imei}-${record.date}-${record.batteryId || ''}`
                                }
                                columns={columns}
                                dataSource={tableData}
                                loading={loading || loadingDeviceMap}
                                rowSelection={rowSelection}
                                pagination={{
                                    current: pagination.current,
                                    pageSize: pagination.pageSize,
                                    total: totalRecords,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    showQuickJumper: true,
                                    showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                                }}
                                onChange={(...args) => {
                                    handleTableChange(...args);
                                    clearSelection();
                                }}
                                scroll={{ x: 2750, y: tableScrollY }}
                            />
                        ) : (
                            <ReportPanel
                                title={isEn ? 'Report' : 'Báo cáo'}
                                kpis={reportConfig?.kpis || []}
                                charts={reportConfig?.charts || []}
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            {/* ✅ Compare modal */}
            <ReportCompareModal
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                rows={selectedRows}
                uiColumns={columns}
                colLabelMap={colLabelMap}
                ctx={{ isEn, t }}
                buildInsight={buildBatteryInsight}
            />

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
