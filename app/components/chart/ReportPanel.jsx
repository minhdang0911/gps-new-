import React from 'react';
import { Card, Space } from 'antd';
import ReportKpiGrid from './ReportKpiGrid';
import ReportChart from './ReportChart';

export default function ReportPanel({ title, kpis = [], charts = [] }) {
    return (
        <Card size="small" title={title}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {kpis?.length ? <ReportKpiGrid items={kpis} /> : null}
                {(charts || []).map((cfg, idx) => (
                    <ReportChart key={cfg.key || idx} {...cfg} />
                ))}
            </Space>
        </Card>
    );
}
