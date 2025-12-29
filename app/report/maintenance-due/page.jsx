'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Card, Empty, Spin, Table, Tag, Typography, message } from 'antd';

import MaintenanceReportFilters from '../components/MaintenanceReportFilters';
import { useMaintenanceDeviceMap } from '../../hooks/useMaintenanceDeviceMap';
import { getMaintenanceDue } from '../../lib/api/maintain';

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

export default function MaintenanceDueReportPage() {
    const { imeiToPlate } = useMaintenanceDeviceMap();

    const [filterImei, setFilterImei] = useState('');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = async (imei = filterImei) => {
        try {
            setLoading(true);
            const res = imei ? await getMaintenanceDue({ imei }) : await getMaintenanceDue({});
            setData(getArrayFromResponse(res));
        } catch (err) {
            console.error(err);
            message.error('Không tải được báo cáo sắp đến hạn');
        } finally {
            setLoading(false);
        }
    };

    // load lần đầu
    useEffect(() => {
        load('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const columns = [
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
            title: 'Km dự kiến',
            dataIndex: 'maintenanceKm',
            key: 'maintenanceKm',
            width: 120,
            render: (v) => (v === null || v === undefined ? '-' : `${v}`),
        },
        {
            title: 'Ngày dự kiến',
            dataIndex: 'maintenanceDate',
            key: 'maintenanceDate',
            width: 140,
            render: (v) => (v && dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD') : '-'),
        },
        { title: 'Ghi chú', dataIndex: 'note', key: 'note', ellipsis: true, render: (v) => v || '-' },
    ];

    return (
        <div style={{ padding: 16 }}>
            <Title level={3}>Báo cáo bảo trì sắp đến hạn</Title>
            <Text type="secondary">Tìm theo IMEI hoặc theo Biển số (map ra IMEI).</Text>

            <div style={{ marginTop: 12 }}>
                <MaintenanceReportFilters
                    onSearch={(imei) => {
                        setFilterImei(imei);
                        load(imei);
                    }}
                    onClear={() => {
                        setFilterImei('');
                        load('');
                    }}
                    onReload={(imei) => load(imei)}
                />
            </div>

            <Card style={{ marginTop: 12 }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin />
                    </div>
                ) : data.length === 0 ? (
                    <Empty description="Không có lịch sắp đến hạn" />
                ) : (
                    <Table
                        rowKey={(row) => row?._id || `${row?.maintenanceDate || ''}-${Math.random()}`}
                        columns={columns}
                        dataSource={data}
                        scroll={{ x: 980 }}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                    />
                )}
            </Card>
        </div>
    );
}
