'use client';

import React from 'react';
import { FloatButton } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

export default function TourHelpButton({ isEn, onClick }) {
    return <FloatButton icon={<QuestionCircleOutlined />} tooltip={isEn ? 'Guide' : 'Hướng dẫn'} onClick={onClick} />;
}
