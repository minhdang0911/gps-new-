import apiClient from './axios';

export const getUsageSessions = async (token, params = {}) => {
    const defaultParams = {
        page: 1,
        limit: 20,
    };

    const res = await apiClient.get('usage-session/list', {
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
