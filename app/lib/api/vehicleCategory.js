// lib/api/vehicleCategory.js
import apiClient from './axios';

// Lấy list vehicle category
// token param kept for backward compat — axios interceptor handles Authorization
export const getVehicleCategories = async (tokenOrParams = {}, params = {}) => {
    // Hỗ trợ cả 2 cách gọi:
    //   getVehicleCategories({ limit: 1000 })          ← gọi mới (không token)
    //   getVehicleCategories(token, { limit: 1000 })   ← gọi cũ (có token)
    const resolvedParams =
        typeof tokenOrParams === 'string' ? params : tokenOrParams;

    const defaultParams = { page: 1, limit: 20 };

    const res = await apiClient.get('/vehicle-categories', {
        params: { ...defaultParams, ...resolvedParams },
    });

    return res.data;
};

// Tạo vehicle category
export const createVehicleCategory = async (token, payload) => {
    const res = await apiClient.post('/vehicle-category', payload);
    return res.data;
};

// Cập nhật vehicle category
export const updateVehicleCategory = async (token, id, payload) => {
    const res = await apiClient.put(`/vehicle-category/${id}`, payload);
    return res.data;
};

// Xoá vehicle category
export const deleteVehicleCategory = async (token, id) => {
    const res = await apiClient.delete(`/vehicle-category/${id}`);
    return res.data;
};

// Lấy danh sách hãng xe (manufacturer options)
export const getManufacturerOptions = async (token) => {
    const res = await apiClient.get('/get-manufacturer-options');
    return res.data;
};
