// lib/api/deviceCategory.js
import apiClient from './axios';

// Lấy danh sách device category (có filter + phân trang)
export const getDeviceCategories = async (params = {}) => {
    const defaultParams = {
        page: 1,
        limit: 20,
    };

    const res = await apiClient.get('device-categories', {
        params: {
            ...defaultParams,
            ...params,
        },
    });

    return res.data; // { page, limit, total, totalPages, items: [...] }
};

// Tạo mới device category
export const createDeviceCategory = async (payload) => {
    // payload: { code, name, year, model, madeInFrom, description }
    const formData = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }
    });

    const res = await apiClient.post('device-category', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};

// Cập nhật device category
export const updateDeviceCategory = async (id, payload) => {
    const formData = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            formData.append(key, value);
        }
    });

    const res = await apiClient.put(`device-category/${id}`, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};

// Xoá device category
export const deleteDeviceCategory = async (id) => {
    const res = await apiClient.delete(`device-category/${id}`);
    return res.data;
};

// Lấy danh sách "made in from" options
export const getMadeInFromOptions = async () => {
    const res = await apiClient.get('get-mif-options');
    // backend trả dạng object { "1": "Việt Nam", ... }
    return res.data;
};
