// 'use client';

import { Card, Skeleton, Table } from 'antd';

export default function Loading() {
    const columns = [
        { title: 'Thiết bị', dataIndex: 'a' },
        { title: 'IMEI', dataIndex: 'b' },
        { title: 'Trạng thái', dataIndex: 'c' },
        { title: 'Ngày tạo', dataIndex: 'd' },
    ];

    // tạo 6 dòng rỗng để giữ chiều cao table
    const dataSource = Array.from({ length: 6 }).map((_, i) => ({
        key: i,
        a: <Skeleton active title={false} paragraph={{ rows: 1 }} />,
        b: <Skeleton active title={false} paragraph={{ rows: 1 }} />,
        c: <Skeleton active title={false} paragraph={{ rows: 1 }} />,
        d: <Skeleton active title={false} paragraph={{ rows: 1 }} />,
    }));

    return (
        <Card>
            <Table columns={columns} dataSource={dataSource} pagination={false} rowKey="key" />
        </Card>
    );
}
