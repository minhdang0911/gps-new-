import api from './axios';

// Lấy list device của 1 customer
export const getDeviceCustomerList = async (token, customerId, params = {}) => {
    const res = await api.get(`/device-customer/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
            page: params.page || 1,
            limit: params.limit || 20,
        },
    });

    return res.data;
};

// Thêm device vào customer  (x-www-form-urlencoded)
export const addDeviceToCustomer = async (token, { imei, customerId }) => {
    const body = new URLSearchParams();
    body.append('imei', imei);
    body.append('customerId', customerId); // đúng tên backend đang dùng

    const res = await api.post('/device-customer/add', body, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};

// Gỡ device khỏi customer (x-www-form-urlencoded)
export const removeDeviceFromCustomer = async (token, { imei, customerId }) => {
    const body = new URLSearchParams();
    body.append('imei', imei);
    body.append('customerId', customerId);

    const res = await api.post('/device-customer/remove', body, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return res.data;
};
