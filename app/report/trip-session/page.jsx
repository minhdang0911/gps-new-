// TripSessionReportPage.jsx

'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
    Grid,
    Divider,
    Statistic,
} from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import dayjs from 'dayjs';
import { getTripSessions } from '../../lib/api/tripSession';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

// ✅ reusable
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';
import ReportSortSelect from '../../components/report/ReportSortSelect';

// ✅ compare
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildTripSessionInsight } from '../../features/tripSessionReport/compare/tripSessionCompareInsight';

// ✅ extracted
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/tripSessionReport/constants';
import { buildAllColsMeta } from '../../features/tripSessionReport/columns/buildAllColsMeta';
import { applySortTrip } from '../../features/tripSessionReport/utils';
import { useTripDeviceMap } from '../../features/tripSessionReport/hooks/useTripDeviceMap';
import { useTripSessionData } from '../../features/tripSessionReport/hooks/useTripSessionData';
import { useTripSessionExcel } from '../../features/tripSessionReport/hooks/useTripSessionExcel';

// ✅ report ui
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';
import { buildTripSessionReportConfig } from '../../features/tripSessionReport/reportConfig';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const normStr = (v) => (typeof v === 'string' ? v.trim() : '');
const normalizePlate = (s) =>
    (s || '').toString().trim().toUpperCase().replace(/\s+/g, '').replace(/[._]/g, '-').replace(/--+/g, '-');

const getRowImei = (row) => normStr(String(row?.imei ?? row?.IMEI ?? row?.deviceImei ?? row?.device?.imei ?? ''));
const getRowPlate = (row) =>
    normalizePlate(String(row?.license_plate ?? row?.licensePlate ?? row?.plate ?? row?.licensePlateText ?? ''));

/**
 * ✅ Format distance kiểu VN: ngắn gọn, dễ hiểu
 * - < 1 km      -> m
 * - 1.. < 10 km -> "x km y m"
 * - 10..<1000   -> "xx km" (làm tròn)
 * - >= 1000     -> "x.x nghìn km"
 * - >= 1,000,000-> "x.xx triệu km"
 */
export function formatDistanceVN(km) {
    const n = Number(km);
    if (!Number.isFinite(n) || n <= 0) return '0 m';

    if (n < 1) {
        return `${Math.round(n * 1000)} m`;
    }

    if (n < 10) {
        const wholeKm = Math.floor(n);
        const meters = Math.round((n - wholeKm) * 1000);
        return meters > 0 ? `${wholeKm} km ${meters} m` : `${wholeKm} km`;
    }

    if (n < 1000) {
        return `${Math.round(n)} km`;
    }

    if (n < 1_000_000) {
        return `${(n / 1000).toFixed(1)} nghìn km`;
    }

    return `${(n / 1_000_000).toFixed(2)} triệu km`;
}

/**
 * ✅ Format distance kiểu EN
 * - < 1 km      -> m
 * - 1.. < 10 km -> "x km y m"
 * - 10..<1000   -> "xx km" (rounded)
 * - >= 1000     -> "x.xk km"
 * - >= 1,000,000-> "x.xxM km"
 */
export function formatDistanceEN(km) {
    const n = Number(km);
    if (!Number.isFinite(n) || n <= 0) return '0 m';

    if (n < 1) {
        return `${Math.round(n * 1000)} m`;
    }

    if (n < 10) {
        const wholeKm = Math.floor(n);
        const meters = Math.round((n - wholeKm) * 1000);
        return meters > 0 ? `${wholeKm} km ${meters} m` : `${wholeKm} km`;
    }

    if (n < 1000) {
        return `${Math.round(n)} km`;
    }

    if (n < 1_000_000) {
        return `${(n / 1000).toFixed(1)}k km`;
    }

    return `${(n / 1_000_000).toFixed(2)}M km`;
}

/** ✅ Wrapper theo locale */
export function formatDistance(km, locale = 'vi') {
    return locale === 'en' ? formatDistanceEN(km) : formatDistanceVN(km);
}

const TripSessionReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);
    const t = isEn ? locales.en.tripSessionReport : locales.vi.tripSessionReport;

    const [viewMode, setViewMode] = useState('table');

    // FE filters
    const [feFilters, setFeFilters] = useState({ imeis: [], imeiText: '', plateText: '' });

    // ✅ device maps
    const { imeiToPlate, plateToImeis, loadingDeviceMap } = useTripDeviceMap({
        buildImeiToLicensePlateMap,
    });

    // ✅ data from BE
    const { serverData, loading, pagination, setPagination, sortMode, setSortMode, fetchBase } = useTripSessionData({
        form,
        getTripSessions,
        isEn,
        t,
        imeiToPlate,
        plateToImeis,
        loadingDeviceMap,
        attachLicensePlate,
    });

    // ===== Compare states =====
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
    }, []);

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

    // ✅ FE FILTER (IMEI / Biển số)
    const feFilteredData = useMemo(() => {
        const list = serverData || [];

        const imeis = feFilters?.imeis || [];
        const imeiText = normStr(feFilters?.imeiText);
        const plateText = normalizePlate(feFilters?.plateText || '');

        if ((!imeis || imeis.length === 0) && !imeiText && !plateText) return list;

        if (imeis && imeis.length > 0) {
            const set = new Set(imeis.map((x) => normStr(String(x))));
            return list.filter((row) => set.has(getRowImei(row)));
        }

        if (imeiText) {
            return list.filter((row) => getRowImei(row).includes(imeiText));
        }

        if (plateText) {
            return list.filter((row) => getRowPlate(row).includes(plateText));
        }

        return list;
    }, [serverData, feFilters]);

    // ✅ sort
    const processedData = useMemo(() => applySortTrip(feFilteredData, sortMode), [feFilteredData, sortMode]);

    // ✅ total theo FE (đã filter + sort)
    useEffect(() => {
        setPagination((p) => ({ ...p, total: processedData.length }));
    }, [processedData.length, setPagination]);

    // ✅ đảm bảo current không vượt maxPage khi total/pageSize đổi
    useEffect(() => {
        const total = processedData.length;
        const pageSize = pagination.pageSize || 10;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (pagination.current > maxPage) {
            setPagination((p) => ({ ...p, current: 1 }));
        }
    }, [processedData.length, pagination.pageSize, pagination.current, setPagination]);

    // ✅ paginate FE bằng slice
    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        return (processedData || []).slice(start, end);
    }, [processedData, pagination.current, pagination.pageSize]);

    // table rows with rowNo
    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    // ✅ Search
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

        clearSelection();
        setPagination((p) => ({ ...p, current: 1 }));

        // ✅ luôn force fetch (payload y hệt vẫn gọi)
        fetchBase({ resetPage: true }, { force: true });
    };

    const onReset = () => {
        clearSelection();
        form.resetFields();
        setFeFilters({ imeis: [], imeiText: '', plateText: '' });
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));

        fetchBase({ resetPage: true }, { force: true });
    };

    const handleTableChange = (pager) => {
        setPagination((p) => ({
            ...p,
            current: pager.current,
            pageSize: pager.pageSize,
        }));
    };

    // ===== Columns =====
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

    // ✅ excel
    const { exportExcel } = useTripSessionExcel({ isEn, t });
    const onExport = () => exportExcel({ pagedData, pagination });

    // ✅ report config
    const reportConfig = useMemo(() => {
        return buildTripSessionReportConfig({
            rows: processedData || [],
            isEn,
            t,
        });
    }, [processedData, isEn, t]);

    // ✅ summary totals (tổng theo kết quả đã lọc)
    const totalKm = useMemo(() => {
        const toNum = (v) => {
            if (v == null) return 0;
            if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
            const s = String(v).trim().replace(/,/g, '');
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        };

        // ⚠️ đổi key nếu data của trip session không phải mileageToday
        return (processedData || []).reduce(
            (sum, r) => sum + toNum(r?.mileageToday ?? r?.distanceKm ?? r?.distance),
            0,
        );
    }, [processedData]);

    const totalTrips = useMemo(() => processedData?.length || 0, [processedData]);

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
                            <Form.Item label={t.filter.tripCode} name="tripCode">
                                <Input placeholder={t.filter.tripCodePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={isEn ? 'License plate' : 'Biển số'} name="license_plate">
                                <Input placeholder={isEn ? 'Enter license plate' : 'Nhập biển số xe'} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.imei} name="imei">
                                <Input placeholder={t.filter.imeiPlaceholder} allowClear />
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

                {/* TABLE / REPORT */}
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
                            <>
                                {/* Summary row */}
                                <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                                    <Col xs={12} sm="auto">
                                        <Statistic
                                            title={isEn ? 'Total distance (filtered)' : 'Tổng quãng đường'}
                                            value={totalKm}
                                            formatter={(v) => formatDistance(Number(v), isEn ? 'en' : 'vi')}
                                        />
                                    </Col>

                                    <Col xs={12} sm="auto">
                                        <Statistic
                                            title={isEn ? 'Total trips (filtered)' : 'Tổng số chuyến'}
                                            value={totalTrips}
                                        />
                                    </Col>
                                </Row>

                                <Divider style={{ margin: '8px 0' }} />

                                <Table
                                    locale={{ emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu' }}
                                    rowKey={(r) =>
                                        r._id ||
                                        r.sessionId ||
                                        r.tripCode ||
                                        `${r.tripCode}-${dayjs(r.startTime).valueOf()}`
                                    }
                                    columns={columns}
                                    dataSource={tableData}
                                    loading={loading}
                                    rowSelection={rowSelection}
                                    pagination={{
                                        current: pagination.current,
                                        pageSize: pagination.pageSize,
                                        total: pagination.total,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100'],
                                        showQuickJumper: true,
                                        showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                                    }}
                                    onChange={handleTableChange}
                                    scroll={{ x: 1400 }}
                                />
                            </>
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
                buildInsight={buildTripSessionInsight}
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

export default TripSessionReportPage;
