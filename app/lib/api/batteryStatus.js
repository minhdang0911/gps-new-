import axios from './axios';

export const getBatteryStatusByImei = async (token, imei) => {
    const res = await axios.get('battery-status', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            imei,
        },
    });
    return res.data;
};
