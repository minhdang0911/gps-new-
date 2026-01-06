// =========================
// components/manageDevices/DeviceDetailView.jsx
// =========================
'use client';

import React from 'react';
import { Space, Button, Typography, Row, Col, Card } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title } = Typography;

export default function DeviceDetailView({
    t,
    isEn,
    selectedDevice,
    cruiseInfo,
    batteryInfo,
    getEngineStatusText,
    getVehicleStatusText,
    onBack,
}) {
    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space wrap>
                <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                    {t.back}
                </Button>
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
