/**
 * canonicalVehicleSearch.js
 * Thuat toan tim kiem thiet bi va xe thong minh da truong (Multi-Field Search Engine)
 * - Triet tieu khac biet do dau gach ngang (-), dau cham (.), khoang trang, gach cheo (/)
 * - Loai bo dau tieng Viet (normalize NFD, d/D)
 * - Tim kiem tren moi truong: Bien so, Ten xe, Model xe, IMEI, So dien thoai, Tai xe, Ghi chu
 * - Ho tro tim kiem da tu (Multi-token search)
 * - Ho tro tu dong fallback Fuzzy / Chong go nham (Typo Tolerance bang Levenshtein distance)
 */

/**
 * Chuan hoa chuoi tim kiem: bo dau tieng Viet, bo ky tu dac biet, chuyen ve chu thuong
 * @param {string} rawInputString - Chuoi can chuan hoa
 * @returns {string} - Chuoi da duoc chuan hoa
 */
export const canonicalizeVehicleSearch = (rawInputString) => {
    if (!rawInputString || typeof rawInputString !== 'string') return '';
    return rawInputString
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[\s.\-_/–—,:;()[\]#*+=/?!<>'\"~`@]/g, '')
        .toLowerCase();
};

/**
 * Trich xuat tat ca cac chuoi co the tim kiem tu thiet bi
 * @param {Object} deviceItem - Thong tin thiet bi
 * @returns {string[]} - Mang cac token tim kiem
 */
export const extractDeviceSearchableTokens = (deviceItem) => {
    if (!deviceItem || typeof deviceItem !== 'object') return [];
    const tokens = [];
    const addToken = (value) => {
        if (value != null && typeof value === 'string' && value.trim()) {
            tokens.push(value.trim());
        }
    };

    // 1. Bien so xe cac dinh dang
    addToken(deviceItem.license_plate);
    addToken(deviceItem.plate);
    addToken(deviceItem.plate_number);

    // 2. Ten xe & ma thiet bi
    addToken(deviceItem.name);
    addToken(deviceItem.vehicle_name);
    addToken(deviceItem.code);

    // 3. IMEI & So dien thoai
    addToken(deviceItem.imei);
    addToken(deviceItem.phone_number);
    addToken(deviceItem.phone);
    addToken(deviceItem.sim_phone_number);

    // 4. Tai xe (ho tro ca dang string hoac object)
    if (typeof deviceItem.driver === 'string') {
        addToken(deviceItem.driver);
    } else if (deviceItem.driver && typeof deviceItem.driver === 'object') {
        addToken(deviceItem.driver.name);
        addToken(deviceItem.driver.fullName);
        addToken(deviceItem.driver.phone);
    }
    addToken(deviceItem.driver_name);

    // 5. Loai xe & Model (Dat Bike Quantum, Quantum S2, v.v.)
    if (deviceItem.vehicle_category_id?.name) addToken(deviceItem.vehicle_category_id.name);
    if (deviceItem.vehicle_category_id?.model) addToken(deviceItem.vehicle_category_id.model);
    if (deviceItem.device_category_id?.name) addToken(deviceItem.device_category_id.name);
    if (deviceItem.device_category_id?.code) addToken(deviceItem.device_category_id.code);

    // 6. So khung & Ghi chu
    addToken(deviceItem.chassis_number);
    addToken(deviceItem.note);

    return tokens;
};

/**
 * Tinh khoang cach Levenshtein giua 2 chuoi ky tu
 */
const calculateLevenshteinDistance = (firstString, secondString) => {
    const lengthFirst = firstString.length;
    const lengthSecond = secondString.length;
    const distanceMatrix = Array.from({ length: lengthFirst + 1 }, () => new Array(lengthSecond + 1).fill(0));

    for (let i = 0; i <= lengthFirst; i++) distanceMatrix[i][0] = i;
    for (let j = 0; j <= lengthSecond; j++) distanceMatrix[0][j] = j;

    for (let i = 1; i <= lengthFirst; i++) {
        for (let j = 1; j <= lengthSecond; j++) {
            const substitutionCost = firstString[i - 1] === secondString[j - 1] ? 0 : 1;
            distanceMatrix[i][j] = Math.min(
                distanceMatrix[i - 1][j] + 1,
                distanceMatrix[i][j - 1] + 1,
                distanceMatrix[i - 1][j - 1] + substitutionCost
            );
        }
    }
    return distanceMatrix[lengthFirst][lengthSecond];
};

/**
 * Kiem tra xem mot thiet bi co khop voi tu khoa tim kiem hay khong
 * @param {Object} deviceItem - Thiet bi can kiem tra
 * @param {string} searchKeyword - Tu khoa tim kiem do nguoi dung nhap
 * @param {Object} options - Tuy chon { allowFuzzy: boolean }
 * @returns {boolean} - True neu khop
 */
export const matchVehicleSearch = (deviceItem, searchKeyword, options = {}) => {
    if (!deviceItem) return false;
    if (!searchKeyword || typeof searchKeyword !== 'string' || !searchKeyword.trim()) {
        return true;
    }

    const { allowFuzzy = true } = options;
    const trimmedInput = searchKeyword.trim().toLowerCase();
    const canonicalInput = canonicalizeVehicleSearch(trimmedInput);
    const tokens = extractDeviceSearchableTokens(deviceItem);

    if (!tokens.length) return false;

    // 1. Kiem tra so khop chuoi goc (nhanh)
    for (const token of tokens) {
        if (token.toLowerCase().includes(trimmedInput)) return true;
    }

    if (!canonicalInput) return true;

    // 2. Kiem tra so khop chuoi chuan hoa (triet tieu dau gach, cham, khoang cach, dau tieng Viet)
    for (const token of tokens) {
        const canonicalToken = canonicalizeVehicleSearch(token);
        if (canonicalToken.includes(canonicalInput)) return true;
    }

    // 3. Ho tro tim kiem da tu (Multi-token search: VD '50AD 394' hoac 'Dat Bike 50')
    const words = trimmedInput.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
        const allWordsMatch = words.every((word) => {
            const canonicalWord = canonicalizeVehicleSearch(word);
            return tokens.some((token) => {
                const canonicalToken = canonicalizeVehicleSearch(token);
                return canonicalToken.includes(canonicalWord);
            });
        });
        if (allWordsMatch) return true;
    }

    // 4. Typo-tolerant fuzzy matching (Chong go nham 1-2 ky tu nhu 50AB thay vi 50AD/50AE)
    if (allowFuzzy && canonicalInput.length >= 3) {
        const maxDistance = canonicalInput.length >= 7 ? 2 : 1;
        const queryLength = canonicalInput.length;

        for (const token of tokens) {
            const canonicalToken = canonicalizeVehicleSearch(token);
            if (canonicalToken.length < queryLength - 1) continue;

            const searchWindowCount = Math.max(1, canonicalToken.length - queryLength + 1);
            for (let i = 0; i < searchWindowCount; i++) {
                const tokenSlice = canonicalToken.substr(i, queryLength);
                if (calculateLevenshteinDistance(tokenSlice, canonicalInput) <= maxDistance) {
                    return true;
                }
            }
        }
    }

    return false;
};
