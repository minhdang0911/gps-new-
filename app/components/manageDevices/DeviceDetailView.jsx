// =========================
// components/manageDevices/DeviceDetailView.jsx
// =========================
'use client';

import React, { useState } from 'react';
import { Space, Button, Typography, Row, Col, Card } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

const formatTime = (tim) => {
    if (!tim) return '';
    const timStr = String(tim);
    
    // Custom format: YYMMDDHHmmss (12 digits)
    if (/^\d{12}$/.test(timStr)) {
        const year = 2000 + parseInt(timStr.slice(0, 2), 10);
        const month = parseInt(timStr.slice(2, 4), 10) - 1;
        const day = parseInt(timStr.slice(4, 6), 10);
        const hour = parseInt(timStr.slice(6, 8), 10);
        const minute = parseInt(timStr.slice(8, 10), 10);
        const second = parseInt(timStr.slice(10, 12), 10);
        const d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime())) return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
    }
    
    // Custom format: YYYYMMDDHHmmss (14 digits)
    if (/^\d{14}$/.test(timStr)) {
        const year = parseInt(timStr.slice(0, 4), 10);
        const month = parseInt(timStr.slice(4, 6), 10) - 1;
        const day = parseInt(timStr.slice(6, 8), 10);
        const hour = parseInt(timStr.slice(8, 10), 10);
        const minute = parseInt(timStr.slice(10, 12), 10);
        const second = parseInt(timStr.slice(12, 14), 10);
        const d = new Date(year, month, day, hour, minute, second);
        if (!isNaN(d.getTime())) return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
    }

    const isNumStr = typeof tim === 'string' && /^\d+$/.test(tim);
    const parsedTim = isNumStr ? parseInt(tim, 10) : tim;
    // Multiplier for Unix timestamp in seconds (usually 10 digits)
    const finalTim = typeof parsedTim === 'number' && parsedTim < 1e11 ? parsedTim * 1000 : parsedTim;
    const d = new Date(finalTim);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
};

export default function DeviceDetailView({
    t,
    isEn,
    selectedDevice,
    cruiseInfo,
    batteryInfo,
    getEngineStatusText,
    getVehicleStatusText,
    mutateCruise,
    onBack,
}) {
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = async () => {
        if (!mutateCruise) return;
        setRefreshing(true);
        try {
            await mutateCruise();
        } finally {
            setRefreshing(false);
        }
    };
    return (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                    {t.back}
                </Button>
                <Button
                    icon={<ReloadOutlined />}
                    loading={refreshing}
                    onClick={handleRefresh}
                >
                    {isEn ? 'Refresh' : 'Làm mới'}
                </Button>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {cruiseInfo?.tim
                        ? (isEn ? 'Last update: ' : 'Cập nhật lúc: ') + formatTime(cruiseInfo.tim)
                        : ''}
                </Typography.Text>
                <Title level={4}>{t.detailTitle}</Title>
            </Space>

            <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                    <Card title={t.deviceInfo}>
                        <div style={{ lineHeight: 1.9 }}>
                            <div>
                                <b>{t.imei}:</b> {selectedDevice?.imei}
                            </div>
                            <div>
                                <b>{t.phone}:</b> {selectedDevice?.phone_number || '-'}
                            </div>
                            <div>
                                <b>{t.plate}:</b> {selectedDevice?.license_plate || '-'}
                            </div>
                            <div>
                                <b>{t.driver}:</b> {selectedDevice?.driver || '-'}
                            </div>
                            <div>
                                <b>{t.deviceType}:</b> {selectedDevice?.device_category_id?.name}
                            </div>
                            <div>
                                <b>{t.firmware}:</b> {cruiseInfo?.fwr || '-'}
                            </div>
                            <div>
                                <b>{t.battery}:</b> {batteryInfo?.soc ?? '--'}%
                            </div>
                            <div>
                                <b>{t.speed}:</b> {cruiseInfo?.spd ?? 0} km/h
                            </div>
                            <div>
                                <b>{isEn ? 'Engine status' : 'Trạng thái máy'}:</b> {getEngineStatusText(cruiseInfo)}
                            </div>
                            <div>
                                <b>{isEn ? 'Vehicle status' : 'Trạng thái xe'}:</b> {getVehicleStatusText(cruiseInfo)}
                            </div>
                            <div>
                                <b>{t.position}:</b> {cruiseInfo?.lat}, {cruiseInfo?.lon}
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card title={t.ownerInfo}>
                        <div style={{ lineHeight: 1.9 }}>
                            <div>
                                <b>{t.customer}:</b>{' '}
                                {selectedDevice?.user_id ? selectedDevice.user_id.email : t.notAssigned}
                            </div>
                            <div>
                                <b>{t.distributor}:</b>{' '}
                                {selectedDevice?.distributor_id ? selectedDevice.distributor_id.username : '-'}
                            </div>
                        </div>
                    </Card>

                    <Card style={{ marginTop: 16 }} title={t.mapTitle}>
                        <div id="iky-device-map" style={{ height: 260 }} />
                    </Card>
                </Col>
            </Row>
        </Space>
    );
}
