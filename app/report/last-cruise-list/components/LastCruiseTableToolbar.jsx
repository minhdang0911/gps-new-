// app/report/last-cruise-list/components/LastCruiseTableToolbar.jsx
'use client';

import React from 'react';
import { Space, Button } from 'antd';
import { DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import ReportViewToggle from '../../../components/chart/ReportViewToggle';
import ReportSortSelect from '../../../components/report/ReportSortSelect';

export default function LastCruiseTableToolbar({
    viewMode,
    onViewModeChange,
    sortMode,
    onSortModeChange,
    selectedRowsCount,
    onOpenCompareModal,
    onClearSelection,
    onOpenColumnModal,
    onExportExcel,
    isEnglish,
}) {
    return (
        <Space wrap size={12}>
            <ReportViewToggle
                value={viewMode}
                onChange={onViewModeChange}
                locale={isEnglish ? 'en' : 'vi'}
            />

            <ReportSortSelect
                locale={isEnglish ? 'en' : 'vi'}
                value={sortMode}
                onChange={onSortModeChange}
                disabled={viewMode !== 'table'}
            />

            <Button
                size="small"
                disabled={viewMode !== 'table' || selectedRowsCount < 2}
                onClick={onOpenCompareModal}
            >
                {isEnglish ? `Compare (${selectedRowsCount})` : `So sánh (${selectedRowsCount})`}
            </Button>

            {selectedRowsCount > 0 && viewMode === 'table' && (
                <Button size="small" onClick={onClearSelection}>
                    {isEnglish ? 'Clear selection' : 'Bỏ chọn'}
                </Button>
            )}

            <Button
                size="small"
                icon={<SettingOutlined />}
                onClick={onOpenColumnModal}
                disabled={viewMode !== 'table'}
            >
                {isEnglish ? 'Columns' : 'Cột'}
            </Button>

            <Button size="small" icon={<DownloadOutlined />} onClick={onExportExcel}>
                {isEnglish ? 'Export Excel' : 'Xuất Excel'}
            </Button>
        </Space>
    );
}
