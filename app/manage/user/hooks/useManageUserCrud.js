// app/manage/user/hooks/useManageUserCrud.js
import { useState, useRef, useCallback } from 'react';
import { Modal, message } from 'antd';
import { createUser, updateUser, deleteUser } from '../../../lib/api/user';
import { invalidateMasterCache } from '../../../hooks/useMasterData';

export const EMPTY_USER_FORM = {
    username: '',
    password: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    position: 'customer',
    distributor_id: null,
    place_id: null,
    place_raw: null,
    address_lat: null,
    address_lng: null,
};

export function useManageUserCrud({
    canCreate,
    canEdit,
    canDelete,
    canView,
    mutateUsers,
    mutateDistributors,
    translation,
}) {
    const [userModalVisible, setUserModalVisible] = useState(false);
    const [viewUserModalVisible, setViewUserModalVisible] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [viewUserId, setViewUserId] = useState(null);

    const userFormDataRef = useRef(EMPTY_USER_FORM);
    const [initialFormData, setInitialFormData] = useState(EMPTY_USER_FORM);

    const handleOpenAddUser = () => {
        if (!canCreate) return;
        setEditingUser(null);
        userFormDataRef.current = { ...EMPTY_USER_FORM };
        setInitialFormData({ ...EMPTY_USER_FORM });
        try {
            mutateDistributors?.();
        } catch {}
        setUserModalVisible(true);
    };

    const handleOpenEditUser = (record) => {
        if (!canEdit) return;
        setEditingUser(record);
        const initialValues = {
            username: record.username || '',
            password: '',
            name: record.name || '',
            email: record.email || '',
            phone: record.phone || '',
            address: record.address || '',
            position: record.position || 'customer',
            distributor_id: record.distributor_id || null,
            place_id: record.place_id || null,
            place_raw: record.address_raw || null,
            address_lat: record.address_lat || null,
            address_lng: record.address_lng || null,
        };
        userFormDataRef.current = initialValues;
        setInitialFormData(initialValues);
        try {
            mutateDistributors?.();
        } catch {}
        setUserModalVisible(true);
    };

    const handleViewUser = (record) => {
        if (!canView) return;
        setViewUserId(record._id);
        setViewUserModalVisible(true);
    };

    const closeUserModal = useCallback(() => {
        setUserModalVisible(false);
        setEditingUser(null);
        userFormDataRef.current = EMPTY_USER_FORM;
        setInitialFormData(EMPTY_USER_FORM);
    }, []);

    const closeViewUserModal = useCallback(() => {
        setViewUserModalVisible(false);
        setViewUserId(null);
    }, []);

    const handleSaveUser = async () => {
        if (!canEdit) return;
        try {
            const formData = userFormDataRef.current || EMPTY_USER_FORM;

            if (editingUser) {
                const payload = {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    position: formData.position,
                };
                if (['customer', 'reporter', 'technical'].includes(formData.position)) {
                    payload.distributor_id = formData.distributor_id || null;
                }
                if (formData.password && formData.password.trim() !== '') {
                    payload.password = formData.password;
                }
                if (formData.place_id) payload.place_id = formData.place_id;
                if (formData.place_raw) payload.address_raw = formData.place_raw;
                if (formData.address_lat) payload.address_lat = formData.address_lat;
                if (formData.address_lng) payload.address_lng = formData.address_lng;

                await updateUser(editingUser._id, payload);
                message.success(translation.messages.updateSuccess);
            } else {
                if (!canCreate) return;
                const createPayload = {
                    username: formData.username,
                    password: formData.password,
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    address: formData.address,
                    position: formData.position,
                };
                if (formData.distributor_id) createPayload.distributor_id = formData.distributor_id;
                if (formData.place_id) createPayload.place_id = formData.place_id;
                if (formData.place_raw) createPayload.address_raw = formData.place_raw;
                if (formData.address_lat) createPayload.address_lat = formData.address_lat;
                if (formData.address_lng) createPayload.address_lng = formData.address_lng;

                await createUser(createPayload);
                message.success(translation.messages.createSuccess);
            }

            closeUserModal();
            mutateUsers();
            invalidateMasterCache('userOptions');
        } catch (error) {
            const apiResponseData = error?.response?.data;
            if (apiResponseData && Array.isArray(apiResponseData.errors) && apiResponseData.errors.length) {
                message.error(apiResponseData.errors.join('\n'));
                return;
            }
            const singleMessage = apiResponseData?.error || apiResponseData?.message;
            if (singleMessage) {
                message.error(Array.isArray(singleMessage) ? singleMessage.join('\n') : String(singleMessage));
                return;
            }
            message.error(error?.message || translation.messages.saveFailedFallback);
        }
    };

    const handleDeleteUser = (record) => {
        if (!canDelete) return;
        Modal.confirm({
            title: translation.messages.deleteConfirmTitle,
            content: `${translation.messages.deleteConfirmContentPrefix}${record.username}?`,
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteUser(record._id);
                    message.success(translation.messages.deleteSuccess);
                    mutateUsers();
                    invalidateMasterCache('userOptions');
                } catch {
                    message.error(translation.messages.deleteFailed);
                }
            },
        });
    };

    return {
        userModalVisible,
        viewUserModalVisible,
        editingUser,
        viewUserId,
        userFormDataRef,
        initialFormData,
        handleOpenAddUser,
        handleOpenEditUser,
        handleViewUser,
        closeUserModal,
        closeViewUserModal,
        handleSaveUser,
        handleDeleteUser,
    };
}
