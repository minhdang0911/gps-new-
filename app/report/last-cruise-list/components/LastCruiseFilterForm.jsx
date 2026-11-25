// app/report/last-cruise-list/components/LastCruiseFilterForm.jsx
'use client';

import React from 'react';
import { Card, Form, Input, Button, Space, Select } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import TimeRangePresetPicker from '../../../components/common/TimeRangePresetPicker';

const { Option } = Select;

export default function LastCruiseFilterForm({
    form,
    translation,
    isEnglish,
    isLoading,
    timePresetResetKey,
    onFilterSubmit,
    onFilterReset,
}) {
    return (
        <Card className="usage-filter-card" title={translation.filter.title} size="small">
            <Form form={form} layout="vertical" onFinish={onFilterSubmit}>
                <Form.Item label={translation.filter.dev} name="dev">
                    <Input placeholder={translation.filter.devPlaceholder} allowClear />
                </Form.Item>

                <Form.Item label={isEnglish ? 'License plate' : 'Biển số'} name="license_plate">
                    <Input placeholder={isEnglish ? 'Enter license plate' : 'Nhập biển số xe'} allowClear />
                </Form.Item>

                <Form.Item label={translation.filter.fwr} name="fwr">
                    <Input placeholder={translation.filter.fwrPlaceholder} allowClear />
                </Form.Item>

                <Form.Item label={translation.filter.gps} name="gpsStatus" initialValue="all">
                    <Select>
                        <Option value="all">{translation.filter.gpsAll}</Option>
                        <Option value="normal">{translation.filter.gpsNormal}</Option>
                        <Option value="lost">{translation.filter.gpsLost}</Option>
                    </Select>
                </Form.Item>

                <Form.Item label={translation.filter.sos} name="sosStatus" initialValue="all">
                    <Select>
                        <Option value="all">{translation.filter.sosAll}</Option>
                        <Option value="on">{translation.filter.sosOn}</Option>
                        <Option value="off">{translation.filter.sosOff}</Option>
                    </Select>
                </Form.Item>

                <Form.Item label={translation.filter.timeRange}>
                    <TimeRangePresetPicker
                        key={timePresetResetKey}
                        name="timeRange"
                        locale={isEnglish ? 'en' : 'vi'}
                        format="YYYY-MM-DD"
                        showTime={false}
                    />
                </Form.Item>

                <Form.Item>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            icon={<SearchOutlined />}
                            loading={isLoading}
                        >
                            {translation.filter.search}
                        </Button>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={onFilterReset}
                            disabled={isLoading}
                        >
                            {translation.filter.reset}
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Card>
    );
}
