import api from './axios';

/**
 * Bắt đầu bảo trì
 * POST /maintenance/start
 * @param {Object} data
 * @param {string} data.device_id
 */
export const startMaintenance = async (data) => {
    const res = await api.post('/maintenance/start', data);
    return res.data;
};

/**
 * Xác nhận bảo trì
 * POST /maintenance/confirm
 * @param {Object} data
 * @param {string} data.imei
 * @param {string} data.maintenanceDate (YYYY-MM-DD)
 * @param {string} data.confirmedBy (user_id)
 * @param {string} data.note
 */
export const confirmMaintenance = async (data) => {
    const res = await api.post('/maintenance/confirm', data);
    return res.data;
};

export const getMaintenanceHistory = async (params = {}) => {
    const res = await api.get('/maintenance/history', { params });
    return res.data;
};

export const getMaintenanceDue = async (params = {}) => {
    const res = await api.get('/maintenance/due', { params });
    return res.data;
};
