'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';
import ReportSortSelect from '../../components/report/ReportSortSelect';

// ✅ compare
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildLastCruiseInsight } from '../../features/lastCruiseReport/compare/lastCruiseCompareInsight';

import { LOCKED_KEYS, STORAGE_KEY } from '../../features/lastCruiseReport/constants';
import { useLangFromPath } from '../../features/lastCruiseReport/locale/useLangFromPath';
import { buildAllColsMeta } from '../../features/lastCruiseReport/columns/buildAllColsMeta';
import { useLastCruiseDeviceMap } from '../../features/lastCruiseReport/hooks/useLastCruiseDeviceMap';
import { useLastCruiseData } from '../../features/lastCruiseReport/hooks/useLastCruiseData';
import { useLastCruiseExcel } from '../../features/lastCruiseReport/hooks/useLastCruiseExcel';

import { getLastCruiseList } from '../../lib/api/report';
import { buildImeiToLicensePlateMap } from '../../util/deviceMap';

// ✅ NEW: generic report components
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';

// ✅ NEW: adapter/config for THIS report
import { buildLastCruiseReportConfig } from '../../features/lastCruiseReport/reportConfig';

const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

const LastCruiseReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const { isEn } = useLangFromPath(pathname);
    const rawLocale = isEn ? locales.en : locales.vi;
    const t = rawLocale.lastCruiseReport;

    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const [viewMode, setViewMode] = useState('table');
    const [colModalOpen, setColModalOpen] = useState(false);

    // ✅ Compare states
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
    }, []);

    // ✅ device map (imei -> plate) + có refresh
    const {
        imeiToPlate,
        plateToImeis,
        loadingDeviceMap,
        refreshDeviceMap, // ✅ NEW
    } = useLastCruiseDeviceMap({ buildImeiToLicensePlateMap });

    // data + FE filter/sort/paging
    const {
        loading,
        pagination,
        setPagination,

        sortMode,
        setSortMode,

        totalRecords,
        tableData,
        processedData,

        onSearch,
        onReset,
        handleTableChange,

        refreshApi, // ✅ NEW: refetch list
    } = useLastCruiseData({
        form,
        getLastCruiseList,
        loadingDeviceMap,
        imeiToPlate,
        isEn,
        t,
        plateToImeis,
    });

    // excel
    const { exportExcel } = useLastCruiseExcel({
        processedData,
        isEn,
        t,
    });

    // columns meta
    const allColsMeta = useMemo(() => {
        return buildAllColsMeta({ t, isEn, isMobile });
    }, [t, isEn, isMobile]);

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

    const colLabelMap = useMemo(() => {
        const m = new Map();
        (allColsForModal || []).forEach((c) => m.set(c.key, c.label));
        return m;
    }, [allColsForModal]);

    const customLocale = { emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ' };

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

    const reportConfig = useMemo(() => {
        return buildLastCruiseReportConfig({
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
                            onFinish={() => {
                                onSearch();
                                clearSelection();
                            }}
                        >
                            <Form.Item label={t.filter.dev} name="dev">
                                <Input placeholder={t.filter.devPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={isEn ? 'License plate' : 'Biển số'} name="license_plate">
                                <Input placeholder={isEn ? 'Enter license plate' : 'Nhập biển số xe'} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.fwr} name="fwr">
                                <Input placeholder={t.filter.fwrPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.gps} name="gpsStatus" initialValue="all">
                                <Select>
                                    <Option value="all">{t.filter.gpsAll}</Option>
                                    <Option value="normal">{t.filter.gpsNormal}</Option>
                                    <Option value="lost">{t.filter.gpsLost}</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.sos} name="sosStatus" initialValue="all">
                                <Select>
                                    <Option value="all">{t.filter.sosAll}</Option>
                                    <Option value="on">{t.filter.sosOn}</Option>
                                    <Option value="off">{t.filter.sosOff}</Option>
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

                                    {/* ✅ Reset = clear form + refetch MAP + refetch API */}
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={async () => {
                                            onReset();
                                            clearSelection();
                                            // ✅ force new data
                                            await Promise.allSettled([refreshDeviceMap(), refreshApi()]);
                                        }}
                                        disabled={loading}
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
                            <Space wrap size={12}>
                                <ReportViewToggle value={viewMode} onChange={setViewMode} locale={isEn ? 'en' : 'vi'} />

                                <ReportSortSelect
                                    locale={isEn ? 'en' : 'vi'}
                                    value={sortMode}
                                    onChange={(v) => {
                                        setSortMode(v);
                                        setPagination((p) => ({ ...p, current: 1 }));
                                        clearSelection();
                                    }}
                                    disabled={viewMode !== 'table'}
                                />

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
                                rowKey={(record) =>
                                    record._id || `${record.dev}-${record.createdAt || record.tim || ''}`
                                }
                                columns={columns}
                                locale={customLocale}
                                dataSource={tableData}
                                loading={loading}
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
                                scroll={{ x: 2350, y: 600 }}
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

            <ReportCompareModal
                open={compareOpen}
                onClose={() => setCompareOpen(false)}
                rows={selectedRows}
                uiColumns={columns}
                colLabelMap={colLabelMap}
                ctx={{ isEn, t }}
                buildInsight={buildLastCruiseInsight}
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

export default LastCruiseReportPage;
