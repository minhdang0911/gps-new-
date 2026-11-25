// app/report/last-cruise-list/page.jsx
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Card, Form, Row, Col, Typography, Grid } from 'antd';
import { usePathname } from 'next/navigation';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import ReportCompareModal from '../../components/report/ReportCompareModal';
import { buildLastCruiseInsight } from '../../features/lastCruiseReport/compare/lastCruiseCompareInsight';
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/lastCruiseReport/constants';
import { useLangFromPath } from '../../features/lastCruiseReport/locale/useLangFromPath';
import { useLastCruiseDeviceMap } from '../../features/lastCruiseReport/hooks/useLastCruiseDeviceMap';
import { useLastCruiseData } from '../../features/lastCruiseReport/hooks/useLastCruiseData';
import { useLastCruiseExcel } from '../../features/lastCruiseReport/hooks/useLastCruiseExcel';
import { useLastCruiseAddresses } from '../../features/lastCruiseReport/hooks/useLastCruiseAddresses';
import { getLastCruiseList } from '../../lib/api/report';
import { buildImeiToLicensePlateMap } from '../../util/deviceMap';
import ReportPanel from '../../components/chart/ReportPanel';
import { buildLastCruiseReportConfig } from '../../features/lastCruiseReport/reportConfig';
import ReportEmptyState from '../../components/report/ReportEmptyState';

import LastCruiseFilterForm from './components/LastCruiseFilterForm';
import LastCruiseTableToolbar from './components/LastCruiseTableToolbar';
import LastCruiseTableView from './components/LastCruiseTableView';
import { useLastCruiseTableColumns } from './hooks/useLastCruiseTableColumns';

const { useBreakpoint } = Grid;
const { Title, Text } = Typography;
const locales = { vi, en };

export default function LastCruiseReportPage() {
    const [form] = Form.useForm();
    const pathname = usePathname() || '/';
    const { isEn } = useLangFromPath(pathname);
    const rawLocale = isEn ? locales.en : locales.vi;
    const translation = rawLocale.lastCruiseReport;

    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const [viewMode, setViewMode] = useState('table');
    const [colModalOpen, setColModalOpen] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [timePresetResetKey, setTimePresetResetKey] = useState(0);

    const [compareOpen, setCompareOpen] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);

    const clearSelection = useCallback(() => {
        setSelectedRowKeys([]);
        setSelectedRows([]);
    }, []);

    const { imeiToPlate, plateToImeis, loadingDeviceMap, refreshDeviceMap } = useLastCruiseDeviceMap({
        buildImeiToLicensePlateMap,
    });

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
        refreshApi,
    } = useLastCruiseData({
        form,
        getLastCruiseList,
        loadingDeviceMap,
        imeiToPlate,
        isEn,
        t: translation,
        plateToImeis,
    });

    const { exportExcel } = useLastCruiseExcel({
        processedData,
        isEn,
        t: translation,
    });

    const { enrichedRows: tableDataWithAddress, enrichRows: enrichRowsWithAddresses } = useLastCruiseAddresses({
        rows: tableData,
        allRows: processedData,
        isEn,
        enabled: viewMode === 'table',
    });

    const selectedRowsWithAddress = useMemo(
        () => enrichRowsWithAddresses(selectedRows),
        [enrichRowsWithAddresses, selectedRows]
    );

    const { columns, tableColumns, visibleOrder, setVisibleOrder, allColsForModal, colLabelMap } =
        useLastCruiseTableColumns({
            translation,
            isEnglish: isEn,
            isMobileScreen: isMobile,
        });

    const customLocale = { emptyText: <ReportEmptyState hasSearched={hasSearched} isEn={isEn} /> };

    const rowSelection = useMemo(
        () => ({
            fixed: !isMobile,
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
        [selectedRowKeys, isMobile]
    );

    const reportConfig = useMemo(
        () => buildLastCruiseReportConfig({ rows: processedData || [], isEn, t: translation }),
        [processedData, isEn, translation]
    );

    const handleFilterReset = async () => {
        onReset();
        clearSelection();
        setTimePresetResetKey((currentKey) => currentKey + 1);
        await Promise.allSettled([refreshDeviceMap(), refreshApi()]);
    };

    return (
        <div className="usage-report-page">
            <div className="usage-report-header">
                <Title level={4} style={{ margin: 0 }}>
                    {translation.title}
                </Title>
                <Text type="secondary">{translation.subtitle}</Text>
            </div>

            <Row gutter={[16, 16]} className="usage-report-row">
                <Col xs={24} lg={7}>
                    <LastCruiseFilterForm
                        form={form}
                        translation={translation}
                        isEnglish={isEn}
                        isLoading={loading}
                        timePresetResetKey={timePresetResetKey}
                        onFilterSubmit={() => {
                            setHasSearched(true);
                            onSearch();
                            clearSelection();
                        }}
                        onFilterReset={handleFilterReset}
                    />
                </Col>

                <Col xs={24} lg={17}>
                    <Card
                        className="usage-table-card"
                        size="small"
                        title={translation.table.title}
                        extra={
                            <LastCruiseTableToolbar
                                viewMode={viewMode}
                                onViewModeChange={setViewMode}
                                sortMode={sortMode}
                                onSortModeChange={(newSortMode) => {
                                    setSortMode(newSortMode);
                                    setPagination((prevPagination) => ({ ...prevPagination, current: 1 }));
                                    clearSelection();
                                }}
                                selectedRowsCount={selectedRows.length}
                                onOpenCompareModal={() => setCompareOpen(true)}
                                onClearSelection={clearSelection}
                                onOpenColumnModal={() => setColModalOpen(true)}
                                onExportExcel={exportExcel}
                                isEnglish={isEn}
                            />
                        }
                    >
                        {viewMode === 'table' ? (
                            <LastCruiseTableView
                                tableColumns={tableColumns}
                                tableDataWithAddress={tableDataWithAddress}
                                customLocale={customLocale}
                                isLoading={loading}
                                rowSelection={rowSelection}
                                pagination={pagination}
                                totalRecords={totalRecords}
                                totalCountTemplate={translation.table.showTotal}
                                onTableChange={handleTableChange}
                                onClearSelection={clearSelection}
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
                rows={selectedRowsWithAddress}
                uiColumns={columns}
                colLabelMap={colLabelMap}
                ctx={{ isEn, t: translation }}
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
                    hint: isEn ? 'Drag to reorder. Uncheck or press X to hide.' : 'Kéo thả để đổi vị trí. Bỏ tick hoặc bấm X để ẩn cột.',
                    apply: isEn ? 'Apply' : 'Áp dụng',
                    cancel: isEn ? 'Cancel' : 'Huỷ',
                    reset: isEn ? 'Reset' : 'Đặt lại',
                }}
            />
        </div>
    );
}
