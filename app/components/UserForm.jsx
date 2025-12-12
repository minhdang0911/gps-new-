'use client';
import React, { useState, useEffect } from 'react';
import { Form, Input, Select } from 'antd';
import AddressAutoComplete from './AddressAutoComplete';

const { Option } = Select;

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
                    onChange={(val, meta) => {
                        update({
                            address: val,
                            place_id: meta.place_id,
                            place_raw: meta.raw,
                        });
                    }}
                />
            </Form.Item>

            <Form.Item label="Quyền">
                <Select value={formData.position} onChange={(v) => update({ position: v })}>
                    {currentRole === 'administrator' && (
                        <>
                            <Option value="administrator">Admin</Option>
                            <Option value="distributor">Distributor</Option>
                            <Option value="reporter">Reporter</Option> {/* ✅ thêm */}
                        </>
                    )}

                    {/* nếu bạn muốn distributor cũng tạo/sửa được reporter thì mở block này */}
                    {currentRole === 'distributor' && (
                        <>
                            <Option value="reporter">Reporter</Option> {/* ✅ thêm */}
                        </>
                    )}

                    <Option value="customer">Khách hàng</Option>
                </Select>
            </Form.Item>

            {currentRole === 'administrator' &&
                (formData.position === 'customer' || formData.position === 'reporter') && (
                    <Form.Item label="Đại lý" required rules={[{ required: true, message: 'Vui lòng chọn đại lý' }]}>
                        <Select
                            value={formData.distributor_id}
                            onChange={(v) => update({ distributor_id: v })}
                            placeholder="Chọn đại lý"
                        >
                            {distributors.map((d) => (
                                <Option key={d._id} value={d._id}>
                                    {d.email} ({d.username})
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                )}
        </Form>
    );
}
