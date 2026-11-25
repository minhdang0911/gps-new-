// app/report/last-cruise-list/components/LastCruiseTableView.jsx
'use client';

import React from 'react';
import { Table } from 'antd';

export default function LastCruiseTableView({
    tableColumns,
    tableDataWithAddress,
    customLocale,
    isLoading,
    rowSelection,
    pagination,
    totalRecords,
    totalCountTemplate,
    onTableChange,
    onClearSelection,
}) {
    return (
        <Table
            rowKey={(record) => record._id || `${record.dev}-${record.createdAt || record.tim || ''}`}
            columns={tableColumns}
            locale={customLocale}
            dataSource={tableDataWithAddress}
            loading={isLoading}
            rowSelection={rowSelection}
            pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: totalRecords,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100', '200'],
                showQuickJumper: true,
                showTotal: (total) => (totalCountTemplate || '{total}').replace('{total}', String(total)),
            }}
            onChange={(...args) => {
                onTableChange(...args);
                onClearSelection();
            }}
            scroll={{ x: 2470, y: 600 }}
        />
    );
}
