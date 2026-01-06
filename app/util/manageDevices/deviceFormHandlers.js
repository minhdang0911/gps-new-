export function buildPendingFormValues(item) {
    return {
        imei: item.imei,
        phone_number: item.phone_number,
        license_plate: item.license_plate,
        driver: item.driver,
        device_category_id: item.device_category_id?._id,
        vehicle_category_id: item.vehicle_category_id?._id,
        user_id: item.user_id?._id,
        distributor_id: item.distributor_id?._id,
    };
}

export function validatePhone(phone) {
    if (!phone) return true;
    return /^(0[2-9][0-9]{8,9})$/.test(phone);
}

export function extractErrorMsg(err, isEn) {
    const data = err?.response?.data;
    if (!data) return isEn ? 'Unknown error' : 'Lỗi không xác định';
    if (Array.isArray(data.errors)) return data.errors.join(', ');
    if (data.error) return data.error;
    if (data.message) return data.message;
    return isEn ? 'Unknown error' : 'Lỗi không xác định';
}
