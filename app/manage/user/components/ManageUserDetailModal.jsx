// app/manage/user/components/ManageUserDetailModal.jsx
'use client';

import React from 'react';
import { Modal, Descriptions, Button } from 'antd';

export default function ManageUserDetailModal({
    isOpen,
    onClose,
    isLoading,
    userData,
    roleLabelMap,
    isEnglish,
    translation,
}) {
    return (
        <Modal
            title={translation.view.title}
            open={isOpen}
            onCancel={onClose}
            footer={<Button onClick={onClose}>{translation.view.close}</Button>}
            wrapClassName="user-modal"
            destroyOnHidden
        >
            {isLoading ? (
                translation.view.loading
            ) : userData ? (
                <Descriptions column={1} bordered>
                    <Descriptions.Item label={translation.view.fields.username}>
                        {userData.username}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.name}>
                        {userData.name}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.email}>
                        {userData.email}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.phone}>
                        {userData.phone}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.role}>
                        {roleLabelMap[userData.position] || userData.position || ''}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.distributor}>
                        {typeof userData.distributor_id === 'string'
                            ? userData.distributor_id
                            : userData.distributor_id
                            ? `${userData.distributor_id.email} (${userData.distributor_id.username})`
                            : ''}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.address}>
                        {userData.address || ''}
                    </Descriptions.Item>
                    <Descriptions.Item label={translation.view.fields.createdAt}>
                        {userData.createdAt
                            ? new Date(userData.createdAt).toLocaleString(isEnglish ? 'en-GB' : 'vi-VN')
                            : ''}
                    </Descriptions.Item>
                </Descriptions>
            ) : (
                translation.view.loading
            )}
        </Modal>
    );
}
