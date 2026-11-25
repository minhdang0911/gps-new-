// app/manage/user/components/ManageUserFilterBar.jsx
'use client';

import React from 'react';
import { Row, Col, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Option } = Select;

export default function ManageUserFilterBar({
    searchUsername,
    setSearchUsername,
    searchEmail,
    setSearchEmail,
    searchPhone,
    setSearchPhone,
    filterRole,
    setFilterRole,
    roleLabelMap,
    isEnglish,
    popupInParent,
}) {
    return (
        <div className="user-page__search" style={{ marginBottom: 16 }} data-tour="searchBox">
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={6}>
                    <Input
                        placeholder={isEnglish ? 'Search by username' : 'Tìm theo tên đăng nhập'}
                        prefix={<SearchOutlined />}
                        value={searchUsername}
                        onChange={(event) => setSearchUsername(event.target.value)}
                        allowClear
                    />
                </Col>
                <Col xs={24} sm={6}>
                    <Input
                        placeholder={isEnglish ? 'Search by email' : 'Tìm theo email'}
                        prefix={<SearchOutlined />}
                        value={searchEmail}
                        onChange={(event) => setSearchEmail(event.target.value)}
                        allowClear
                    />
                </Col>
                <Col xs={24} sm={6}>
                    <Input
                        placeholder={isEnglish ? 'Search by phone' : 'Tìm theo số điện thoại'}
                        prefix={<SearchOutlined />}
                        value={searchPhone}
                        onChange={(event) => setSearchPhone(event.target.value)}
                        allowClear
                    />
                </Col>
                <Col xs={24} sm={6} data-tour="roleFilter">
                    <Select
                        placeholder={isEnglish ? 'Filter by role' : 'Lọc theo vai trò'}
                        value={filterRole || undefined}
                        onChange={(val) => setFilterRole(val || '')}
                        allowClear
                        style={{ width: '100%' }}
                        getPopupContainer={popupInParent}
                    >
                        <Option value="administrator">{roleLabelMap.administrator}</Option>
                        <Option value="distributor">{roleLabelMap.distributor}</Option>
                        <Option value="reporter">{roleLabelMap.reporter}</Option>
                        <Option value="customer">{roleLabelMap.customer}</Option>
                    </Select>
                </Col>
            </Row>
        </div>
    );
}
