'use client';
import React, { useState, useEffect } from 'react';
import { Form, Input } from 'antd';
import AddressAutoComplete from './AddressAutoComplete';

export default function UserForm({ initialData, currentRole, distributors, isEditing, onChange }) {
    const [formData, setFormData] = useState(initialData);

    useEffect(() => {
        setFormData(initialData);
    }, [initialData]);

    const update = (patch) => {
        const newData = { ...formData, ...patch };
        setFormData(newData);
        onChange(newData);
    };

    return (
        <Form layout="vertical">
            <Form.Item label="Tên đăng nhập" extra={isEditing ? 'Không thể thay đổi tên đăng nhập' : null}>
                <Input
                    value={formData.username}
                    disabled={isEditing}
                    onChange={(e) => update({ username: e.target.value })}
                />
            </Form.Item>

            <Form.Item label="Mật khẩu">
                <Input.Password value={formData.password} onChange={(e) => update({ password: e.target.value })} />
            </Form.Item>

            <Form.Item label="Họ tên">
                <Input value={formData.name} onChange={(e) => update({ name: e.target.value })} />
            </Form.Item>

            <Form.Item label="Email">
                <Input value={formData.email} onChange={(e) => update({ email: e.target.value })} />
            </Form.Item>

            <Form.Item label="Số điện thoại">
                <Input value={formData.phone} onChange={(e) => update({ phone: e.target.value })} />
            </Form.Item>

            <Form.Item label="Địa chỉ">
                <AddressAutoComplete
                    value={formData.address}
                    onChange={(val, meta = {}) => {
                        update({
                            address: val,
                            place_id: meta.place_id || null,
                            place_raw: meta.raw || null,
                            address_lat: meta.lat || null,
                            address_lng: meta.lng || null,
                        });
                    }}
                />
            </Form.Item>

            <Form.Item label="Quyền">
                <select
                    value={formData.position || 'customer'}
                    onChange={(e) => {
                        const nextPosition = e.target.value;

                        update({
                            position: nextPosition,
                            distributor_id:
                                nextPosition === 'customer' || nextPosition === 'reporter'
                                    ? formData.distributor_id
                                    : null,
                        });
                    }}
                    style={{
                        width: '100%',
                        height: 40,
                        border: '1px solid #d9d9d9',
                        borderRadius: 6,
                        padding: '0 11px',
                        outline: 'none',
                        backgroundColor: '#fff',
                    }}
                >
                    {currentRole === 'administrator' && (
                        <>
                            <option value="administrator">Admin</option>
                            <option value="distributor">Distributor</option>
                            <option value="reporter">Reporter</option>
                            <option value="customer">Khách hàng</option>
                        </>
                    )}

                    {currentRole === 'distributor' && (
                        <>
                            <option value="reporter">Reporter</option>
                            <option value="customer">Khách hàng</option>
                        </>
                    )}

                    {currentRole !== 'administrator' && currentRole !== 'distributor' && (
                        <option value="customer">Khách hàng</option>
                    )}
                </select>
            </Form.Item>

            {currentRole === 'administrator' &&
                (formData.position === 'customer' || formData.position === 'reporter') && (
                    <Form.Item
                        label="Đại lý"
                        required
                        validateStatus={
                            !formData.distributor_id &&
                            (formData.position === 'customer' || formData.position === 'reporter')
                                ? 'error'
                                : ''
                        }
                        help={
                            !formData.distributor_id &&
                            (formData.position === 'customer' || formData.position === 'reporter')
                                ? 'Vui lòng chọn đại lý'
                                : ''
                        }
                    >
                        <select
                            value={formData.distributor_id || ''}
                            onChange={(e) => update({ distributor_id: e.target.value || null })}
                            style={{
                                width: '100%',
                                height: 40,
                                border: '1px solid #d9d9d9',
                                borderRadius: 6,
                                padding: '0 11px',
                                outline: 'none',
                                backgroundColor: '#fff',
                            }}
                        >
                            <option value="">Chọn đại lý</option>
                            {distributors.map((d) => (
                                <option key={d._id} value={d._id}>
                                    {d.email} ({d.username})
                                </option>
                            ))}
                        </select>
                    </Form.Item>
                )}
        </Form>
    );
}
