'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getChargingSessions } from '../../lib/api/chargingSession';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

// ✅ reusable
import ReportSortSelect from '../../components/report/ReportSortSelect';
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';

// ✅ compare
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildChargingSessionInsight } from '../../features/chargingSessionReport/compare/chargingSessionCompareInsight';

// ✅ extracted
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/chargingSessionReport/constants';
import { applySortCharging } from '../../features/chargingSessionReport/utils';
import { buildAllColsMeta } from '../../features/chargingSessionReport/columns/buildAllColsMeta';
import { useChargingDeviceMap } from '../../features/chargingSessionReport/hooks/useChargingDeviceMap';
import { useChargingSessionData } from '../../features/chargingSessionReport/hooks/useChargingSessionData';
import { useChargingSessionExcel } from '../../features/chargingSessionReport/hooks/useChargingSessionExcel';

// ✅ report ui
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';
import { buildChargingSessionReportConfig } from '../../features/chargingSessionReport/reportConfig';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

// ===== helpers =====
const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

const getRowImei = (row) => normStr(String(row?.imei ?? row?.IMEI ?? row?.deviceImei ?? row?.device?.imei ?? ''));
const getRowPlate = (row) =>
    normalizePlate(String(row?.license_plate ?? row?.licensePlate ?? row?.plate ?? row?.licensePlateText ?? ''));

const ChargingSessionReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);
    const t = isEn ? locales.en.chargingSessionReport : locales.vi.chargingSessionReport;

    // ✅ view mode: table | report
    const [viewMode, setViewMode] = useState('table');

    // ✅ FE filter states (IMEI / Plate)
    const [feFilters, setFeFilters] = useState({ imeis: [], imeiText: '', plateText: '' });

    // ✅ device maps
    const { imeiToPlate, plateToImeis, loadingDeviceMap } = useChargingDeviceMap({
        buildImeiToLicensePlateMap,
    });

    // ✅ data hook (BE fetch theo chargeCode/soh/timeRange..., không filter imei/plate)
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

    // ✅ sort full mode (nếu cần)
    const sortedFull = useMemo(() => {
        if (!needFullData) return fullData;
        return applySortCharging(fullData, sortMode);
    }, [needFullData, fullData, sortMode]);

    // base rows (raw attach + sort)
    const baseRows = useMemo(() => (needFullData ? sortedFull : serverData), [needFullData, sortedFull, serverData]);

    // ✅ FE filter (IMEI/Plate)
    const feFilteredRows = useMemo(() => {
        const list = baseRows || [];

        const imeis = feFilters?.imeis || [];
        const imeiText = normStr(feFilters?.imeiText);
        const plateText = normalizePlate(feFilters?.plateText || '');

        if ((!imeis || imeis.length === 0) && !imeiText && !plateText) return list;

        // 1) exact by imeis set (from plate mapping)
        if (imeis && imeis.length > 0) {
            const set = new Set(imeis.map((x) => normStr(String(x))));
            return list.filter((row) => set.has(getRowImei(row)));
        }

        // 2) partial imei
        if (imeiText) {
            return list.filter((row) => getRowImei(row).includes(imeiText));
        }

        // 3) fallback: filter by plate text directly from attached license_plate
        if (plateText) {
            return list.filter((row) => getRowPlate(row).includes(plateText));
        }

        return list;
    }, [baseRows, feFilters]);

    // ✅ total theo FE filter
    useEffect(() => {
        setPagination((p) => ({ ...p, total: feFilteredRows.length }));
    }, [feFilteredRows.length, setPagination]);

    // ✅ paginate after FE filter
    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        return feFilteredRows.slice(start, end);
    }, [feFilteredRows, pagination]);

    // ✅ clamp current page when filtered length changed
    useEffect(() => {
        const total = feFilteredRows.length;
        const pageSize = pagination.pageSize || 10;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (pagination.current > maxPage) {
            setPagination((p) => ({ ...p, current: 1 }));
        }
    }, [feFilteredRows.length, pagination.pageSize, pagination.current, setPagination]);

    // ✅ excel export (export theo FE filtered, không export theo raw)
    const { exportExcel } = useChargingSessionExcel({ isEn, t });
    const onExport = () => exportExcel(feFilteredRows);

    // ✅ Search submit:
    // - set FE filter (imei/plate)
    // - call BE fetch (theo chargeCode/soh/timeRange...)
    const onFinish = async () => {
        const values = await form.validateFields();

        const plateInput = normalizePlate(values?.license_plate || '');
        const imeiInput = normStr(values?.imei || '');

        const mappedImeis = plateInput ? plateToImeis?.get?.(plateInput) || [] : [];

        if (imeiInput) {
            setFeFilters({ imeis: [], imeiText: imeiInput, plateText: '' });
        } else if (plateInput && mappedImeis.length > 0) {
            setFeFilters({ imeis: mappedImeis, imeiText: '', plateText: '' });
        } else if (plateInput) {
            setFeFilters({ imeis: [], imeiText: '', plateText: plateInput });
        } else {
            setFeFilters({ imeis: [], imeiText: '', plateText: '' });
        }

        setPagination((p) => ({ ...p, current: 1 }));

        // gọi BE fetch theo params BE support
        if (needFullData) fetchAll({ force: true });
        else fetchPaged(1, pagination.pageSize, { force: true });
    };

    const onReset = () => {
        form.resetFields();
        setFeFilters({ imeis: [], imeiText: '', plateText: '' });
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        fetchPaged(1, pagination.pageSize, { force: true });
    };

    const handleTableChange = (pager) => {
        const next = { current: pager.current, pageSize: pager.pageSize };
        setPagination((p) => ({ ...p, ...next }));

        // nếu đang paged-mode thì fetch page mới từ BE
        if (!needFullData) fetchPaged(next.current, next.pageSize);
    };

    // ===== Column Manager =====
    const [colModalOpen, setColModalOpen] = useState(false);

    const allColsMeta = useMemo(() => buildAllColsMeta({ t, isEn, isMobile }), [t, isEn, isMobile]);

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

    const tableData = useMemo(() => {
        return pagedData.map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    // ===== Compare states =====
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

    // ✅ report config from FE filtered
    const reportConfig = useMemo(() => {
        return buildChargingSessionReportConfig({
            rows: feFilteredRows || [],
            isEn,
            t,
        });
    }, [feFilteredRows, isEn, t]);

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

                            {/* ✅ IMEI (FE only) */}
                            <Form.Item label={isEn ? 'IMEI' : 'IMEI'} name="imei">
                                <Input placeholder={isEn ? 'Enter IMEI' : 'Nhập IMEI'} allowClear />
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
                                <ReportViewToggle value={viewMode} onChange={setViewMode} locale={isEn ? 'en' : 'vi'} />

                                <ReportSortSelect
                                    locale={isEn ? 'en' : 'vi'}
                                    value={sortMode}
                                    onChange={(v) => {
                                        setSortMode(v);
                                        clearSelection();
                                        setPagination((p) => ({ ...p, current: 1 }));
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
