'use client';

import React, { useMemo, useState } from 'react';
import { Tooltip, Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';

import { exportCruiseRouteOnlyExcel } from '../util/cruiseReportExcel';
import { exportCruiseRouteOnlyPdf } from '../util/cruiseReportPdf';

const Spinner = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ animation: 'iky-spin 0.75s linear infinite', display: 'block' }}
    >
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <style>{`@keyframes iky-spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
);

export default function CruiseExportButton({
    isEn,
    disabled,
    rawRouteData,
    device,
    startText,
    endText,
    distanceMetersFn,
    maxExportRecords = 2000, // ✅ tối đa 2000
}) {
    const [exporting, setExporting] = useState(false);
    const [exportType, setExportType] = useState(null);

    const label = useMemo(() => (isEn ? 'Export report' : 'Xuất báo cáo'), [isEn]);

    const runExport = async (type) => {
        if (disabled || exporting) return;

        setExportType(type);
        setExporting(true);

        setTimeout(async () => {
            try {
                const payload = {
                    isEn,
                    device,
                    startText,
                    endText,
                    rawRouteData,
                    distanceMetersFn,
                    maxExportRecords,
                };

                if (type === 'excel') exportCruiseRouteOnlyExcel(payload);
                if (type === 'pdf') await exportCruiseRouteOnlyPdf(payload); // ✅ await
            } finally {
                setExporting(false);
                setExportType(null);
            }
        }, 50);
    };

    const tooltipTitle = disabled
        ? isEn
            ? 'Load route first'
            : 'Hãy tải lộ trình trước'
        : exporting
          ? isEn
              ? 'Exporting, please wait…'
              : 'Đang xuất, vui lòng chờ…'
          : isEn
            ? 'Export report (Excel / PDF, max 2000 points)'
            : 'Xuất báo cáo (Excel / PDF, tối đa 2000 điểm)';

    const items = [
        {
            key: 'excel',
            label: isEn ? 'Excel (.xlsx)' : 'Excel (.xlsx)',
            onClick: () => runExport('excel'),
            disabled: disabled || exporting,
        },
        {
            key: 'pdf',
            label: isEn ? 'PDF (.pdf)' : 'PDF (.pdf)',
            onClick: () => runExport('pdf'),
            disabled: disabled || exporting,
        },
    ];

    return (
        <Tooltip title={tooltipTitle}>
            <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight" disabled={disabled || exporting}>
                <button
                    type="button"
                    className="iky-cruise__export-btn"
                    disabled={disabled || exporting}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        width: '100%',
                        cursor: disabled || exporting ? 'not-allowed' : 'pointer',
                    }}
                >
                    {exporting ? (
                        <>
                            <Spinner />
                            {isEn ? 'Exporting…' : 'Đang xuất…'}
                            <span style={{ opacity: 0.9 }}>
                                {exportType === 'pdf' ? 'PDF' : exportType === 'excel' ? 'Excel' : ''}
                            </span>
                        </>
                    ) : (
                        <>
                            {label}
                            <DownOutlined style={{ fontSize: 12, opacity: 0.85 }} />
                        </>
                    )}
                </button>
            </Dropdown>
        </Tooltip>
    );
}
