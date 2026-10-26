'use client';

import React, { useState } from 'react';
import { Form, Input, Button } from 'antd';
import { UserCustomIcon, LockCustomIcon, EyeOpenIcon, EyeCloseIcon } from './LoginIcons';

const LoginForm = ({ form, loading, isEn, onFinish }) => {
    const [usernameFocused, setUsernameFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    const usernameValue = Form.useWatch('username', form);
    const passwordValue = Form.useWatch('password', form);

    const isUsernameLegend = usernameFocused || !!usernameValue;
    const isPasswordLegend = passwordFocused || !!passwordValue;

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            requiredMark={false}
            className="iky-login__form"
        >
            <div className={`iky-field-wrapper ${isUsernameLegend ? 'is-legend' : ''} ${usernameFocused ? 'is-focused' : ''}`}>
                <label htmlFor="username" className="iky-field-legend">
                    {isEn ? 'Username' : 'Tên đăng nhập'}
                </label>
                <Form.Item
                    name="username"
                    rules={[
                        {
                            required: true,
                            message: isEn ? 'Please enter username' : 'Vui lòng nhập tên đăng nhập',
                        },
                    ]}
                    className="iky-field-item"
                >
                    <Input
                        id="username"
                        size="large"
                        prefix={<UserCustomIcon isActive={usernameFocused || isUsernameLegend} size={20} />}
                        placeholder={isUsernameLegend ? '' : (isEn ? 'Enter username' : 'Nhập tên đăng nhập')}
                        autoComplete="username"
                        onFocus={() => setUsernameFocused(true)}
                        onBlur={() => setUsernameFocused(false)}
                    />
                </Form.Item>
            </div>

            <div className={`iky-field-wrapper ${isPasswordLegend ? 'is-legend' : ''} ${passwordFocused ? 'is-focused' : ''}`}>
                <label htmlFor="password" className="iky-field-legend">
                    {isEn ? 'Password' : 'Mật khẩu'}
                </label>
                <Form.Item
                    name="password"
                    rules={[
                        {
                            required: true,
                            message: isEn ? 'Please enter password' : 'Vui lòng nhập mật khẩu',
                        },
                    ]}
                    className="iky-field-item"
                >
                    <Input.Password
                        id="password"
                        size="large"
                        prefix={<LockCustomIcon isOpen={passwordFocused || isPasswordLegend} size={20} />}
                        iconRender={(visible) => (visible ? <EyeOpenIcon size={23} /> : <EyeCloseIcon size={23} />)}
                        placeholder={isPasswordLegend ? '' : (isEn ? 'Enter password' : 'Nhập mật khẩu')}
                        autoComplete="current-password"
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                    />
                </Form.Item>
            </div>

            <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                className="iky-login__submit-btn"
            >
                {isEn ? 'Login' : 'Đăng nhập'}
            </Button>
        </Form>
    );
};

export default LoginForm;
