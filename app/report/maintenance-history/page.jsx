'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Empty, Spin, Table, Typography, message } from 'antd';

import MaintenanceReportFilters from '../components/MaintenanceReportFilters';
import { useMaintenanceDeviceMap } from '../../hooks/useMaintenanceDeviceMap';
import { getMaintenanceHistory } from '../../lib/api/maintain';

// ✅ auth store
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

function getArrayFromResponse(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.history)) return res.history;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res?.result?.items)) return res.result.items;
    return [];
}

function extractItemsTotal(res) {
    const items = getArrayFromResponse(res);
    const total =
        Number(res?.total) ||
        Number(res?.pagination?.total) ||
        Number(res?.meta?.total) ||
        Number(res?.result?.total) ||
        items.length;
    return { items, total };
}

export default function MaintenanceHistoryReportPage() {
    const { imeiToPlate } = useMaintenanceDeviceMap();

    const [filterImei, setFilterImei] = useState('');
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    // ✅ role
    const user = useAuthStore((s) => s.user);
    const role = useMemo(() => {
        const r1 = user?.position || user?.role;
        if (r1) return String(r1).toLowerCase();
        if (typeof window !== 'undefined') {
            return String(localStorage.getItem('role') || '').toLowerCase();
        }
        return '';
    }, [user]);

    // ✅ distributor / customer => ẩn "Xác nhận bởi"
    const hideConfirmedByCol = role === 'distributor' || role === 'customer';

    const load = async ({ imei = filterImei, p = page } = {}) => {
        try {
            setLoading(true);
            const res = imei
                ? await getMaintenanceHistory({ imei, page: p, limit: PAGE_SIZE })
                : await getMaintenanceHistory({ page: p, limit: PAGE_SIZE });

            const { items, total } = extractItemsTotal(res);
            setData(items);
            setTotal(total);
        } catch (err) {
            console.error(err);
            message.error('Không tải được báo cáo lịch sử bảo trì');
        } finally {
            setLoading(false);
        }
    };

    // load lần đầu
    useEffect(() => {
        load({ imei: '', p: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const columns = useMemo(() => {
        const cols = [
            {
                title: 'Thời gian tạo',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 170,
                render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
            },
            {
                title: 'IMEI',
                key: 'imei',
                width: 180,
                render: (_, row) => row?.imei || row?.device?.imei || row?.device_id?.imei || '-',
            },
            {
                title: 'Biển số',
                key: 'license_plate',
                width: 150,
                render: (_, row) => {
                    const plate = row?.license_plate || row?.device?.license_plate || row?.device_id?.license_plate;
                    if (plate) return plate;

                    const rowImei = row?.imei || row?.device?.imei || row?.device_id?.imei;
                    return rowImei ? imeiToPlate.get(String(rowImei)) || '-' : '-';
                },
            },
            {
                title: 'Km bảo trì',
                dataIndex: 'maintenanceKm',
                key: 'maintenanceKm',
                width: 120,
                render: (v) => (v === null || v === undefined ? '-' : `${v}`),
            },
            {
                title: 'Ngày bảo trì',
                dataIndex: 'maintenanceDate',
                key: 'maintenanceDate',
                width: 130,
                render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : '-'),
            },

            // ✅ CỘT SẼ BỊ ẨN VỚI distributor / customer
            {
                title: 'Xác nhận bởi',
                dataIndex: 'confirmedBy',
                key: 'confirmedBy',
                width: 170,
                render: (v) => v || '-',
            },

            {
                title: 'Ghi chú',
                dataIndex: 'note',
                key: 'note',
                ellipsis: true,
                render: (v) => v || '-',
            },
        ];

        if (hideConfirmedByCol) {
            return cols.filter((c) => c.key !== 'confirmedBy');
        }

        return cols;
    }, [hideConfirmedByCol, imeiToPlate]);

    return (
        <div style={{ padding: 16 }}>
            <Title level={3}>Báo cáo lịch sử bảo trì</Title>
            <Text type="secondary">Tìm theo IMEI hoặc theo Biển số (map ra IMEI).</Text>

            <div style={{ marginTop: 12 }}>
                <MaintenanceReportFilters
                    onSearch={(imei) => {
                        setFilterImei(imei);
                        setPage(1);
                        load({ imei, p: 1 });
                    }}
                    onClear={() => {
                        setFilterImei('');
                        setPage(1);
                        load({ imei: '', p: 1 });
                    }}
                    onReload={(imei) => load({ imei, p: page })}
                />
            </div>

            <Card style={{ marginTop: 12 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                    </div>
                ) : data.length === 0 ? (
                    <Empty description="Chưa có lịch sử bảo trì" />
                ) : (
                    <Table
                        rowKey={(row) => row?._id || `${row?.createdAt || ''}-${Math.random()}`}
                        columns={columns}
                        dataSource={data}
                        scroll={{ x: 980 }}
                        pagination={{
                            current: page,
                            pageSize: PAGE_SIZE,
                            total,
                            showSizeChanger: false,
                            onChange: async (p) => {
                                setPage(p);
                                await load({ imei: filterImei, p });
                            },
                        }}
                    />
                )}
            </Card>
        </div>
    );
}
