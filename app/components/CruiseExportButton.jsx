'use client';

import React, { useMemo, useState } from 'react';
import { Tooltip } from 'antd';
import { exportCruiseRouteOnlyExcel } from '../util/cruiseReportExcel';

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
    maxExportRecords = 1000,
}) {
    const [exporting, setExporting] = useState(false);
    const label = useMemo(() => (isEn ? 'Export report' : 'Xuất báo cáo'), [isEn]);

    const onExport = () => {
        if (disabled || exporting) return;
        setExporting(true);

        // setTimeout để React kịp re-render loading trước khi hàm sync chạy
        setTimeout(() => {
            try {
                exportCruiseRouteOnlyExcel({
                    isEn,
                    device,
                    startText,
                    endText,
                    rawRouteData,
                    distanceMetersFn,
                    maxExportRecords,
                });
            } finally {
                setExporting(false);
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
            ? 'Export Excel (max 1000 points)'
            : 'Xuất Excel (tối đa 1000 điểm)';

    return (
        <Tooltip title={tooltipTitle}>
            <button
                type="button"
                className="iky-cruise__export-btn"
                onClick={onExport}
                disabled={disabled || exporting}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    width: '100%',
                }}
            >
                {exporting ? (
                    <>
                        <Spinner />
                        {isEn ? 'Exporting…' : 'Đang xuất…'}
                    </>
                ) : (
                    label
                )}
            </button>
        </Tooltip>
    );
}
