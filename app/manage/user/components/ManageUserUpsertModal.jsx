// app/manage/user/components/ManageUserUpsertModal.jsx
'use client';

import React from 'react';
import { Modal, Spin } from 'antd';
import dynamic from 'next/dynamic';

const UserForm = dynamic(() => import('../../../components/UserForm'), { ssr: false });

export default function ManageUserUpsertModal({
    isOpen,
    isEditing,
    onClose,
    onSave,
    canEdit,
    distributorsBusy,
    initialFormData,
    currentRole,
    distributorOptions,
    userFormDataRef,
    popupInParent,
    translation,
}) {
    return (
        <Modal
            title={isEditing ? translation.modal.editTitle : translation.modal.createTitle}
            open={isOpen}
            onCancel={onClose}
            onOk={onSave}
            okText={translation.modal.okText}
            cancelText={translation.modal.cancelText}
            wrapClassName="user-modal"
            destroyOnHidden
            okButtonProps={{ disabled: !canEdit }}
        >
            {distributorsBusy ? (
                <div style={{ padding: 16 }}>
                    <Spin />
                </div>
            ) : (
                <UserForm
                    initialData={initialFormData}
                    currentRole={currentRole}
                    distributors={distributorOptions}
                    distributorsLoading={distributorsBusy}
                    isEditing={isEditing}
                    onChange={(formData) => {
                        userFormDataRef.current = formData;
                    }}
                    getPopupContainer={popupInParent}
                />
            )}
        </Modal>
    );
}
