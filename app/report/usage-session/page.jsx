'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Grid, Select } from 'antd';
import { SearchOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import TimeRangePresetPicker from '../../components/common/TimeRangePresetPicker';

import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

import { getUsageSessions } from '../../lib/api/usageSession';
import './usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// resizable
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';

// reusable
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';
import ReportSortSelect from '../../components/report/ReportSortSelect';

// compare
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildUsageSessionInsight } from '../../features/usageSessionReport/compare/usageSessionCompareInsight';

// extracted
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/usageSessionReport/constants';
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { applyClientFilterSort, buildGrouped, filterByTimeRange } from '../../features/usageSessionReport/utils';
import { buildAllColsMeta } from '../../features/usageSessionReport/columns/buildAllColsMeta';
import { useUsageSessionData } from '../../features/usageSessionReport/hooks/useUsageSessionData';
import { useUsageSessionExcel } from '../../features/usageSessionReport/hooks/useUsageSessionExcel';

// chart view
import ReportViewToggle from '../../components/chart/ReportViewToggle';
import ReportPanel from '../../components/chart/ReportPanel';
import { buildUsageSessionReportConfig } from '../../features/usageSessionReport/reportConfig';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

// ===== Resizable header cell =====
const ResizableTitle = (props) => {
    const { onResize, width, ...restProps } = props;

    if (!width) return <th {...restProps} />;

    return (
        <Resizable
            width={width}
            height={0}
            handle={<span className="iky-resize-handle" onClick={(e) => e.stopPropagation()} />}
            onResize={onResize}
            draggableOpts={{ enableUserSelectHack: false }}
        >
            <th {...restProps} />
        </Resizable>
    );
};

// ========= Preset Range =========
const buildPresetRange = (key) => {
    const now = dayjs();

    switch (key) {
        case 'thisWeek':
            return [now.startOf('isoWeek'), now.endOf('day')];
        case 'last1Month':
            return [now.subtract(1, 'month').startOf('day'), now.endOf('day')];
        case 'thisMonth':
            return [now.startOf('month'), now.endOf('day')];
        case 'last3Months':
            return [now.subtract(3, 'month').startOf('day'), now.endOf('day')];
        case 'last6Months':
            return [now.subtract(6, 'month').startOf('day'), now.endOf('day')];
        case 'thisQuarter':
            return [now.startOf('quarter'), now.endOf('day')];
        case 'prevQuarter': {
            const prev = now.subtract(1, 'quarter');
            return [prev.startOf('quarter'), prev.endOf('quarter')];
        }
        case 'thisYear':
            return [now.startOf('year'), now.endOf('day')];
        default:
            return null;
    }
};

export default function UsageSessionReportPage() {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);
    const t = isEn ? locales.en.usageSessionReport : locales.vi.usageSessionReport;

    const [viewMode, setViewMode] = useState('table');

    const {
        serverData,
        fullData,
        loading,
        pagination,
        setPagination,

        sortMode,
        setSortMode,
        tableFilters,
        setTableFilters,
        groupBy,
        setGroupBy,
        needFullData,

        fetchPaged,
        fetchAll,
        refresh,
    } = useUsageSessionData({ form, getUsageSessions, isEn, t });

    const { exporting, exportExcel } = useUsageSessionExcel({ form, getUsageSessions, t, isEn });

    // preset
    const [presetKey, setPresetKey] = useState('none');
    const applyPreset = (key) => {
        setPresetKey(key);
        const range = buildPresetRange(key);
        if (!range) return;
        form.setFieldsValue({ timeRange: range });
    };

    const onFinish = () => {
        setPagination((p) => ({ ...p, current: 1 }));
        if (needFullData) fetchAll();
        else fetchPaged(1, pagination.pageSize);
    };

    // ===== Column Resize (persist) =====
    const COL_WIDTHS_KEY = `${STORAGE_KEY}__widths`;
    const [colWidths, setColWidths] = useState({});

    // load widths on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(COL_WIDTHS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') setColWidths(parsed);
        } catch {}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // save widths when change
    useEffect(() => {
        try {
            localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths || {}));
        } catch {}
    }, [colWidths]);

    const handleResize =
        (key) =>
        (_, { size }) => {
            setColWidths((prev) => ({ ...prev, [key]: size.width }));
        };

    const onReset = async () => {
        form.resetFields();
        setPresetKey('none');

        setTableFilters({ vehicleId: null, batteryId: null });
        setSortMode('none');
        setGroupBy('none');
        setPagination((p) => ({ ...p, current: 1 }));

        // reset widths + clear storage
        setColWidths({});
        try {
            localStorage.removeItem(COL_WIDTHS_KEY);
        } catch {}

        await fetchPaged(1, pagination.pageSize);
        await refresh();
    };

    const uniqueFiltersFrom = useMemo(
        () => (needFullData ? fullData : serverData),
        [needFullData, fullData, serverData],
    );

    const vehicleFilterOptions = useMemo(() => {
        const s = new Set();
        uniqueFiltersFrom.forEach((x) => x?.vehicleId && s.add(x.vehicleId));
        return Array.from(s)
            .sort()
            .map((v) => ({ text: v, value: v }));
    }, [uniqueFiltersFrom]);

    const batteryFilterOptions = useMemo(() => {
        const s = new Set();
        uniqueFiltersFrom.forEach((x) => x?.batteryId && s.add(x.batteryId));
        return Array.from(s)
            .sort()
            .map((v) => ({ text: v, value: v }));
    }, [uniqueFiltersFrom]);

    const processedData = useMemo(() => {
        if (!needFullData) return serverData;

        const timeRange = form.getFieldValue('timeRange');
        const timeFiltered = filterByTimeRange(fullData, timeRange);

        const filteredSorted = applyClientFilterSort(timeFiltered, tableFilters, sortMode);
        if (groupBy !== 'none') return buildGrouped(filteredSorted, groupBy);
        return filteredSorted;
    }, [needFullData, serverData, fullData, sortMode, tableFilters, groupBy, form]);

    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        return (processedData || []).slice(start, end);
    }, [processedData, pagination]);

    useEffect(() => {
        if (!needFullData) return;
        setPagination((p) => ({ ...p, total: processedData.length }));
    }, [needFullData, processedData.length, setPagination]);

    // Column manager
    const [colModalOpen, setColModalOpen] = useState(false);

    const allColsMeta = useMemo(() => {
        return buildAllColsMeta({
            t,
            isEn,
            isMobile,
            vehicleFilterOptions,
            batteryFilterOptions,
            tableFilters,
        });
    }, [t, isEn, isMobile, vehicleFilterOptions, batteryFilterOptions, tableFilters]);

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

    const columnsWithMenu = useMemo(() => columns || [], [columns]);

    // apply resize to columns
    const columnsResizable = useMemo(() => {
        const DEFAULT_W = 180;

        return (columnsWithMenu || []).map((col) => {
            const key = col.key ?? col.dataIndex ?? col.title;
            if (!key) return col;

            const width = colWidths[key] ?? col.width ?? DEFAULT_W;

            return {
                ...col,
                width,
                onHeaderCell: () => ({
                    width,
                    onResize: handleResize(key),
                }),
            };
        });
    }, [columnsWithMenu, colWidths]);

    // datasource gắn __rowNo
    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: row?.__group ? '' : (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    // Compare selection
    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    useEffect(() => {
        const id = setTimeout(() => {
            setSelectedRowKeys([]);
            setSelectedRows([]);
        }, 0);
        return () => clearTimeout(id);
    }, [needFullData, pagination.current, pagination.pageSize, sortMode, tableFilters]);

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
            getCheckboxProps: (record) => ({ disabled: record?.__group }),
        }),
        [selectedRowKeys],
    );

    const handleTableChange = (pager, filters) => {
        const nextPager = { current: pager.current, pageSize: pager.pageSize };

        const nextFilters = {
            vehicleId: filters?.vehicleId ? filters.vehicleId : null,
            batteryId: filters?.batteryId ? filters.batteryId : null,
        };

        const filtersChanged =
            JSON.stringify(nextFilters.vehicleId || null) !== JSON.stringify(tableFilters.vehicleId || null) ||
            JSON.stringify(nextFilters.batteryId || null) !== JSON.stringify(tableFilters.batteryId || null);

        if (filtersChanged) {
            setTableFilters(nextFilters);
            setPagination((p) => ({ ...p, current: 1, pageSize: nextPager.pageSize }));
            return;
        }

        setPagination((p) => ({ ...p, current: nextPager.current, pageSize: nextPager.pageSize }));

        if (!needFullData) fetchPaged(nextPager.current, nextPager.pageSize);
    };

    const reportConfig = useMemo(() => {
        return buildUsageSessionReportConfig({
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
                <Col xs={24} lg={7}>
                    <Card className="usage-filter-card" title={t.filter.title} size="small">
                        <Form form={form} layout="vertical" onFinish={onFinish}>
                            <Form.Item label={t.filter.sessionId} name="sessionId">
                                <Input placeholder={t.filter.sessionIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.batteryId} name="batteryId">
                                <Input placeholder={t.filter.batteryIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.usageCode} name="usageCode">
                                <Input placeholder={t.filter.usageCodePlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.deviceId} name="deviceId">
                                <Input placeholder={t.filter.deviceIdPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.soh} name="soh">
                                <Input placeholder={t.filter.sohPlaceholder} allowClear />
                            </Form.Item>

                            <Form.Item label={t.filter.timeRange}>
                                <TimeRangePresetPicker
                                    name="timeRange"
                                    locale={isEn ? 'en' : 'vi'}
                                    format="YYYY-MM-DD HH:mm:ss"
                                    showTime
                                />
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
                                    size="small"
                                    icon={<SettingOutlined />}
                                    onClick={() => setColModalOpen(true)}
                                    disabled={viewMode !== 'table'}
                                >
                                    {isEn ? 'Columns' : 'Cột'}
                                </Button>

                                <Button size="small" onClick={exportExcel} loading={exporting}>
                                    {t.excel?.buttonText || (!isEn ? 'Xuất Excel' : 'Export Excel')}
                                </Button>
                            </Space>
                        }
                    >
                        {viewMode === 'table' ? (
                            <Table
                                tableLayout="fixed"
                                rowKey={(record) => record._id || record.usageCode}
                                columns={columnsResizable}
                                components={{
                                    header: {
                                        cell: ResizableTitle,
                                    },
                                }}
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
                                scroll={{ x: 2400 }}
                                expandable={
                                    groupBy !== 'none' ? { defaultExpandAllRows: false, indentSize: 18 } : undefined
                                }
                                rowClassName={(record) => (record?.__group ? 'iky-group-row' : '')}
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
                uiColumns={columnsWithMenu}
                colLabelMap={colLabelMap}
                ctx={{ isEn, t }}
                buildInsight={buildUsageSessionInsight}
            />

            <ColumnManagerModal
                open={colModalOpen}
                onClose={() => setColModalOpen(false)}
                allCols={allColsForModal}
                visibleOrder={visibleOrder}
                setVisibleOrder={setVisibleOrder}
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

            <style jsx global>{`
                .iky-group-row td {
                    background: #f8fafc !important;
                }

                /* resizable handle */
                .iky-resize-handle {
                    position: absolute;
                    right: -6px;
                    top: 0;
                    height: 100%;
                    width: 12px;
                    cursor: col-resize;
                    z-index: 1;
                }
                .ant-table-thead > tr > th {
                    position: relative;
                }
            `}</style>
        </div>
    );
}
