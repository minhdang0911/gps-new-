'use client';

import React from 'react';
import { Input, Select, Space, Button, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Option } = Select;

export default function DeviceCategoryFilters({
    t,
    filters,
    setFilters,
    onSearch,
    onReset,
    mifOptions,
    getMadeInFromLabel,
    showMifLoading,
    popupInParent,
}) {
    return (
        <div className="dc-filter">
            <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t.filters.name}
                value={filters.name}
                onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
                allowClear
                placeholder={t.filters.code}
                value={filters.code}
                onChange={(e) => setFilters((prev) => ({ ...prev, code: e.target.value }))}
            />
            <Input
                allowClear
                placeholder={t.filters.year}
                value={filters.year}
                onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
            />
            <Input
                allowClear
                placeholder={t.filters.model}
                value={filters.model}
                onChange={(e) => setFilters((prev) => ({ ...prev, model: e.target.value }))}
            />

            <Select
                allowClear
                placeholder={t.filters.origin}
                value={filters.madeInFrom || undefined}
                onChange={(value) => setFilters((prev) => ({ ...prev, madeInFrom: value || '' }))}
                style={{ minWidth: 180 }}
                getPopupContainer={popupInParent}
                loading={showMifLoading}
                disabled={showMifLoading}
                notFoundContent={showMifLoading ? <Spin size="small" /> : null}
                showSearch
                optionFilterProp="children"
            >
                {mifOptions.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                        {getMadeInFromLabel(opt.value)}
                    </Option>
                ))}
            </Select>

            <Space className="dc-filter__actions">
                <Button type="primary" onClick={onSearch}>
                    {t.search}
                </Button>
                <Button onClick={onReset}>{t.resetFilter}</Button>
            </Space>
        </div>
    );
}
