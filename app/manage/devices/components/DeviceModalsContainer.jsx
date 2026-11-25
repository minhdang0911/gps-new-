// app/manage/devices/components/DeviceModalsContainer.jsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import DeviceMaintenanceConfirmModal from './DeviceMaintenanceConfirmModal';

const DeviceUpsertModal = dynamic(() => import('../../../components/manageDevices/DeviceUpsertModal'), { ssr: false });
const DeviceCommandBarModal = dynamic(() => import('../../../components/manageDevices/DeviceCommandBarModal'), { ssr: false });

export default function DeviceModalsContainer({
    cmd,
    crud,
    maintenance,
    isEn,
    t,
    canEditDevice,
    canDeleteDevice,
    deviceCategories,
    vehicleCategories,
    userOptions,
    dcLoading,
    vcLoading,
    usersLoading,
    currentRole,
}) {
    return (
        <>
            <DeviceCommandBarModal
                open={cmd.cmdOpen}
                onClose={cmd.close}
                isEn={isEn}
                t={t}
                cmdQuery={cmd.cmdQuery}
                setCmdQuery={cmd.setCmdQuery}
                cmdLoading={cmd.cmdLoading}
                cmdResults={cmd.cmdResults}
                onRunAction={(action) => {
                    cmd.close();
                    action?.run?.();
                }}
                onSelectDevice={(device) => {
                    cmd.close();
                    crud.handleSelectDevice(device);
                }}
                canEditDevice={canEditDevice}
                canDeleteDevice={canDeleteDevice}
                onEditDevice={(device) => {
                    cmd.close();
                    crud.openEdit(device);
                }}
                onDeleteDevice={(device) => {
                    cmd.close();
                    crud.handleDelete(device);
                }}
            />

            <DeviceUpsertModal
                open={!!crud.modalMode}
                title={crud.modalMode === 'add' ? t.modal.addTitle : t.modal.editTitle}
                t={t}
                form={crud.form}
                onCancel={() => {
                    crud.setModalMode(null);
                    crud.setPendingFormValues(null);
                }}
                onOk={crud.handleSave}
                afterOpenChange={(open) => {
                    if (!open) return;
                    crud.form.resetFields();
                    if (crud.modalMode === 'edit' && crud.pendingFormValues) {
                        crud.form.setFieldsValue(crud.pendingFormValues);
                    }
                }}
                deviceCategories={deviceCategories}
                vehicleCategories={vehicleCategories}
                userOptions={userOptions}
                dcLoading={dcLoading}
                vcLoading={vcLoading}
                usersLoading={usersLoading}
                optionsLoading={dcLoading || vcLoading || usersLoading}
                popupInParent={(node) => node.parentElement}
                isEn={isEn}
                currentRole={currentRole}
            />

            <DeviceMaintenanceConfirmModal
                isOpen={maintenance.confirmModalOpen}
                onCancel={maintenance.closeMaintainModal}
                onConfirm={maintenance.handleConfirmMaintenance}
                isConfirming={maintenance.isConfirmingMaintenance}
                deviceToMaintain={maintenance.deviceToMaintain}
                form={maintenance.confirmForm}
                isEnglish={isEn}
            />
        </>
    );
}
