'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';

import dayjs from 'dayjs';
import { getTripSessions } from '../../lib/api/tripSession';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// ✅ helper (existing)
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

// ✅ reusable (existing)
import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';
import ReportSortSelect from '../../components/report/ReportSortSelect';

// ✅ extracted (new)
import { useLangFromPath } from '../../features/usageSessionReport/locale';
import { LOCKED_KEYS, STORAGE_KEY } from '../../features/tripSessionReport/constants';
import { buildAllColsMeta } from '../../features/tripSessionReport/columns/buildAllColsMeta';
import { applySortTrip } from '../../features/tripSessionReport/utils';
import { useTripDeviceMap } from '../../features/tripSessionReport/hooks/useTripDeviceMap';
import { useTripSessionData } from '../../features/tripSessionReport/hooks/useTripSessionData';
import { useTripSessionExcel } from '../../features/tripSessionReport/hooks/useTripSessionExcel';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const TripSessionReportPage = () => {
    const [form] = Form.useForm();

    const pathname = usePathname() || '/';
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    const { isEn } = useLangFromPath(pathname);
    const t = isEn ? locales.en.tripSessionReport : locales.vi.tripSessionReport;

    // ✅ device maps
    const { imeiToPlate, plateToImeis, loadingDeviceMap } = useTripDeviceMap({
        buildImeiToLicensePlateMap,
    });

    // ✅ data
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

    // ✅ FE sort + paginate
    const processedData = useMemo(() => applySortTrip(serverData, sortMode), [serverData, sortMode]);

    const pagedData = useMemo(() => {
        const { current, pageSize } = pagination;
        const start = (current - 1) * pageSize;
        const end = start + pageSize;
        return (processedData || []).slice(start, end);
    }, [processedData, pagination]);

    // keep total synced (while still respecting BE total if bigger)
    useEffect(() => {
        setPagination((p) => ({ ...p, total: Math.max(p.total || 0, processedData.length) }));
    }, [processedData.length, setPagination]);

    const onFinish = () => {
        setPagination((p) => ({ ...p, current: 1 }));
        fetchBase({ resetPage: true });
    };

    const onReset = () => {
        form.resetFields();
        setSortMode('none');
        setPagination((p) => ({ ...p, current: 1 }));
        fetchBase({ resetPage: true });
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

    const allColsMeta = useMemo(() => {
        return buildAllColsMeta({ t, isEn, isMobile });
    }, [t, isEn, isMobile]);

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

    const tableData = useMemo(() => {
        return (pagedData || []).map((row, idx) => ({
            ...row,
            __rowNo: (pagination.current - 1) * pagination.pageSize + idx + 1,
        }));
    }, [pagedData, pagination.current, pagination.pageSize]);

    // ✅ excel (export current page like old code)
    const { exportExcel } = useTripSessionExcel({ isEn, t });
    const onExport = () => exportExcel({ pagedData, pagination });

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

                {/* TABLE */}
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

                                <Button icon={<SettingOutlined />} size="small" onClick={() => setColModalOpen(true)}>
                                    {isEn ? 'Columns' : 'Cột'}
                                </Button>

                                <Button icon={<DownloadOutlined />} size="small" onClick={onExport}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            locale={{ emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu' }}
                            rowKey={(r) =>
                                r._id || r.sessionId || r.tripCode || `${r.tripCode}-${dayjs(r.startTime).valueOf()}`
                            }
                            columns={columns}
                            dataSource={tableData}
                            loading={loading}
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

export default TripSessionReportPage;
