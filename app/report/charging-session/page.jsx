// app/report/charging-session/page.jsx
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
import { getChargingSessions } from '../../lib/api/chargingSession';
import '../usage-session/usageSession.css';

import { usePathname } from 'next/navigation';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
// ✅ helper
import { buildImeiToLicensePlateMap, attachLicensePlate } from '../../util/deviceMap';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const locales = { vi, en };

const ChargingSessionReportPage = () => {
    const [form] = Form.useForm();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0,
    });

    // ✅ 2 maps
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [plateToImeis, setPlateToImeis] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    const screens = useBreakpoint();
    const isMobile = !screens.lg;

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

    const t = isEn ? locales.en.chargingSessionReport : locales.vi.chargingSessionReport;

    const getAuthToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    };

    const normalize = (s) =>
        String(s || '')
            .trim()
            .toLowerCase();

    const buildPayload = (values, page, limit) => {
        const payload = { page, limit };

        if (values.chargeCode) payload.chargeCode = values.chargeCode.trim();
        if (values.soh) payload.soh = values.soh;

        // ✅ biển số -> imei
        if (values.license_plate) {
            const key = normalize(values.license_plate);
            const imeis = plateToImeis.get(key) || [];
            payload.imei = imeis[0] || '__NO_MATCH__';
        }

        if (values.timeRange?.length === 2) {
            payload.start = values.timeRange[0].format('YYYY-MM-DD HH:mm:ss');
            payload.end = values.timeRange[1].format('YYYY-MM-DD HH:mm:ss');
        }

        return payload;
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

    const formatDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--');

    const fetchData = async (page = 1, pageSize = 10) => {
        try {
            setLoading(true);
            const values = form.getFieldsValue();
            const payload = buildPayload(values, page, pageSize);

            const res = await getChargingSessions(payload);
            const list = res.data || [];

            // ✅ attach biển số
            const enriched = attachLicensePlate(list, imeiToPlate);

            setData(enriched);
            setPagination({
                current: res.page || page,
                pageSize: pageSize,
                total: res.total || 0,
            });
        } catch (err) {
            console.error('Lỗi lấy charging session: ', err);
            message.error(isEn ? 'Failed to load charging sessions' : 'Không tải được danh sách phiên sạc');
        } finally {
            setLoading(false);
        }
    };

    // fetch lần đầu + khi maps sẵn sàng
    useEffect(() => {
        fetchData(1, pagination.pageSize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate, plateToImeis]);

    const onFinish = () => fetchData(1, pagination.pageSize);

    const onReset = () => {
        form.resetFields();
        fetchData(1, pagination.pageSize);
    };

    const handleTableChange = (pager) => {
        fetchData(pager.current, pager.pageSize);
    };

    const handleExportExcel = () => {
        if (!data || data.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = data.map((item, index) => ({
            [t.table.index]: (pagination.current - 1) * pagination.pageSize + index + 1,
            IMEI: item.imei || '',
            [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
            [t.table.chargeCode]: item.chargeCode || '',
            [t.table.soh]: item.soh ?? '',
            [t.table.socStart]: item.socStart ?? '',
            [t.table.socEnd]: item.socEnd ?? '',
            [t.table.tempMax]: item.tempMax ?? '',
            [t.table.tempMin]: item.tempMin ?? '',
            [t.table.tempAvg]: item.tempAvg ?? '',
            [t.table.voltageMax]: item.voltageMax ?? '',
            [t.table.voltageMin]: item.voltageMin ?? '',
            [t.table.voltageAvg]: item.voltageAvg ?? '',
            [t.table.chargeLat]: item.chargeLat ?? '',
            [t.table.chargeLng]: item.chargeLng ?? '',
            [t.table.startTime]: formatDateTime(item.start),
            [t.table.endTime]: formatDateTime(item.end),
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, 'ChargingSession');

        const fileName = isEn ? `charging-session-report-${Date.now()}.xlsx` : `bao-cao-sac-${Date.now()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // ✅ Tooltip giải thích từng cột
    const colHelp = {
        index: {
            vi: 'Số thứ tự của dòng trong bảng báo cáo.',
            en: 'Order number of the row in the report.',
        },

        imei: {
            vi: 'Mã thiết bị gắn trên xe. Hệ thống dùng mã này để xác định xe và biển số.',
            en: 'Device code installed on the vehicle. Used by the system to identify the vehicle and license plate.',
        },

        license_plate: {
            vi: 'Biển số xe tương ứng với thiết bị. Có thể trống nếu hệ thống chưa liên kết.',
            en: 'Vehicle license plate linked to the device. May be empty if not yet linked.',
        },

        chargeCode: {
            vi: 'Mã nhận diện của phiên sạc. Mỗi lần sạc pin sẽ có một mã riêng.',
            en: 'Charging session ID. Each charging session has its own unique code.',
        },

        socStart: {
            vi: 'Phần trăm pin còn lại tại thời điểm bắt đầu sạc.',
            en: 'Battery percentage at the start of charging.',
        },

        socEnd: {
            vi: 'Phần trăm pin tại thời điểm kết thúc sạc.',
            en: 'Battery percentage at the end of charging.',
        },

        soh: {
            vi: 'Tình trạng sức khỏe của pin. Giá trị càng cao thì pin càng tốt.',
            en: 'Battery health status. Higher value means better battery condition.',
        },

        tempMax: {
            vi: 'Nhiệt độ pin cao nhất ghi nhận trong suốt quá trình sạc.',
            en: 'Highest battery temperature recorded during charging.',
        },

        tempMin: {
            vi: 'Nhiệt độ pin thấp nhất ghi nhận trong quá trình sạc.',
            en: 'Lowest battery temperature recorded during charging.',
        },

        tempAvg: {
            vi: 'Nhiệt độ pin trung bình trong suốt phiên sạc.',
            en: 'Average battery temperature during the charging session.',
        },

        voltageMax: {
            vi: 'Mức điện áp cao nhất của pin trong quá trình sạc.',
            en: 'Highest voltage level during charging.',
        },

        voltageMin: {
            vi: 'Mức điện áp thấp nhất của pin trong quá trình sạc.',
            en: 'Lowest voltage level during charging.',
        },

        voltageAvg: {
            vi: 'Mức điện áp trung bình của pin trong phiên sạc.',
            en: 'Average voltage level during the charging session.',
        },

        chargeLat: {
            vi: 'Vị trí sạc – vĩ độ (tọa độ trên bản đồ).',
            en: 'Charging location latitude (map coordinate).',
        },

        chargeLng: {
            vi: 'Vị trí sạc – kinh độ (tọa độ trên bản đồ).',
            en: 'Charging location longitude (map coordinate).',
        },

        startTime: {
            vi: 'Thời điểm bắt đầu sạc pin.',
            en: 'Time when charging started.',
        },

        endTime: {
            vi: 'Thời điểm kết thúc sạc pin.',
            en: 'Time when charging ended.',
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
            fixed: 'left',
        },
        {
            title: <ColTitle label="IMEI" tip={isEn ? colHelp.imei?.en : colHelp.imei?.vi} />,
            dataIndex: 'imei',
            ellipsis: true,
            width: 150,
        },
        {
            title: (
                <ColTitle
                    label={isEn ? 'License plate' : 'Biển số'}
                    tip={isEn ? colHelp.license_plate?.en : colHelp.license_plate?.vi}
                />
            ),
            dataIndex: 'license_plate',
            ellipsis: true,
            width: 140,
        },
        {
            title: <ColTitle label={t.table.chargeCode} tip={isEn ? colHelp.chargeCode?.en : colHelp.chargeCode?.vi} />,
            dataIndex: 'chargeCode',
            ellipsis: true,
            width: 260,
        },
        {
            title: <ColTitle label={t.table.soh} tip={isEn ? colHelp.soh.en : colHelp.soh.vi} />,
            dataIndex: 'soh',
            width: 80,
        },
        {
            title: <ColTitle label={t.table.socStart} tip={isEn ? colHelp.socStart.en : colHelp.socStart.vi} />,
            dataIndex: 'socStart',
            width: 120,
        },
        {
            title: <ColTitle label={t.table.socEnd} tip={isEn ? colHelp.socEnd.en : colHelp.socEnd.vi} />,
            dataIndex: 'socEnd',
            width: 120,
        },

        {
            title: <ColTitle label={t.table.tempMax} tip={isEn ? colHelp.tempMax.en : colHelp.tempMax.vi} />,
            dataIndex: 'tempMax',
            width: 150,
        },
        {
            title: <ColTitle label={t.table.tempMin} tip={isEn ? colHelp.tempMin.en : colHelp.tempMin.vi} />,
            dataIndex: 'tempMin',
            width: 150,
        },
        {
            title: <ColTitle label={t.table.tempAvg} tip={isEn ? colHelp.tempAvg.en : colHelp.tempAvg.vi} />,
            dataIndex: 'tempAvg',
            width: 165,
        },

        {
            title: <ColTitle label={t.table.voltageMax} tip={isEn ? colHelp.voltageMax?.en : colHelp.voltageMax?.vi} />,
            dataIndex: 'voltageMax',
            width: 120,
        },
        {
            title: <ColTitle label={t.table.voltageMin} tip={isEn ? colHelp.voltageMin?.en : colHelp.voltageMin?.vi} />,
            dataIndex: 'voltageMin',
            width: 120,
        },
        {
            title: <ColTitle label={t.table.voltageAvg} tip={isEn ? colHelp.voltageAvg?.en : colHelp.voltageAvg?.vi} />,
            dataIndex: 'voltageAvg',
            width: 160,
        },

        {
            title: <ColTitle label={t.table.chargeLat} tip={isEn ? colHelp.chargeLat?.en : colHelp.chargeLat?.vi} />,
            dataIndex: 'chargeLat',
            width: 120,
        },
        {
            title: <ColTitle label={t.table.chargeLng} tip={isEn ? colHelp.chargeLng?.en : colHelp.chargeLng?.vi} />,
            dataIndex: 'chargeLng',
            width: 120,
        },

        {
            title: <ColTitle label={t.table.startTime} tip={isEn ? colHelp.startTime.en : colHelp.startTime.vi} />,
            dataIndex: 'startTime',
            ellipsis: true,
            render: (val) => formatDateTime(val),
            width: 170,
        },
        {
            title: <ColTitle label={t.table.endTime} tip={isEn ? colHelp.endTime.en : colHelp.endTime.vi} />,
            dataIndex: 'endTime',
            ellipsis: true,
            render: (val) => formatDateTime(val),
            width: 170,
        },
    ];

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
                            rowKey={(record) =>
                                record._id || record.sessionId || `${record.imei}-${record.start}-${record.end}`
                            }
                            columns={columns}
                            dataSource={data}
                            loading={loading}
                            locale={customLocale}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: pagination.total,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 1400 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ChargingSessionReportPage;
