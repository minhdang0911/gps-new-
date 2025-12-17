'use client';

import React from 'react';
import { Select } from 'antd';

export default function ReportSortSelect({
    value = 'none',
    onChange,
    size = 'small',
    style,
    locale = 'vi', // 'vi' | 'en'
    options, // optional override
}) {
    const defaultOptions = options || [
        { value: 'none', label: locale === 'en' ? 'Sort: Default' : 'Sắp xếp: Mặc định' },
        { value: 'newest', label: locale === 'en' ? 'Date: New → Old' : 'Ngày: Mới → Cũ' },
        { value: 'oldest', label: locale === 'en' ? 'Date: Old → New' : 'Ngày: Cũ → Mới' },
    ];

    return (
        <Select
            size={size}
            value={value}
            onChange={onChange}
            options={defaultOptions}
            style={{ width: 190, ...style }}
        />
    );
}
