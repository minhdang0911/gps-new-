import React from 'react';
import { Segmented } from 'antd';

export default function ReportViewToggle({ value, onChange, locale }) {
    const isEn = locale === 'en';

    return (
        <Segmented
            size="small"
            value={value}
            onChange={onChange}
            options={[
                { label: isEn ? 'Table' : 'Bảng', value: 'table' },
                { label: isEn ? 'Report' : 'Báo cáo', value: 'report' },
            ]}
        />
    );
}
