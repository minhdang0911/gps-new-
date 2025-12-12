// app/report/last-cruise-list/page.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Row, Col, Table, DatePicker, Space, Typography, Select, message } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';

import { getLastCruiseList } from '../../lib/api/report';
import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

// ✅ helper
import { buildImeiToLicensePlateMap } from '../../util/deviceMap';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const locales = { vi, en };

const LastCruiseReportPage = () => {
    const [form] = Form.useForm();
    const [rawData, setRawData] = useState([]);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
    });

    // ✅ maps
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

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

    const rawLocale = isEn ? locales.en : locales.vi;
    const t = rawLocale.lastCruiseReport;

    const getAuthToken = () => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    };

    const normalize = (s) =>
        String(s || '')
            .trim()
            .toLowerCase();

    // ===== helpers =====
    const parseTimToDate = (tim) => {
        if (!tim || tim.length !== 12) return null;

        const yy = parseInt(tim.slice(0, 2), 10);
        const MM = parseInt(tim.slice(2, 4), 10) - 1;
        const dd = parseInt(tim.slice(4, 6), 10);
        const hh = parseInt(tim.slice(6, 8), 10);
        const mm = parseInt(tim.slice(8, 10), 10);
        const ss = parseInt(tim.slice(10, 12), 10);

        const year = 2000 + yy;
        return new Date(year, MM, dd, hh, mm, ss);
    };

    const formatDateTime = (value) => {
        if (!value) return '--';
        const d = value instanceof Date ? value : new Date(value);
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

    const formatGps = (gps) => {
        const lost = Number(gps) === 1;
        return lost ? t.table.gpsLost : t.table.gpsNormal;
    };

    const formatSos = (sos) => {
        const on = Number(sos) === 1;
        return on ? t.table.sosOn : t.table.sosOff;
    };

    const formatAcc = (acc) => {
        const isLocked = Number(acc) === 1;
        if (isEn) return isLocked ? 'Vehicle locked' : 'Vehicle unlocked';
        return isLocked ? 'Khóa xe tắt' : 'Khóa xe mở';
    };

    // ✅ attach biển số từ dev (coi dev là imei)
    const attachPlateToLastCruise = (list = [], map) => {
        if (!map) return list.map((x) => ({ ...x, license_plate: '' }));

        return list.map((item) => {
            const imei = String(item?.dev || '').trim();
            return {
                ...item,
                license_plate: map.get(imei) || '',
            };
        });
    };

    // ✅ load device map
    useEffect(() => {
        const loadMaps = async () => {
            try {
                setLoadingDeviceMap(true);
                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    return;
                }

                const { imeiToPlate } = await buildImeiToLicensePlateMap(token);
                setImeiToPlate(imeiToPlate);
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMaps();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ===== fetch API (1 lần) =====
    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await getLastCruiseList({});
            const list = res?.data || res || [];

            const enriched = attachPlateToLastCruise(list, imeiToPlate);

            setRawData(enriched);
            setData(enriched);
            setPagination((prev) => ({
                ...prev,
                current: 1,
            }));
        } catch (err) {
            console.error('Lỗi lấy last cruise list: ', err);
            message.error(isEn ? 'Failed to load last cruise list' : 'Không tải được danh sách vị trí cuối');
        } finally {
            setLoading(false);
        }
    };

    // ✅ refetch khi map sẵn sàng để attach biển số
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imeiToPlate]);

    // ===== filter ở FE =====
    const applyFilter = () => {
        const values = form.getFieldsValue();
        const { dev, license_plate, fwr, gpsStatus, sosStatus, timeRange } = values;

        let filtered = [...rawData];

        if (dev) {
            const key = normalize(dev);
            filtered = filtered.filter((item) => normalize(item.dev).includes(key));
        }

        // ✅ filter biển số
        if (license_plate) {
            const key = normalize(license_plate);
            filtered = filtered.filter((item) => normalize(item.license_plate).includes(key));
        }

        if (fwr) {
            const key = normalize(fwr);
            filtered = filtered.filter((item) => normalize(item.fwr).includes(key));
        }

        if (gpsStatus && gpsStatus !== 'all') {
            filtered = filtered.filter((item) => {
                const lost = Number(item.gps) === 1;
                if (gpsStatus === 'lost') return lost;
                if (gpsStatus === 'normal') return !lost;
                return true;
            });
        }

        if (sosStatus && sosStatus !== 'all') {
            filtered = filtered.filter((item) => {
                const on = Number(item.sos) === 1;
                if (sosStatus === 'on') return on;
                if (sosStatus === 'off') return !on;
                return true;
            });
        }

        if (timeRange && timeRange.length === 2) {
            const start = timeRange[0].startOf('day');
            const end = timeRange[1].endOf('day');

            filtered = filtered.filter((item) => {
                if (!item.createdAt) return false;
                const time = new Date(item.createdAt).getTime();
                return time >= start.valueOf() && time <= end.valueOf();
            });
        }

        setData(filtered);
        setPagination((prev) => ({
            ...prev,
            current: 1,
        }));
    };

    const onFinish = () => applyFilter();

    const onReset = () => {
        form.resetFields();
        setData(rawData);
        setPagination((prev) => ({
            ...prev,
            current: 1,
        }));
    };

    const handleTableChange = (pager) => {
        setPagination({
            current: pager.current,
            pageSize: pager.pageSize,
        });
    };

    // ===== Excel export =====
    const handleExportExcel = () => {
        if (!data || data.length === 0) {
            message.warning(isEn ? 'No data to export' : 'Không có dữ liệu để xuất');
            return;
        }

        const rows = data.map((item, index) => {
            const timDate = parseTimToDate(item.tim);
            return {
                [t.table.index]: index + 1,
                [t.table.dev]: item.dev,
                // ✅ thêm biển số vào excel
                [isEn ? 'License plate' : 'Biển số']: item.license_plate || '',
                [t.table.fwr]: item.fwr,
                [t.table.tim]: timDate ? formatDateTime(timDate) : item.tim || '--',
                [t.table.lat]: item.lat,
                [t.table.lon]: item.lon,
                [t.table.sat]: item.sat,
                [t.table.gps]: formatGps(item.gps),
                [t.table.sos]: formatSos(item.sos),
                [t.table.acc]: formatAcc(item.acc),
                [t.table.vgp]: item.vgp,
                [t.table.createdAt]: formatDateTime(item.createdAt),
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'LastCruise');

        XLSX.writeFile(workbook, t.excel.fileName);
        message.success(isEn ? 'Export Excel successfully' : 'Xuất Excel thành công');
    };

    // ===== columns =====
    const columns = [
        {
            title: t.table.index,
            dataIndex: 'index',
            width: 60,
            fixed: 'left',
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: t.table.dev,
            dataIndex: 'dev',
            width: 160,
            ellipsis: true,
        },
        // ✅ cột biển số
        {
            title: isEn ? 'License plate' : 'Biển số',
            dataIndex: 'license_plate',
            width: 140,
            ellipsis: true,
        },
        {
            title: t.table.fwr,
            dataIndex: 'fwr',
            width: 140,
            ellipsis: true,
        },
        {
            title: t.table.tim,
            dataIndex: 'tim',
            width: 180,
            render: (value) => {
                const d = parseTimToDate(value);
                if (!d) return value || '--';
                return formatDateTime(d);
            },
        },
        { title: t.table.lat, dataIndex: 'lat', width: 130 },
        { title: t.table.lon, dataIndex: 'lon', width: 130 },
        { title: t.table.sat, dataIndex: 'sat', width: 100 },
        { title: t.table.gps, dataIndex: 'gps', width: 140, render: (value) => formatGps(value) },
        { title: t.table.sos, dataIndex: 'sos', width: 140, render: (value) => formatSos(value) },
        { title: t.table.acc, dataIndex: 'acc', width: 120, render: (value) => formatAcc(value) },
        { title: t.table.vgp, dataIndex: 'vgp', width: 160 },
        { title: t.table.createdAt, dataIndex: 'createdAt', width: 180, render: formatDateTime },
    ];

    const totalRecords = data.length;
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
                            <Form.Item label={t.filter.dev} name="dev">
                                <Input placeholder={t.filter.devPlaceholder} allowClear />
                            </Form.Item>

                            {/* ✅ filter biển số */}
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
                            <Space>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t.table.total.replace('{total}', String(totalRecords))}
                                </Text>

                                <Button size="small" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                                    {isEn ? 'Export Excel' : 'Xuất Excel'}
                                </Button>
                            </Space>
                        }
                    >
                        <Table
                            rowKey={(record) => record._id || record.dev}
                            columns={columns}
                            locale={customLocale}
                            dataSource={data}
                            loading={loading}
                            pagination={{
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                total: totalRecords,
                                showSizeChanger: true,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total) => t.table.showTotal.replace('{total}', String(total)),
                            }}
                            onChange={handleTableChange}
                            scroll={{ x: 2350, y: 600 }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default LastCruiseReportPage;
