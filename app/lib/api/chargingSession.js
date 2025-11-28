import api from './axios';

export const getChargingSessions = async (payload = {}) => {
    const defaultPayload = {
        page: 1,
        limit: 20,
    };

    const body = {
        ...defaultPayload,
        ...payload,
    };

    // build x-www-form-urlencoded
    const formData = new URLSearchParams();
    Object.entries(body).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            formData.append(key, value);
        }
    });

    const res = await api.get('charging-session', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};
