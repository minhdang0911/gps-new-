'use client';

import React, { useState } from 'react';
import { Card, Button, Table, Space, Typography, Input, Modal, Form, Row, Col } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const mockGroups = [
    { id: 1, name: 'Nhóm xe công ty', description: 'Xe công ty', deviceCount: 3, createdAt: '18/05/2024' },
    { id: 2, name: 'Nhóm xe cá nhân', description: 'Xe cá nhân', deviceCount: 1, createdAt: '20/05/2024' },
];

export default function ManageGroupsPage() {
    const [groups, setGroups] = useState(mockGroups);

    const [groupModalVisible, setGroupModalVisible] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);

    const [groupForm, setGroupForm] = useState({
        name: '',
        description: '',
    });

    const handleOpenCreate = () => {
        setEditingGroup(null);
        setGroupForm({ name: '', description: '' });
        setGroupModalVisible(true);
    };

    const handleRowClick = (g) => {
        setEditingGroup(g);
        setGroupForm({
            name: g.name,
            description: g.description,
        });
        setGroupModalVisible(true);
    };

    const handleSaveGroup = () => {
        if (editingGroup) {
            setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? { ...g, ...groupForm } : g)));
        } else {
            const newGroup = {
                id: Date.now(),
                name: groupForm.name,
                description: groupForm.description,
                deviceCount: 0,
                createdAt: new Date().toLocaleDateString('vi-VN'),
            };
            setGroups((prev) => [...prev, newGroup]);
        }

        setGroupModalVisible(false);
        setEditingGroup(null);
    };

    const groupColumns = [
        { title: 'Tên nhóm', dataIndex: 'name' },
        { title: 'Mô tả', dataIndex: 'description' },
        { title: 'Số thiết bị', dataIndex: 'deviceCount' },
        { title: 'Ngày tạo', dataIndex: 'createdAt' },
    ];

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Title level={4} style={{ margin: 0 }}>
                    Quản lý nhóm thiết bị
                </Title>

                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                    Tạo nhóm mới
                </Button>
            </Space>

            <Card>
                <Form layout="vertical">
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item label="Tìm kiếm nhóm">
                                <Input placeholder="Tên nhóm..." prefix={<SearchOutlined />} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <Card>
                <Text strong>Danh sách nhóm</Text>
                <Table
                    rowKey="id"
                    style={{ marginTop: 12 }}
                    columns={groupColumns}
                    dataSource={groups}
                    onRow={(record) => ({
                        onClick: () => handleRowClick(record),
                        style: { cursor: 'pointer' },
                    })}
                />
            </Card>

            {/* MODAL */}
            <Modal
                title={editingGroup ? 'Sửa nhóm' : 'Tạo nhóm mới'}
                open={groupModalVisible}
                onCancel={() => setGroupModalVisible(false)}
                onOk={handleSaveGroup}
                okText={editingGroup ? 'Lưu' : 'Tạo nhóm'}
                cancelText="Đóng"
            >
                <Form layout="vertical">
                    <Form.Item label="Tên nhóm">
                        <Input
                            value={groupForm.name}
                            onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                        />
                    </Form.Item>

                    <Form.Item label="Mô tả nhóm">
                        <Input.TextArea
                            rows={3}
                            value={groupForm.description}
                            onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </Space>
    );
}
