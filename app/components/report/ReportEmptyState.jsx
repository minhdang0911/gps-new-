'use client';

import React from 'react';
import { FileSearchOutlined } from '@ant-design/icons';

/**
 * ReportEmptyState — hiển thị khi chưa search hoặc không có dữ liệu
 * @param {boolean} hasSearched - true nếu đã bấm Search ít nhất 1 lần
 * @param {boolean} isEn
 * @param {string} [searchedEmptyText] - text khi đã search nhưng không có data
 */
export default function ReportEmptyState({ hasSearched = false, isEn = false, searchedEmptyText }) {
    if (hasSearched) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 20px',
                color: '#94a3b8',
                gap: 10,
            }}>
                <FileSearchOutlined style={{ fontSize: 40, color: '#cbd5e1' }} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {searchedEmptyText || (isEn ? 'No data found' : 'Không tìm thấy dữ liệu')}
                </div>
                <div style={{ fontSize: 12 }}>
                    {isEn ? 'Try adjusting your filters.' : 'Thử thay đổi bộ lọc và tìm lại.'}
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 20px',
            color: '#94a3b8',
            gap: 12,
        }}>
            <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e0e7ff, #f0f9ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <FileSearchOutlined style={{ fontSize: 30, color: '#6366f1' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
                {isEn ? 'Start your search' : 'Bắt đầu tìm kiếm'}
            </div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 280 }}>
                {isEn
                    ? 'Select your filters and click Search to view report data.'
                    : 'Chọn bộ lọc phù hợp và bấm Tìm kiếm để xem dữ liệu báo cáo.'}
            </div>
        </div>
    );
}
