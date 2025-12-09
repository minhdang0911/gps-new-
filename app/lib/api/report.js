import api from './axios';

export const getBatteryReport = async (params = {}) => {
    const res = await api.get('/battery-report', { params });
    return res.data;
};

export const getTripReport = async (params = {}) => {
    const res = await api.get('/trip-report', { params });
    return res.data;
};

export const getLastCruiseList = async (params = {}) => {
    const res = await api.get('/last-cruise-list', { params });
    return res.data;
};
