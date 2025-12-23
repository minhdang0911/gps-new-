'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getTripReport } from '../../lib/api/report';
import { getUserList } from '../../lib/api/user';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import '../usage-session/usageSession.css';

// ✅ helper (existing)
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

// ✅ reusable (existing)
import ReportSortSelect from '../../components/report/ReportSortSelect';
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';

// ✅ compare (component chung + insight riêng)
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildTripReportInsight } from '../../features/tripReport/compare/tripReportCompareInsight';

// ✅ extracted (existing)
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/tripReport/constants';
import { buildAllColsMeta } from '../../features/tripReport/columns/buildAllColsMeta';
import { useTripReportDeviceMap } from '../../features/tripReport/hooks/useTripReportDeviceMap';
import { useTripReportDistributors } from '../../features/tripReport/hooks/useTripReportDistributors';
import { useTripReportData } from '../../features/tripReport/hooks/useTripReportData';
import { useTripReportExcel } from '../../features/tripReport/hooks/useTripReportExcel';

// ✅ NEW: generic report components
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';

// ✅ NEW: adapter/config for THIS report
import { buildTripReportReportConfig } from '../../features/tripReport/reportConfig';

const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

const TripReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);

    // ✅ view mode
    const [viewMode, setViewMode] = useState('table');

    const rawLocale = isEn ? locales.en : locales.vi;

    const defaultT = {
        title: 'Báo cáo chuyến (Trip report)',
        subtitle: 'Tổng quan số chuyến, quãng đường, trạng thái thiết bị theo ngày',
        filter: {
            title: 'Bộ lọc',
            imei: 'IMEI',
            imeiPlaceholder: 'Nhập IMEI',
            licensePlate: 'Biển số',
            licensePlatePlaceholder: 'Nhập biển số',
            motorcycleId: 'Mã xe (Motorcycle ID)',
            motorcycleIdPlaceholder: 'Nhập mã xe',
            connectionStatus: 'Trạng thái kết nối',
            connectionStatusPlaceholder: 'Chọn trạng thái',
            movementStatus: 'Trạng thái di chuyển',
            movementStatusPlaceholder: 'Chọn trạng thái',
            lockStatus: 'Trạng thái khoá',
            lockStatusPlaceholder: 'Chọn trạng thái',
            timeRange: 'Khoảng ngày',
            search: 'Tìm kiếm',
            reset: 'Làm mới',
        },
        table: {
            title: 'Danh sách trip report',
            showTotal: 'Tổng {total} bản ghi',
        },
    };

    const t = rawLocale.tripReport || defaultT;

    // ✅ distributors
    const { distributorMap, getDistributorLabel } = useTripReportDistributors({ getUserList });

    // ✅ device maps
    const { imeiToPlate, plateToImeis, loadingDeviceMap } = useTripReportDeviceMap({
        buildImeiToLicensePlateMap,
    });

    // ✅ data + FE filter/sort/pagination
    const {
        loading,
        filterValues,
        setFilterValues,
        sortMode,
        setSortMode,
        pagination,
        setPagination,
        totalRecords,
        tableData,
        processedData,
        fetchData,
        mutate,
    } = useTripReportData({
        form,
        getTripReport,
        isEn,
        t,
        imeiToPlate,
        plateToImeis,
        loadingDeviceMap,
        attachLicensePlate,
    });

    // ✅ excel
    const { exportExcel } = useTripReportExcel({ isEn, t, getDistributorLabel });

    // ===== Compare states (✅ moved UP before clearSelection) =====
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
    }, []);

    const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
    const normalizePlate = (s) =>
        (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

    // ===== actions =====
    const onFinish = () => {
        const values = form.getFieldsValue();

        const imeiInput = normStr(values?.imei || '');
        const plateInput = normalizePlate(values?.license_plate || '');

        // nếu user KHÔNG nhập imei mà có biển số => map sang imei
        if (!imeiInput && plateInput) {
            const mappedImeis = plateToImeis?.get?.(plateInput) || [];

            if (mappedImeis.length > 0) {
                // nếu API chỉ nhận 1 imei => lấy cái đầu
                form.setFieldValue('imei', String(mappedImeis[0]));
            } else {
                // không map được: tuỳ bạn muốn
                // 1) báo warning
                // message.warning(isEn ? 'Plate not mapped to IMEI' : 'Biển số chưa map ra IMEI');
                // 2) hoặc cứ cho search theo plate FE (nhưng bạn nói muốn chỉ cover mapping thôi)
            }
        }

        const newValues = form.getFieldsValue(); // lấy lại sau khi set imei
        setFilterValues(newValues);
        clearSelection();
        setPagination((p) => ({ ...p, current: 1 }));

        fetchData({ page: 1, filters: newValues, sortMode }, { force: true });
    };

    const onReset = () => {
        form.resetFields();
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        clearSelection();

        const values = {}; // reset filters
        setFilterValues(values);

        fetchData({ page: 1, filters: values, sortMode: 'none' }, { force: true });
    };

    const handleTableChange = (pager) => {
        setPagination({ current: pager.current, pageSize: pager.pageSize });
    };

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

    // ===== Column manager =====
    const [colModalOpen, setColModalOpen] = useState(false);

    const allColsMeta = useMemo(() => {
        return buildAllColsMeta({
            t,
            isEn,
            isMobile,
            distributorMap,
            getDistributorLabel,
        });
    }, [t, isEn, isMobile, distributorMap, getDistributorLabel]);

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

    // ✅ label map để compare-table ra đúng label
    const colLabelMap = useMemo(() => {
        const m = new Map();
        (allColsForModal || []).forEach((c) => m.set(c.key, c.label));
        return m;
    }, [allColsForModal]);

    // ✅ report config (kpis + charts) from processedData
    const reportConfig = useMemo(() => {
        return buildTripReportReportConfig({
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
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            <Form.Item label={t.filter.licensePlate} name="license_plate">
                                <Input placeholder={t.filter.licensePlatePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.imei} name="imei">
                                <Input placeholder={t.filter.imeiPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.motorcycleId} name="motorcycleId">
                                <Input placeholder={t.filter.motorcycleIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.connectionStatus} name="connectionStatus">
                                <Select allowClear placeholder={t.filter.connectionStatusPlaceholder}>
                                    <Option value="online">Online</Option>
                                    <Option value="offline">Offline</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.movementStatus} name="movementStatus">
                                <Select allowClear placeholder={t.filter.movementStatusPlaceholder}>
                                    <Option value="RUNNING">RUNNING</Option>
                                    <Option value="STOP">STOP</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item label={t.filter.lockStatus} name="lockStatus">
                                <Select allowClear placeholder={t.filter.lockStatusPlaceholder}>
                                    <Option value="LOCK">LOCK</Option>
                                    <Option value="UNLOCK">UNLOCK</Option>
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
                                        setPagination((p) => ({ ...p, current: 1 }));

                                        fetchData({ page: 1, filters: filterValues, sortMode: v }, { force: true });
                                    }}
                                    disabled={viewMode !== 'table'}
                                    options={[
                                        { value: 'none', label: isEn ? 'Sort: Default' : 'Sắp xếp: Mặc định' },
                                        { value: 'newest', label: isEn ? 'Date: New → Old' : 'Ngày: Mới → Cũ' },
                                        { value: 'oldest', label: isEn ? 'Date: Old → New' : 'Ngày: Cũ → Mới' },
                                    ]}
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

                                <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={() => exportExcel(processedData)}
                                >
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        {viewMode === 'table' ? (
                            <Table
                                rowKey={(r) => r._id || `${r.imei}-${r.date}`}
                                columns={columns}
                                locale={{ emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu' }}
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
                                onChange={handleTableChange}
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
                buildInsight={buildTripReportInsight}
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

export default TripReportPage;
