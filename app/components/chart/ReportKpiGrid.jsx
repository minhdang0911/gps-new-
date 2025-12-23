import React from 'react';
import { Card, Col, Row, Statistic } from 'antd';

export default function ReportKpiGrid({ items = [], gutter = [12, 12] }) {
    return (
        <Row gutter={gutter}>
            {items.map((it) => {
                const key = it.key || it.title;
                const xs = it.xs ?? 12;
                const md = it.md ?? 6;
                const lg = it.lg ?? 6;

                const value = typeof it.value === 'function' ? it.value() : it.value;
                const displayValue = it.format ? it.format(value) : value;

                return (
                    <Col key={key} xs={xs} md={md} lg={lg}>
                        <Card size="small">
                            <Statistic
                                title={it.title}
                                value={displayValue ?? 0}
                                prefix={it.prefix}
                                suffix={it.suffix}
                            />
                            {it.extra ? (
                                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>{it.extra}</div>
                            ) : null}
                        </Card>
                    </Col>
                );
            })}
        </Row>
    );
}
