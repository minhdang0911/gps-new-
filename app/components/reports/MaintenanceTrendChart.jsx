'use client';

import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { Card, Typography, Empty } from 'antd';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from 'recharts';

const { Title } = Typography;

export default function MaintenanceTrendChart({ data = [], isEn, filters }) {
    const chartData = useMemo(() => {
        if (!Array.isArray(data)) return [];

        let rows = [...data];

        if (filters?.maintenanceRange?.[0] && filters?.maintenanceRange?.[1]) {
            const d0 = dayjs(filters.maintenanceRange[0]).startOf('day').valueOf();
            const d1 = dayjs(filters.maintenanceRange[1]).endOf('day').valueOf();

            rows = rows.filter((r) => {
                const t = dayjs(r.maintenanceDate).valueOf();
                return t >= d0 && t <= d1;
            });
        }

        const map = {};

        rows.forEach((item) => {
            if (!item?.maintenanceDate) return;

            const date = dayjs(item.maintenanceDate).format('YYYY-MM-DD');

            if (!map[date]) map[date] = 0;

            map[date]++;
        });

        return Object.keys(map)
            .sort()
            .map((k) => ({
                date: k,
                label: dayjs(k).format('DD/MM'),
                count: map[k],
            }));
    }, [data, filters]);

    return (
        <Card
            style={{
                marginTop: 12,
                borderRadius: 8,
            }}
            bodyStyle={{ padding: 20 }}
        >
            <Title level={5} style={{ marginBottom: 20 }}>
                {isEn ? 'Maintenance trend by date' : 'Thống kê bảo trì theo ngày'}
            </Title>

            {chartData.length === 0 ? (
                <Empty description={isEn ? 'No maintenance data' : 'Không có dữ liệu bảo trì'} />
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                        data={chartData}
                        margin={{
                            top: 20,
                            right: 20,
                            left: -10,
                            bottom: 10,
                        }}
                    >
                        <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f0" />

                        <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />

                        <Tooltip
                            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                            formatter={(value) => [`${value} ${isEn ? 'maintenances' : 'lần bảo trì'}`]}
                            labelFormatter={(label) => `${isEn ? 'Date' : 'Ngày'}: ${label}`}
                        />

                        <Bar dataKey="count" fill="#1677ff" radius={[6, 6, 0, 0]} barSize={36}>
                            <LabelList
                                dataKey="count"
                                position="top"
                                style={{
                                    fontSize: 12,
                                    fill: '#555',
                                }}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
}
