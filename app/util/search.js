// app/util/search.js

const TELEX_MAP = {
    á: 'as', à: 'af', ả: 'ar', ã: 'ax', ạ: 'aj',
    â: 'aa', ấ: 'aas', ầ: 'aaf', ẩ: 'aar', ẫ: 'aax', ậ: 'aaj',
    ă: 'aw', ắ: 'aws', ằ: 'awf', ẳ: 'awr', ẵ: 'awx', ặ: 'awj',
    é: 'es', è: 'ef', ẻ: 'er', ẽ: 'ex', ẹ: 'ej',
    ê: 'ee', ế: 'ees', ề: 'eef', ể: 'eer', ễ: 'eex', ệ: 'eej',
    í: 'is', ì: 'if', ỉ: 'ir', ĩ: 'ix', ị: 'ij',
    ó: 'os', ò: 'of', ỏ: 'or', õ: 'ox', ọ: 'oj',
    ô: 'oo', ố: 'oos', ồ: 'oof', ổ: 'oor', ỗ: 'oox', ộ: 'ooj',
    ơ: 'ow', ớ: 'ows', ờ: 'owf', ở: 'owr', ỡ: 'owx', ợ: 'owj',
    ú: 'us', ù: 'uf', ủ: 'ur', ũ: 'ux', ụ: 'uj',
    ư: 'uw', ứ: 'uws', ừ: 'uwf', ử: 'uwr', ữ: 'uwx', ự: 'uwj',
    ý: 'ys', ỳ: 'yf', ỷ: 'yr', ỹ: 'yx', ỵ: 'yj',
    đ: 'dd',
};

/**
 * Chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, đ/Đ -> d/D, lowercase, trim
 */
export const removeVietnameseTones = (str = '') => {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
};

/**
 * Khôi phục ký tự Telex sang dạng gõ thô (vd: 'ẻ' -> 'er', 'ẻa' -> 'era', 'ỏ' -> 'or')
 * Giúp người dùng gõ từ tiếng Anh/thương hiệu (era, order, test...) không bị mất kết quả khi Unikey/IME tự bỏ dấu.
 */
export const restoreTelex = (str = '') => {
    if (!str) return '';
    return String(str)
        .split('')
        .map((ch) => {
            const lower = ch.toLowerCase();
            return TELEX_MAP[lower] || ch;
        })
        .join('');
};

/**
 * Bộ lọc thông minh cho Ant Design Select / AutoComplete:
 * 1. Khớp chính xác (không phân biệt hoa thường)
 * 2. Khớp tiếng Việt không dấu (gõ dat bike -> Dat Bike, xe dien -> Xe điện)
 * 3. Khớp phục hồi Telex (gõ er -> ẻ hoặc ẻa -> era vẫn khớp Era)
 */
export const filterVietnameseOption = (input, option) => {
    if (!input) return true;
    const label = String(option?.label ?? option?.children ?? '').trim();
    if (!label) return false;

    const rawInput = input.trim().toLowerCase();
    const rawLabel = label.toLowerCase();

    // 1. Khớp chuỗi trực tiếp
    if (rawLabel.includes(rawInput)) return true;

    // 2. Khớp chuỗi bỏ dấu
    const normInput = removeVietnameseTones(rawInput);
    const normLabel = removeVietnameseTones(rawLabel);
    if (normInput && normLabel.includes(normInput)) return true;

    // 3. Khớp khôi phục phím gõ Telex
    const telexInput = removeVietnameseTones(restoreTelex(rawInput));
    if (telexInput && normLabel.includes(telexInput)) return true;

    return false;
};
