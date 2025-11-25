// lib/api/vehicleCategory.js
import apiClient from './axios';

// Lấy list vehicle category
export const getVehicleCategories = async (token, params = {}) => {
    const defaultParams = {
        page: 1,
        limit: 20,
    };

    const res = await apiClient.get('/vehicle-categories', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            ...defaultParams,
            ...params,
        },
    });

    return res.data;
};

// Tạo vehicle category
export const createVehicleCategory = async (token, payload) => {
    const res = await apiClient.post('/vehicle-category', payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return res.data;
};

// Cập nhật vehicle category
export const updateVehicleCategory = async (token, id, payload) => {
    const res = await apiClient.put(`/vehicle-category/${id}`, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return res.data;
};

// Xoá vehicle category
export const deleteVehicleCategory = async (token, id) => {
    const res = await apiClient.delete(`/vehicle-category/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return res.data;
};

// Lấy danh sách hãng xe (manufacturer options)
export const getManufacturerOptions = async (token) => {
    const res = await apiClient.get('/get-manufacturer-options', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    return res.data;
};
