import api from './axios';

export const getTripSessions = async (params = {}) => {
    const defaultParams = {
        page: 1,
        limit: 20,
    };

    const res = await api.get('trip-session', {
        params: {
            ...defaultParams,
            ...params,
        },
    });

    return res.data;
};
