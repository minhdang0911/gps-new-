import axios from './axios';

export const getLastCruise = async (token, imei) => {
    const res = await axios.get(`last-cruise`, {
        params: { imei },
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.cruise;
};

export const getCruiseHistory = async (token, { imei, start, end, page, limit = 500 }) => {
    const res = await axios.get('cruise-history', {
        params: { imei, start, end, page, limit },
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    // res.data dạng:
    // {
    //   total: 5,
    //   page: 0,
    //   limit: 0,
    //   data: [ ... ]
    // }
    return res.data;
};
