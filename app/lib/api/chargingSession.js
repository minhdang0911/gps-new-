import api from './axios';

export const getChargingSessions = async (payload = {}) => {
    const defaultPayload = {
        page: 1,
        limit: 20,
    };

    const body = { ...defaultPayload, ...payload };

    // build query string
    const query = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.append(key, value);
        }
    });

    const res = await api.get(`charging-session?${query.toString()}`);

    return res.data;
};
