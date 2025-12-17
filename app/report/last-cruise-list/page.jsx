'use client';

import React, { useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, Grid } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import '../usage-session/usageSession.css';

import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

import ColumnManagerModal from '../../components/report/ColumnManagerModal';
import { useReportColumns } from '../../hooks/useReportColumns';
import ReportSortSelect from '../../components/report/ReportSortSelect';

import { LOCKED_KEYS, STORAGE_KEY } from '../../features/lastCruiseReport/constants';
import { useLangFromPath } from '../../features/lastCruiseReport/locale/useLangFromPath';
import { buildAllColsMeta } from '../../features/lastCruiseReport/columns/buildAllColsMeta';
import { useLastCruiseDeviceMap } from '../../features/lastCruiseReport/hooks/useLastCruiseDeviceMap';
import { useLastCruiseData } from '../../features/lastCruiseReport/hooks/useLastCruiseData';
import { useLastCruiseExcel } from '../../features/lastCruiseReport/hooks/useLastCruiseExcel';

import { getLastCruiseList } from '../../lib/api/report';
import { buildImeiToLicensePlateMap } from '../../util/deviceMap';

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

    const [colModalOpen, setColModalOpen] = useState(false);

    // device map (dev ~= imei)
    const { imeiToPlate, loadingDeviceMap } = useLastCruiseDeviceMap({ buildImeiToLicensePlateMap });

    // data + FE filter/sort/paging
    const {
        loading,
        pagination,
        setPagination,

        filterValues,
        setFilterValues,

        sortMode,
        setSortMode,

        totalRecords,
        tableData,
        processedData,

        onSearch,
        onReset,
        handleTableChange,
    } = useLastCruiseData({
        form,
        getLastCruiseList,
        imeiToPlate,
        isEn,
        t,
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

    const customLocale = { emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ' };

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
                                const values = form.getFieldsValue();
                                setFilterValues(values);
                                onSearch();
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
                                    <Button icon={<ReloadOutlined />} onClick={onReset} disabled={loading}>
                                        {t.filter.reset}
                                    </Button>
                                </Space>
                            </Form.Item>

                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {loadingDeviceMap
                                    ? isEn
                                        ? 'Loading devices…'
                                        : 'Đang tải danh sách xe…'
                                    : isEn
                                    ? 'Devices loaded'
                                    : 'Đã tải danh sách xe'}
                            </Text>
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
                            <Space wrap size={12}>
                                {/* <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(totalRecords))}
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

                                <Button size="small" icon={<DownloadOutlined />} onClick={exportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            rowKey={(record) => record._id || `${record.dev}-${record.createdAt || record.tim || ''}`}
                            columns={columns}
                            locale={customLocale}
                            dataSource={tableData}
                            loading={loading}
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
                    </Card>
                </Col>
            </Row>

            {/* Column modal */}
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
