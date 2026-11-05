// lib/api/devices.js
import api from './axios';
import qs from 'qs';
import { setCachedDevices, addOrUpdateDeviceInCache, removeDeviceFromCache } from '../util/deviceCache';

// ===========================
// GET DEVICE LIST
// ===========================
export const getDevices = async (params = {}) => {
    try {
        const res = await api.get('devices', {
            params: {
                phone_number: params.phone_number || '',
                license_plate: params.license_plate || '',
                driver: params.driver || '',
                imei: params.imei || '',
                page: params.page || 1,
                limit: params.limit || 200000,
            },
        });

        // Tự động lưu cache nếu là query danh sách chung (không có filter biển số, imei, sđt)
        if (!params.phone_number && !params.license_plate && !params.driver && !params.imei) {
            if (res.data?.devices && Array.isArray(res.data.devices) && res.data.devices.length > 0) {
                setCachedDevices(res.data.devices);
            }
        }

        return res.data;
    } catch (err) {
        console.error('Error getDevices:', err);
        throw err?.response?.data || err;
    }
};

// ===========================
// GET DEVICE INFO
// ===========================
export const getDeviceInfo = async (token, deviceId) => {
    const res = await api.get(`device/${deviceId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.device;
};

// ===========================
// CREATE DEVICE (x-www-form-urlencoded)
// ===========================
export const createDevice = async (payload) => {
    const body = qs.stringify(payload);

    const res = await api.post('device', body, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    if (res.data?.device) {
        addOrUpdateDeviceInCache(res.data.device);
    }

    return res.data;
};

// ===========================
// UPDATE DEVICE (x-www-form-urlencoded)
// ===========================
export const updateDevice = async (id, payload) => {
    const body = qs.stringify(payload);

    const res = await api.put(`device/${id}`, body, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    if (res.data?.device) {
        addOrUpdateDeviceInCache(res.data.device);
    }

    return res.data;
};

// ===========================
// DELETE DEVICE
// ===========================
export const deleteDevice = async (id) => {
    const res = await api.delete(`device/${id}`);
    removeDeviceFromCache(id);
    return res.data;
};

export const lockDevice = async (id) => {
    const res = await api.post(`device/lock/${id}`, null);
    return res.data;
};

// ===========================
// UNLOCK DEVICE
// POST device/unlock/:id
// ===========================
export const unlockDevice = async (id) => {
    const res = await api.post(`device/unlock/${id}`, null);
    return res.data;
};
