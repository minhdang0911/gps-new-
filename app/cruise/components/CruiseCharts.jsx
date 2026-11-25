'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from 'antd';
import { formatDateFromDevice } from '../../util/FormatDate';

const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip: ReTooltip, CartesianGrid } = {
    ResponsiveContainer: dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false, loading: () => <Skeleton active /> }),
    LineChart: dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false }),
    Line: dynamic(() => import('recharts').then((m) => m.Line), { ssr: false }),
    XAxis: dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false }),
    YAxis: dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false }),
    Tooltip: dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false }),
    CartesianGrid: dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false }),
};

export function CruiseSpeedChart({ rawRouteData, isEn, goToRawIndex }) {
    const speedSeries = useMemo(() => {
        if (!rawRouteData?.length) return [];
        const step = Math.max(1, Math.floor(rawRouteData.length / 300));
        const arr = [];
        for (let i = 0; i < rawRouteData.length; i += step) {
            const p = rawRouteData[i];
            arr.push({
                idx: i,
                time: formatDateFromDevice(p.dateTime),
                spd: typeof p.velocityNum === 'number' ? p.velocityNum : 0,
            });
        }
        return arr;
    }, [rawRouteData]);

    if (!speedSeries.length) {
        return <div className="iky-cruise__empty">{isEn ? 'No speed data' : 'Không có dữ liệu vận tốc'}</div>;
    }

    return (
        <div className="iky-cruise__chart">
            <ResponsiveContainer width="100%" height={210}>
                <LineChart data={speedSeries} onClick={(e) => {
                    const rawIdx = e?.activePayload?.[0]?.payload?.idx;
                    if (typeof rawIdx === 'number') goToRawIndex(rawIdx);
                }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis unit=" km/h" width={65} />
                    <ReTooltip formatter={(val) => [`${val} km/h`, isEn ? 'Speed' : 'Vận tốc']} />
                    <Line type="monotone" dataKey="spd" stroke="#2563eb" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export function CruiseAccChart({ rawRouteData, isEn, goToRawIndex }) {
    const accSeries = useMemo(() => {
        if (!rawRouteData?.length) return [];
        const step = Math.max(1, Math.floor(rawRouteData.length / 300));
        const arr = [];
        for (let i = 0; i < rawRouteData.length; i += step) {
            const p = rawRouteData[i];
            arr.push({
                idx: i,
                time: formatDateFromDevice(p.dateTime),
                acc: Number(p.acc) === 1 ? 0 : 1,
            });
        }
        return arr;
    }, [rawRouteData]);

    if (!accSeries.length) {
        return <div className="iky-cruise__empty">{isEn ? 'No engine data' : 'Không có dữ liệu động cơ'}</div>;
    }

    return (
        <div className="iky-cruise__chart">
            <ResponsiveContainer width="100%" height={210}>
                <LineChart data={accSeries} onClick={(e) => {
                    const rawIdx = e?.activePayload?.[0]?.payload?.idx;
                    if (typeof rawIdx === 'number') goToRawIndex(rawIdx);
                }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? (isEn ? 'ON' : 'MỞ') : (isEn ? 'OFF' : 'TẮT'))} width={55} />
                    <ReTooltip formatter={(val) => [val === 1 ? (isEn ? 'ON' : 'MỞ') : (isEn ? 'OFF' : 'TẮT'), isEn ? 'Engine' : 'Trạng thái máy']} />
                    <Line type="stepAfter" dataKey="acc" stroke="#16a34a" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
