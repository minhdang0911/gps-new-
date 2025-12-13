// app/report/trip-session/page.jsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
    message,
    Tooltip,
    Grid,
} from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';

import { getTripSessions } from '../../lib/api/tripSession';
import '../usage-session/usageSession.css';

import { usePathname } from 'next/navigation';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import * as XLSX from 'xlsx';

// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const locales = { vi, en };

const TripSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    // ✅ pageSize=10 cố định, phân trang theo total
    const PAGE_SIZE = 10;

    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: PAGE_SIZE,
        total: 0,
    });

    // ✅ 2 maps
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [plateToImeis, setPlateToImeis] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    // ===== LANG DETECT =====
    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath]);

    const t = isEn ? locales.en.tripSessionReport : locales.vi.tripSessionReport;

    const getAuthToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    };

    const normalize = (s) =>
        String(s || '')
            .trim()
            .toLowerCase();

    // ===== FORMAT DATETIME =====
    const formatDateTime = (value) => {
        if (!value) return '--';
        const d = new Date(value);
        return d.toLocaleString(isEn ? 'en-US' : 'vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    const formatDuration = (start, end) => {
        if (!start || !end) return '--';
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || e < s) return '--';

        const diff = Math.floor((e - s) / 1000);
        const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
        const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const ss = String(diff % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    };

    // ✅ load device maps 1 lần
    useEffect(() => {
        const loadMaps = async () => {
            try {
                setLoadingDeviceMap(true);
                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    setPlateToImeis(new Map());
                    return;
                }

                const { imeiToPlate, plateToImeis } = await buildImeiToLicensePlateMap(token);
                setImeiToPlate(imeiToPlate);
                setPlateToImeis(plateToImeis);
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
                setPlateToImeis(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMaps();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== API PARAMS =====
    const buildParams = (values, page, limit) => {
        const params = { page, limit };

        if (values.sessionId) params.sessionId = values.sessionId.trim();
        if (values.tripCode) params.tripCode = values.tripCode.trim();

        if (values.deviceId) params.deviceId = values.deviceId.trim();

        // ✅ ưu tiên search theo biển số: biển số -> imei -> query backend
        if (values.license_plate) {
            const key = normalize(values.license_plate);
            const imeis = plateToImeis.get(key) || [];
            params.imei = imeis[0] || '__NO_MATCH__';
        } else if (values.imei) {
            params.imei = values.imei.trim();
        }

        if (values.soh) params.soh = values.soh;

        if (values.timeRange && values.timeRange.length === 2) {
            params.startTime = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
            params.endTime = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
        }

        return params;
    };

    const fetchData = async (page = 1) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();
            const params = buildParams(values, page, PAGE_SIZE);

            const res = await getTripSessions(params);

            const list = res.data || [];
            const enriched = attachLicensePlate(list, imeiToPlate);

            setData(enriched);

            // ✅ giữ pageSize=10, total dùng từ backend để phân trang
            setPagination({
                current: res.page || page,
                pageSize: PAGE_SIZE,
                total: res.total || 0,
            });
        } catch (err) {
            console.error('Lỗi lấy trip session: ', err);
            message.error(isEn ? 'Failed to load data' : 'Không tải được dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate, plateToImeis]);

    const onFinish = () => {
        fetchData(1);
    };

    const onReset = () => {
        form.resetFields();
        fetchData(1);
    };

    const handleTableChange = (pager) => {
        // ✅ chỉ đổi trang, pageSize vẫn 10
        fetchData(pager.current);
    };

    // ===== EXPORT EXCEL (trang hiện tại) =====
    const handleExportExcel = () => {
        if (!data || data.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = data.map((item, index) => ({
            [t.table.index]: (pagination.current - 1) * pagination.pageSize + index + 1,
            [t.table.tripCode]: item.tripCode || '',

            [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
            [t.table.imei]: item.imei || '',
            [t.table.batteryId]: item.batteryId || '',
            [t.table.soh]: item.soh ?? '',

            [isEn ? 'Start time' : 'Thời gian bắt đầu']: formatDateTime(item.startTime),
            [isEn ? 'End time' : 'Thời gian kết thúc']: formatDateTime(item.endTime),
            [isEn ? 'Duration' : 'Thời lượng']: formatDuration(item.startTime, item.endTime),

            [t.table.distanceKm]: item.distanceKm ?? '',
            [t.table.consumedKw]: item.consumedKw ?? '',
            [t.table.socEnd]: item.socEnd ?? '',
            [t.table.endLat]: item.endLat ?? '',
            [t.table.endLng]: item.endLng ?? '',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'TripSession');

        const fileName = isEn
            ? `trip-session-report-${Date.now()}.xlsx`
            : `bao-cao-phien-hanh-trinh-${Date.now()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    const { useBreakpoint } = Grid;
    const screens = useBreakpoint();
    const isMobile = !screens.lg;

    // ✅ Tooltip giải thích từng cột (viết dễ hiểu cho người dùng)
    const colHelp = {
        index: {
            vi: 'Số thứ tự của dòng trong bảng.',
            en: 'Order number of the row.',
        },

        tripCode: {
            vi: 'Mã của chuyến đi (mỗi chuyến sẽ có một mã riêng).',
            en: 'Trip ID (each trip has its own code).',
        },

        imei: {
            vi: 'Mã thiết bị gắn trên xe. Hệ thống dùng mã này để xác định xe/biển số.',
            en: 'Device code installed on the vehicle (used to identify the vehicle/license plate).',
        },

        license_plate: {
            vi: 'Biển số xe. Có thể trống nếu hệ thống chưa liên kết được biển số với thiết bị.',
            en: 'License plate. May be empty if not linked yet.',
        },

        batteryId: {
            vi: 'Mã pin đang được sử dụng trong chuyến đi này.',
            en: 'Battery ID used in this trip.',
        },

        soh: {
            vi: 'Sức khỏe pin (%). Số càng cao thì pin càng “khỏe”.',
            en: 'Battery health (%). Higher means better battery condition.',
        },

        startTime: {
            vi: 'Thời điểm bắt đầu chuyến đi.',
            en: 'Trip start time.',
        },

        endTime: {
            vi: 'Thời điểm kết thúc chuyến đi.',
            en: 'Trip end time.',
        },

        duration: {
            vi: 'Tổng thời gian của chuyến đi (tính từ bắt đầu đến kết thúc).',
            en: 'Total trip duration (from start to end).',
        },

        distanceKm: {
            vi: 'Quãng đường di chuyển trong chuyến đi (km).',
            en: 'Distance traveled in the trip (km).',
        },

        consumedKw: {
            vi: 'Lượng điện tiêu thụ trong chuyến đi.',
            en: 'Energy consumed during the trip.',
        },

        socEnd: {
            vi: 'Phần trăm pin còn lại khi kết thúc chuyến đi.',
            en: 'Battery percentage remaining at the end of the trip.',
        },

        endLat: {
            vi: 'Vị trí kết thúc chuyến đi – vĩ độ (tọa độ trên bản đồ).',
            en: 'Trip end location latitude (map coordinate).',
        },

        endLng: {
            vi: 'Vị trí kết thúc chuyến đi – kinh độ (tọa độ trên bản đồ).',
            en: 'Trip end location longitude (map coordinate).',
        },
    };

    // ✅ Title “Label ?”
    const ColTitle = ({ label, tip }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{label}</span>

            <Tooltip
                title={tip}
                placement="top"
                trigger={isMobile ? ['click'] : ['hover']}
                classNames={{ root: 'table-col-tooltip' }}
                styles={{ root: { maxWidth: 260 }, container: { maxWidth: 260 } }}
                mouseEnterDelay={0.1}
                mouseLeaveDelay={0.1}
            >
                <span
                    className="table-col-help"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 16,
                        height: 16,
                        cursor: 'help',
                        pointerEvents: 'auto',
                    }}
                >
                    <QuestionCircleOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                </span>
            </Tooltip>
        </span>
    );

    const columns = [
        {
            title: <ColTitle label={t.table.index} tip={isEn ? colHelp.index.en : colHelp.index.vi} />,
            dataIndex: 'index',
            width: 60,
            render: (_, __, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: <ColTitle label={t.table.tripCode} tip={isEn ? colHelp.tripCode.en : colHelp.tripCode.vi} />,
            dataIndex: 'tripCode',
            ellipsis: true,
            width: 260,
        },
        {
            title: <ColTitle label={t.table.imei} tip={isEn ? colHelp.imei.en : colHelp.imei.vi} />,
            dataIndex: 'imei',
            ellipsis: true,
            width: 180,
        },
        {
            title: (
                <ColTitle
                    label={isEn ? 'License plate' : 'Biển số'}
                    tip={isEn ? colHelp.license_plate.en : colHelp.license_plate.vi}
                />
            ),
            dataIndex: 'license_plate',
            ellipsis: true,
            width: 140,
        },
        {
            title: <ColTitle label={t.table.batteryId} tip={isEn ? colHelp.batteryId.en : colHelp.batteryId.vi} />,
            dataIndex: 'batteryId',
            ellipsis: true,
            width: 150,
        },
        {
            title: <ColTitle label={t.table.soh} tip={isEn ? colHelp.soh.en : colHelp.soh.vi} />,
            dataIndex: 'soh',
            width: 80,
        },

        {
            title: (
                <ColTitle
                    label={isEn ? 'Start time' : 'Thời gian bắt đầu'}
                    tip={isEn ? colHelp.startTime.en : colHelp.startTime.vi}
                />
            ),
            dataIndex: 'startTime',
            ellipsis: true,
            width: 190,
            render: (value) => formatDateTime(value),
        },
        {
            title: (
                <ColTitle
                    label={isEn ? 'End time' : 'Thời gian kết thúc'}
                    tip={isEn ? colHelp.endTime.en : colHelp.endTime.vi}
                />
            ),
            dataIndex: 'endTime',
            ellipsis: true,
            width: 190,
            render: (value) => formatDateTime(value),
        },
        {
            title: (
                <ColTitle
                    label={isEn ? 'Duration' : 'Thời lượng'}
                    tip={isEn ? colHelp.duration.en : colHelp.duration.vi}
                />
            ),
            key: 'duration',
            width: 110,
            render: (_, record) => formatDuration(record.startTime, record.endTime),
        },

        {
            title: <ColTitle label={t.table.distanceKm} tip={isEn ? colHelp.distanceKm.en : colHelp.distanceKm.vi} />,
            dataIndex: 'distanceKm',
            width: 160,
        },
        {
            title: <ColTitle label={t.table.consumedKw} tip={isEn ? colHelp.consumedKw.en : colHelp.consumedKw.vi} />,
            dataIndex: 'consumedKw',
            width: 202,
        },
        {
            title: <ColTitle label={t.table.socEnd} tip={isEn ? colHelp.socEnd.en : colHelp.socEnd.vi} />,
            dataIndex: 'socEnd',
            width: 120,
        },
        {
            title: <ColTitle label={t.table.endLat} tip={isEn ? colHelp.endLat.en : colHelp.endLat.vi} />,
            dataIndex: 'endLat',
            width: 150,
        },
        {
            title: <ColTitle label={t.table.endLng} tip={isEn ? colHelp.endLng.en : colHelp.endLng.vi} />,
            dataIndex: 'endLng',
            width: 150,
        },
    ];

    const customLocale = {
        emptyText: isEn ? 'No data' : 'Không tìm thấy dữ liệu ',
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

                            {/* Optional status line */}
                            {/* <Text type="secondary" style={{ fontSize: 12 }}>
                {loadingDeviceMap ? (isEn ? 'Loading devices…' : 'Đang tải danh sách xe…') : isEn ? 'Devices loaded' : 'Đã tải danh sách xe'}
              </Text> */}
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
                            <Space size={12}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(pagination.total))}
                                </Text>
                                <Button icon={<DownloadOutlined />} size="small" onClick={handleExportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            locale={customLocale}
                            rowKey={(record) => record._id || record.sessionId || record.tripCode}
                            columns={columns}
                            dataSource={data}
                            loading={loading}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize, // =10
                                total: pagination.total, // ✅ dùng total để phân trang
                                showSizeChanger: false, // ✅ khóa vì pageSize=10 “chuẩn”
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 1100 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default TripSessionReportPage;
