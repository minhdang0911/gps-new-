import { MADE_IN_FROM_MAP } from '../../util/ConverMadeIn';

export const buildMapOptions = (obj = {}) => {
    return Object.entries(obj).map(([value, label]) => ({ value, label }));
};

export const buildDeviceTypeOptions = (items = []) => {
    return items.map((item) => ({
        value: item._id,
        label: item.name || item.code || 'Không tên',
    }));
};

export const getMifLabel = ({ value, mifOptions = [], isEn = false }) => {
    if (!value && value !== 0) return '';
    const key = String(value);
    const cfg = MADE_IN_FROM_MAP?.[key];
    if (cfg) return isEn ? cfg.en : cfg.vi;

    const found = mifOptions.find((opt) => String(opt.value) === key);
    if (found?.label) return found.label;
    return key;
};

export const getManufacturerLabel = ({ value, manufacturerOptions = [] }) => {
    const found = manufacturerOptions.find((opt) => String(opt.value) === String(value));
    return found ? found.label : value || '';
};

export const getDeviceTypeLabel = ({ value, deviceTypeOptions = [] }) => {
    if (!value) return '';
    const found = deviceTypeOptions.find((opt) => String(opt.value) === String(value));
    return found ? found.label : value || '';
};
