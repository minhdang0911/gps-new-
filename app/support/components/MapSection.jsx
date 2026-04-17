'use client';

import React from 'react';
import { Row, Col, Card, Space, Segmented, Typography } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import Map4DView from './Map4DView';
import styles from '../SupportPage.module.css';

const { Text } = Typography;

export default function MapSection({ t, mapLocation, setMapLocation }) {
    return (
        <Row gutter={[20, 20]} className={styles.bottomRow}>
            <Col xs={24}>
                <Card
                    className={`${styles.supportCard} ${styles.mapCard}`}
                    title={
                        <Space>
                            <EnvironmentOutlined />
                            <span>{t.mapTitle}</span>
                        </Space>
                    }
                >
                    <div className={styles.mapSectionTop}>
                        <div className={styles.mapSwitch}>
                            <Segmented
                                size="middle"
                                value={mapLocation}
                                onChange={(val) => setMapLocation(val)}
                                options={[
                                    { label: t.mapHCM, value: 'hcm' },
                                    { label: t.mapHN, value: 'hanoi' },
                                ]}
                            />
                        </div>
                    </div>

                    <div className={styles.mapViewport}>
                        <Map4DView key={mapLocation} location={mapLocation} />
                    </div>

                    <Text type="secondary" className={styles.mapGuide}>
                        {t.mapGuide}
                    </Text>
                </Card>
            </Col>
        </Row>
    );
}
