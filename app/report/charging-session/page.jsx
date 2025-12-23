'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getChargingSessions } from '../../lib/api/chargingSession';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// ✅ helper (existing)
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

// ✅ reusable (existing)
import ReportSortSelect from '../../components/report/ReportSortSelect';
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';

// ✅ compare component chung + insight riêng
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildChargingSessionInsight } from '../../features/chargingSessionReport/compare/chargingSessionCompareInsight';

// ✅ extracted (existing)
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/chargingSessionReport/constants';
import { applySortCharging } from '../../features/chargingSessionReport/utils';
import { buildAllColsMeta } from '../../features/chargingSessionReport/columns/buildAllColsMeta';
import { useChargingDeviceMap } from '../../features/chargingSessionReport/hooks/useChargingDeviceMap';
import { useChargingSessionData } from '../../features/chargingSessionReport/hooks/useChargingSessionData';
import { useChargingSessionExcel } from '../../features/chargingSessionReport/hooks/useChargingSessionExcel';

// ✅ NEW: generic report components
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';

// ✅ NEW: adapter/config for THIS report
import { buildChargingSessionReportConfig } from '../../features/chargingSessionReport/reportConfig';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const ChargingSessionReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);
    const t = isEn ? locales.en.chargingSessionReport : locales.vi.chargingSessionReport;

    // ✅ view mode: table | report
    const [viewMode, setViewMode] = useState('table');

    // ✅ device maps
    const { imeiToPlate, plateToImeis, loadingDeviceMap } = useChargingDeviceMap({
        buildImeiToLicensePlateMap,
    });

    // ✅ data hook
    const {
        serverData,
        fullData,
        loading,
        pagination,
        setPagination,
        sortMode,
        setSortMode,
        needFullData,
        fetchPaged,
        fetchAll,
    } = useChargingSessionData({
        form,
        getChargingSessions,
        isEn,
        t,
        imeiToPlate,
        plateToImeis,
        loadingDeviceMap,
        attachLicensePlate,
    });

    // ✅ FE sort (only when needFullData)
    const sortedFull = useMemo(() => {
        if (!needFullData) return fullData;
        return applySortCharging(fullData, sortMode);
    }, [needFullData, fullData, sortMode]);

    const baseRows = useMemo(() => (needFullData ? sortedFull : serverData), [needFullData, sortedFull, serverData]);

    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        return (baseRows || []).slice(start, end);
    }, [baseRows, pagination]);

    // ✅ keep total synced in full-mode
    useEffect(() => {
        if (!needFullData) return;
        setPagination((p) => ({ ...p, total: sortedFull.length }));
    }, [needFullData, sortedFull.length, setPagination]);

    // ✅ excel
    const { exportExcel } = useChargingSessionExcel({ isEn, t });
    const onExport = () => exportExcel(baseRows);

    const onFinish = () => {
        setPagination((p) => ({ ...p, current: 1 }));
        if (needFullData) fetchAll({ force: true });
        else fetchPaged(1, pagination.pageSize, { force: true });
    };

    const onReset = () => {
        form.resetFields();
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        fetchPaged(1, pagination.pageSize, { force: true });
    };

    const handleTableChange = (pager) => {
        const next = { current: pager.current, pageSize: pager.pageSize };
        setPagination((p) => ({ ...p, ...next }));
        if (!needFullData) fetchPaged(next.current, next.pageSize);
    };

    // ======= Column Manager =======
    const [colModalOpen, setColModalOpen] = useState(false);

    const allColsMeta = useMemo(() => {
        return buildAllColsMeta({ t, isEn, isMobile });
    }, [t, isEn, isMobile]);

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

    // ✅ label map để compare-table ra đúng tiếng (giống table ngoài)
    const colLabelMap = useMemo(() => {
        const m = new Map();
        (allColsForModal || []).forEach((c) => m.set(c.key, c.label));
        return m;
    }, [allColsForModal]);

    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    // ======= Compare states =======
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

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

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
    }, []);

    // =========================
    // ✅ REPORT CONFIG (kpis + charts) for Charging Session
    // =========================
    const reportConfig = useMemo(() => {
        return buildChargingSessionReportConfig({
            rows: baseRows || [],
            isEn,
            t,
        });
    }, [baseRows, isEn, t]);

    return (
        <div className="usage-report-page">
            <div className="usage-report-header">
                <Title level={4} style={{ margin: 0 }}>
                    {t.title}
                </Title>
                <Text type="secondary">{t.subtitle}</Text>
            </div>

            <Row gutter={[16, 16]} className="usage-report-row">
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title={t.filter.title} size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            <Form.Item label={t.filter.chargeCode} name="chargeCode">
                                <Input placeholder={t.filter.chargeCodePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={isEn ? 'License plate' : 'Biển số'} name="license_plate">
                                <Input placeholder={isEn ? 'Enter license plate' : 'Nhập biển số xe'} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.soh} name="soh">
                                <Input placeholder={t.filter.sohPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.timeRange} name="timeRange">
                                <RangePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm:ss" />
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

                <Col xs={24} lg={17}>
                    <Card
                        className="usage-table-card"
                        size="small"
                        title={t.table.title}
                        extra={
                            <Space size={12} wrap>
                                {/* ✅ Toggle mode */}
                                <ReportViewToggle value={viewMode} onChange={setViewMode} locale={isEn ? 'en' : 'vi'} />

                                <ReportSortSelect
                                    locale={isEn ? 'en' : 'vi'}
                                    value={sortMode}
                                    onChange={(v) => {
                                        setSortMode(v);
                                        setPagination((p) => ({ ...p, current: 1 }));
                                    }}
                                    disabled={viewMode !== 'table'}
                                />

                                {/* ✅ Compare button */}
                                <Button
                                    size="small"
                                    disabled={viewMode !== 'table' || selectedRows.length < 2}
                                    onClick={() => setCompareOpen(true)}
                                >
                                    {isEn ? `Compare (${selectedRows.length})` : `So sánh (${selectedRows.length})`}
                                </Button>

                                <Button
                                    icon={<SettingOutlined />}
                                    size="small"
                                    onClick={() => setColModalOpen(true)}
                                    disabled={viewMode !== 'table'}
                                >
                                    {isEn ? 'Columns' : 'Cột'}
                                </Button>

                                <Button icon={<DownloadOutlined />} size="small" onClick={onExport}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>

                                {selectedRows.length > 0 && viewMode === 'table' && (
                                    <Button size="small" onClick={clearSelection}>
                                        {isEn ? 'Clear selection' : 'Bỏ chọn'}
                                    </Button>
                                )}
                            </Space>
                        }
                    >
                        {viewMode === 'table' ? (
                            <Table
                                rowKey={(r) =>
                                    r._id || r.sessionId || `${r.imei}-${r.start || r.startTime}-${r.end || r.endTime}`
                                }
                                columns={columns}
                                dataSource={tableData}
                                loading={loading}
                                locale={{ emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu' }}
                                rowSelection={rowSelection}
                                pagination={{
                                    current: pagination.current,
                                    pageSize: pagination.pageSize,
                                    total: pagination.total,
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50', '100'],
                                    showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                                    showQuickJumper: true,
                                }}
                                onChange={handleTableChange}
                                scroll={{ x: 1400 }}
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
                buildInsight={buildChargingSessionInsight}
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

export default ChargingSessionReportPage;
