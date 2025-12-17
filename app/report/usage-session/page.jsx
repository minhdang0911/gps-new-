'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import { getUsageSessions } from '../../lib/api/usageSession';
import './usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// ✅ reusable
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';
import ReportSortSelect from '../../components/report/ReportSortSelect';

// ✅ extracted
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/usageSessionReport/constants';
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { applyClientFilterSort, buildGrouped } from '../../features/usageSessionReport/utils';
import { buildAllColsMeta } from '../../features/usageSessionReport/columns/buildAllColsMeta';
import { useUsageSessionData } from '../../features/usageSessionReport/hooks/useUsageSessionData';
import { useUsageSessionExcel } from '../../features/usageSessionReport/hooks/useUsageSessionExcel';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const UsageSessionReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);
    const t = isEn ? locales.en.usageSessionReport : locales.vi.usageSessionReport;

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
        // setGroupBy, // (đang không dùng UI groupBy, nên comment tránh eslint warn)

        needFullData,

        fetchPaged,
        fetchAll,
    } = useUsageSessionData({ form, getUsageSessions, isEn, t });

    // ======= Excel export (moved to hook) =======
    const { exporting, exportExcel } = useUsageSessionExcel({ form, getUsageSessions, t, isEn });

    const onFinish = () => {
        setPagination((p) => ({ ...p, current: 1 }));
        if (needFullData) fetchAll();
        else fetchPaged(1, pagination.pageSize);
    };

    const onReset = () => {
        form.resetFields();
        setTableFilters({ vehicleId: null, batteryId: null });
        // setGroupBy('none');
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        fetchPaged(1, pagination.pageSize);
    };

    // ======= Build FE processed data (sort/filter/group) =======
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

        const filteredSorted = applyClientFilterSort(fullData, tableFilters, sortMode);
        if (groupBy !== 'none') return buildGrouped(filteredSorted, groupBy);
        return filteredSorted;
    }, [needFullData, serverData, fullData, sortMode, tableFilters, groupBy]);

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

    // ======= Column Manager (reusable hook) =======
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

    // ======= dataSource gắn __rowNo =======
    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: row?.__group ? '' : (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    // ======= Handle Table change (pagination + filters) =======
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

        if (!needFullData) {
            fetchPaged(nextPager.current, nextPager.pageSize);
        }
    };

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
                                {/* <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(pagination.total))}
                                </Text> */}

                                <ReportSortSelect
                                    locale={isEn ? 'en' : 'vi'}
                                    value={sortMode}
                                    onChange={(v) => {
                                        setSortMode(v);
                                        setPagination((p) => ({ ...p, current: 1 }));
                                    }}
                                />

                                <Button size="small" icon={<SettingOutlined />} onClick={() => setColModalOpen(true)}>
                                    {isEn ? 'Columns' : 'Cột'}
                                </Button>

                                <Button size="small" onClick={exportExcel} loading={exporting}>
                                    {t.excel?.buttonText || (!isEn ? 'Xuất Excel' : 'Export Excel')}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            rowKey={(record) => record._id || record.usageCode}
                            columns={columns}
                            dataSource={tableData}
                            loading={loading}
                            locale={{ emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu' }}
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

            <style jsx global>{`
                .iky-group-row td {
                    background: #f8fafc !important;
                }
            `}</style>
        </div>
    );
};

export default UsageSessionReportPage;
