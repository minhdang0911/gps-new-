import vi from '../../locales/vi.json';
import en from '../../locales/en.json';

export const locales = { vi, en };

export function getSupportLocale(isEn) {
    return isEn ? locales.en.support : locales.vi.support;
}
