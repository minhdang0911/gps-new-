// lib/api/deviceCategory.js
import apiClient from './axios';

// Lấy danh sách device category (có filter + phân trang)
export const getDeviceCategories = async (token, params = {}) => {
    const defaultParams = {
        page: 1,
        limit: 20,
    };

    const res = await apiClient.get('device-categories', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            ...defaultParams,
            ...params,
        },
    });

    return res.data; // { page, limit, total, totalPages, items: [...] }
};

// Tạo mới device category
export const createDeviceCategory = async (token, payload) => {
    // payload: { code, name, year, model, madeInFrom, description }
    const formData = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }
    });

    const res = await apiClient.post('device-category', formData, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};

// Cập nhật device category
export const updateDeviceCategory = async (token, id, payload) => {
    const formData = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }
    });

    const res = await apiClient.put(`device-category/${id}`, formData, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};

// Xoá device category
export const deleteDeviceCategory = async (token, id) => {
    const res = await apiClient.delete(`device-category/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    return res.data;
};

// Lấy danh sách "made in from" options
export const getMadeInFromOptions = async (token) => {
    const res = await apiClient.get('get-mif-options', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    // backend trả dạng object { "1": "Việt Nam", ... }
    return res.data;
};
