'use client';

import React, { useMemo, useState } from 'react';
import { DatePicker, Form, Select, Space } from 'antd';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

const { RangePicker } = DatePicker;

/* =========================
   BUILD PRESET RANGE
========================= */
export const buildPresetRange = (key) => {
    const now = dayjs();

    switch (key) {
        case 'today':
            return [now.startOf('day'), now.endOf('day')];

        case 'yesterday': {
            const prev = now.subtract(1, 'day');
            return [prev.startOf('day'), prev.endOf('day')];
        }

        case 'thisWeek':
            return [now.startOf('isoWeek'), now.endOf('isoWeek')];

        case 'lastWeek': {
            const prev = now.subtract(1, 'week');
            return [prev.startOf('isoWeek'), prev.endOf('isoWeek')];
        }

        case 'thisMonth':
            return [now.startOf('month'), now.endOf('month')];

        case 'lastMonth': {
            const prev = now.subtract(1, 'month');
            return [prev.startOf('month'), prev.endOf('month')];
        }

        case 'last3Months':
            return [now.subtract(3, 'month').startOf('day'), now.endOf('day')];

        case 'last6Months':
            return [now.subtract(6, 'month').startOf('day'), now.endOf('day')];

        case 'thisQuarter':
            return [now.startOf('quarter'), now.endOf('quarter')];

        case 'prevQuarter': {
            const prev = now.subtract(1, 'quarter');
            return [prev.startOf('quarter'), prev.endOf('quarter')];
        }

        case 'thisYear':
            return [now.startOf('year'), now.endOf('year')];

        case 'lastYear': {
            const prev = now.subtract(1, 'year');
            return [prev.startOf('year'), prev.endOf('year')];
        }

        default:
            return null;
    }
};

/* =========================
   COMPONENT
========================= */
export default function TimeRangePresetPicker({
    name = 'timeRange',
    locale = 'vi',
    format = 'YYYY-MM-DD HH:mm:ss',
    showTime = true,
    defaultPreset = 'today',
    value,
    onChange,
}) {
    const form = Form.useFormInstance();
    const isEn = locale === 'en';

    const [presetKey, setPresetKey] = useState(defaultPreset);

    /* =========================
       OPTIONS
    ========================= */
    const options = useMemo(
        () => [
            { value: 'none', label: isEn ? 'Custom range' : 'Tùy chọn' },

            { value: 'today', label: isEn ? 'Today' : 'Hôm nay' },
            { value: 'yesterday', label: isEn ? 'Yesterday' : 'Hôm qua' },

            { value: 'thisWeek', label: isEn ? 'This week' : 'Tuần này' },
            { value: 'lastWeek', label: isEn ? 'Last week' : 'Tuần trước' },

            { value: 'thisMonth', label: isEn ? 'This month' : 'Tháng này' },
            { value: 'lastMonth', label: isEn ? 'Last month' : 'Tháng trước' },

            { value: 'last3Months', label: isEn ? 'Last 3 months' : '3 tháng qua' },
            { value: 'last6Months', label: isEn ? 'Last 6 months' : '6 tháng qua' },

            { value: 'thisQuarter', label: isEn ? 'This quarter' : 'Quý này' },
            { value: 'prevQuarter', label: isEn ? 'Prev quarter' : 'Quý trước' },

            { value: 'thisYear', label: isEn ? 'This year' : 'Năm nay' },
            { value: 'lastYear', label: isEn ? 'Last year' : 'Năm trước' },
        ],
        [isEn],
    );

    /* =========================
       APPLY PRESET
    ========================= */
    const applyPreset = (key) => {
        setPresetKey(key);

        if (key === 'none') return;

        const range = buildPresetRange(key);
        if (!range) return;

        form?.setFieldsValue({
            [name]: range,
        });

        onChange?.(range);
    };

    /* =========================
       RENDER
    ========================= */
    return (
        <Space orientation="vertical" style={{ width: '100%' }} size={8}>
            <Select value={presetKey} onChange={applyPreset} style={{ width: '100%' }} options={options} />

            <Form.Item name={name} noStyle>
                <RangePicker
                    showTime={showTime}
                    format={format}
                    style={{ width: '100%' }}
                    value={value}
                    onChange={(range) => {
                        onChange?.(range);
                        if (presetKey !== 'none') setPresetKey('none');
                    }}
                />
            </Form.Item>
        </Space>
    );
}
