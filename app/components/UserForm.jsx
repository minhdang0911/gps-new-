'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Form, Input } from 'antd';
import AddressAutoComplete from './AddressAutoComplete';
import SearchableSelect from './common/SearchableSelect';
import { useIsEn } from '../hooks/useLang';

/** Danh sách quyền theo role — dùng color dot để phân biệt nhanh */
const ROLE_OPTIONS_VI = [
    { value: 'administrator', label: 'Quản trị hệ thống', description: 'Toàn quyền hệ thống',   color: '#f5222d' },
    { value: 'distributor',   label: 'Đại lý',             description: 'Quản lý thiết bị & user', color: '#fa8c16' },
    { value: 'reporter',      label: 'Giám sát',            description: 'Xem báo cáo, theo dõi',  color: '#1677ff' },
    { value: 'technical',     label: 'Kỹ thuật',            description: 'Giám sát + điều khiển',  color: '#722ed1' },
    { value: 'customer',      label: 'Khách hàng',          description: 'Truy cập cơ bản',        color: '#52c41a' },
];

const ROLE_OPTIONS_EN = [
    { value: 'administrator', label: 'Administrator',  description: 'Full system access',         color: '#f5222d' },
    { value: 'distributor',   label: 'Distributor',    description: 'Manage devices & users',     color: '#fa8c16' },
    { value: 'reporter',      label: 'Reporter',       description: 'View reports & monitoring',  color: '#1677ff' },
    { value: 'technical',     label: 'Technical',      description: 'Reporter + device control',  color: '#722ed1' },
    { value: 'customer',      label: 'Customer',       description: 'Basic access',               color: '#52c41a' },
];

/** Lọc options theo role của người đang đăng nhập */
function getAllowedOptions(currentRole, allOptions) {
    if (currentRole === 'administrator') return allOptions;
    if (currentRole === 'distributor')  return allOptions.filter((o) => o.value === 'reporter' || o.value === 'customer' || o.value === 'technical');
    return allOptions.filter((o) => o.value === 'customer');
}

export default function UserForm({ initialData, currentRole, distributors, isEditing, onChange }) {
    const [formData, setFormData] = useState(initialData);
    const [distributorTouched, setDistributorTouched] = useState(false);
    const isEn = useIsEn();

    useEffect(() => {
        setFormData(initialData);
        setDistributorTouched(false); // reset khi open form mới
    }, [initialData]);

    const update = (patch) => {
        const newData = { ...formData, ...patch };
        setFormData(newData);
        onChange(newData);
    };

    const allRoleOptions = isEn ? ROLE_OPTIONS_EN : ROLE_OPTIONS_VI;
    const roleOptions    = useMemo(() => getAllowedOptions(currentRole, allRoleOptions), [currentRole, allRoleOptions]);

    const needsDistributor = formData.position === 'customer'
        || formData.position === 'reporter'
        || formData.position === 'technical';

    const distributorOptions = [
        { value: '', label: isEn ? 'Select distributor...' : 'Chọn đại lý...' },
        ...distributors.map((d) => ({
            value: d._id,
            label: `${d.email} (${d.username})`,
        })),
    ];

    return (
        <Form layout="vertical">
            <Form.Item label={isEn ? 'Username' : 'Tên đăng nhập'} extra={isEditing ? (isEn ? 'Cannot change username' : 'Không thể thay đổi tên đăng nhập') : null}>
                <Input
                    value={formData.username}
                    disabled={isEditing}
                    onChange={(e) => update({ username: e.target.value })}
                />
            </Form.Item>

            <Form.Item label={isEn ? 'Password' : 'Mật khẩu'}>
                <Input.Password value={formData.password} onChange={(e) => update({ password: e.target.value })} />
            </Form.Item>

            <Form.Item label={isEn ? 'Full name' : 'Họ tên'}>
                <Input value={formData.name} onChange={(e) => update({ name: e.target.value })} />
            </Form.Item>

            <Form.Item label={isEn ? 'Address' : 'Địa chỉ'}>
                <AddressAutoComplete
                    value={formData.address}
                    onChange={(val, meta = {}) => {
                        update({
                            address:     val,
                            place_id:    meta.place_id  || null,
                            place_raw:   meta.raw       || null,
                            address_lat: meta.lat       || null,
                            address_lng: meta.lng       || null,
                        });
                    }}
                />
            </Form.Item>

            {/* ── Quyền ───────────── */}
            <Form.Item label={isEn ? 'Role' : 'Quyền'}>
                <SearchableSelect
                    options={roleOptions}
                    value={formData.position || 'customer'}
                    onChange={(nextPosition) => {
                        update({
                            position: nextPosition,
                            distributor_id: needsDistributor ? formData.distributor_id : null,
                        });
                        setDistributorTouched(false);
                    }}
                    placeholder={isEn ? 'Select role...' : 'Chọn quyền...'}
                    searchPlaceholder={isEn ? 'Search role...' : 'Tìm quyền...'}
                    positionFixed
                />
            </Form.Item>

            {/* ── Đại lý ── */}
            {currentRole === 'administrator' && needsDistributor && (
                <Form.Item
                    label={isEn ? 'Distributor' : 'Đại lý'}
                    required
                    validateStatus={distributorTouched && !formData.distributor_id ? 'error' : ''}
                    help={distributorTouched && !formData.distributor_id ? (isEn ? 'Please select a distributor' : 'Vui lòng chọn đại lý') : ''}
                >
                    <SearchableSelect
                        options={distributorOptions}
                        value={formData.distributor_id || ''}
                        onChange={(val) => {
                            update({ distributor_id: val || null });
                            setDistributorTouched(true);
                        }}
                        placeholder={isEn ? 'Select distributor...' : 'Chọn đại lý...'}
                        searchPlaceholder={isEn ? 'Search by email / username...' : 'Tìm theo email / username...'}
                        clearable
                        positionFixed
                    />
                </Form.Item>
            )}

            <Form.Item label="Email">
                <Input value={formData.email} onChange={(e) => update({ email: e.target.value })} />
            </Form.Item>

            <Form.Item label={isEn ? 'Phone number' : 'Số điện thoại'}>
                <Input value={formData.phone} onChange={(e) => update({ phone: e.target.value })} />
            </Form.Item>
        </Form>
    );
}
