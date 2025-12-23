import React from 'react';
import { Card } from 'antd';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Bar,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';

function renderSeries(s) {
    const common = {
        key: s.key || `${s.type}:${s.dataKey}`,
        dataKey: s.dataKey,
        name: s.name,
        yAxisId: s.yAxisId || 'left',
    };

    if (s.type === 'bar') return <Bar {...common} />;
    if (s.type === 'area') return <Area {...common} type={s.curve || 'monotone'} dot={false} />;
    // default line
    return <Line {...common} type={s.curve || 'monotone'} dot={s.dot ?? false} />;
}

export default function ReportChart({
    title,
    height = 340,
    data = [],
    xKey = 'x',
    showGrid = true,
    showLegend = true,
    showTooltip = true,
    yAxes = [{ id: 'left' }, { id: 'right', orientation: 'right' }],
    series = [],
}) {
    return (
        <Card size="small" title={title}>
            <div style={{ width: '100%', height }}>
                <ResponsiveContainer>
                    <ComposedChart data={data}>
                        {showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
                        <XAxis dataKey={xKey} />
                        {(yAxes || []).map((y) => (
                            <YAxis
                                key={y.id}
                                yAxisId={y.id}
                                orientation={y.orientation}
                                tickFormatter={y.tickFormatter}
                                domain={y.domain}
                            />
                        ))}
                        {showTooltip ? <Tooltip /> : null}
                        {showLegend ? <Legend /> : null}
                        {(series || []).map((s) => renderSeries(s))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
