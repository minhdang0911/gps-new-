const getDerivedMasterSalt = () => {
    const parts = [
        String.fromCharCode(69, 86, 45, 71, 80, 83),
        String.fromCharCode(65, 69, 83, 50, 53, 54),
        String.fromCharCode(78, 69, 86, 69, 82),
        String.fromCharCode(75, 73, 67, 75),
        String.fromCharCode(76, 79, 71, 73, 78),
        String.fromCharCode(72, 79, 78, 68, 65),
        String.fromCharCode(50, 48, 50, 54),
    ];
    return parts.join('-');
};

const GPS_SALT = getDerivedMasterSalt();
const STORAGE_KEY = 'ev_gps_secure_session';
const COOKIE_NAME = 'ev_gps_sec_sess';
const LEGACY_STORAGE_KEYS = ['iky_secure_session'];
const LEGACY_COOKIE_NAMES = ['iky_sec_sess'];
const SESSION_MAX_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const utf8Encode = (str) => new TextEncoder().encode(str);
const utf8Decode = (bytes) => new TextDecoder().decode(bytes);

const bytesToBase64 = (bytes) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToBytes = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const rc4Crypt = (keyBytes, dataBytes) => {
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + keyBytes[i % keyBytes.length]) & 255;
        const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }
    let i = 0;
    j = 0;
    for (let k = 0; k < 768; k++) {
        i = (i + 1) & 255;
        j = (j + s[i]) & 255;
        const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }
    const out = new Uint8Array(dataBytes.length);
    for (let k = 0; k < dataBytes.length; k++) {
        i = (i + 1) & 255;
        j = (j + s[i]) & 255;
        const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
        out[k] = dataBytes[k] ^ s[(s[i] + s[j]) & 255];
    }
    return out;
};

const getDeviceFingerprint = (includeScreen = true) => {
    if (typeof window === 'undefined') return 'server_seed';
    try {
        const nav = window.navigator || {};
        const scr = window.screen || {};

        let gpuRenderer = '';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
                }
            }
        } catch (_) {}

        let tz = '';
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (_) {}

        const components = [
            'v2',
            nav.userAgent || '',
            nav.language || '',
            nav.hardwareConcurrency || '',
            gpuRenderer,
            tz,
        ];

        if (includeScreen) {
            components.push(
                scr.width || '',
                scr.height || '',
                scr.colorDepth || '',
                window.devicePixelRatio || ''
            );
        }

        return components.join('||');
    } catch (_) {
        return 'fallback_seed';
    }
};

export const encryptSessionData = (data) => {
    try {
        if (!data) return null;
        const jsonStr = JSON.stringify(data);
        const iv = Math.random().toString(36).substring(2, 10);
        
        const hardwareKey = GPS_SALT + ':' + getDeviceFingerprint(true) + ':' + iv;
        const keyBytes = utf8Encode(hardwareKey);
        const dataBytes = utf8Encode(jsonStr);
        const cipherBytes = rc4Crypt(keyBytes, dataBytes);

        return `${iv}:${bytesToBase64(cipherBytes)}`;
    } catch (e) {
        return null;
    }
};

export const decryptSessionData = (encryptedStr) => {
    try {
        if (!encryptedStr || typeof encryptedStr !== 'string') return null;
        const parts = encryptedStr.split(':');
        if (parts.length !== 2) return null;
        const [iv, b64] = parts;
        const cipherBytes = base64ToBytes(b64);

        try {
            const key1 = GPS_SALT + ':' + getDeviceFingerprint(true) + ':' + iv;
            const dec1 = rc4Crypt(utf8Encode(key1), cipherBytes);
            const str1 = utf8Decode(dec1);
            const obj1 = JSON.parse(str1);
            if (obj1 && obj1.username && obj1.password) return obj1;
        } catch (_) {}

        try {
            const key2 = GPS_SALT + ':' + getDeviceFingerprint(false) + ':' + iv;
            const dec2 = rc4Crypt(utf8Encode(key2), cipherBytes);
            const str2 = utf8Decode(dec2);
            const obj2 = JSON.parse(str2);
            if (obj2 && obj2.username && obj2.password) return obj2;
        } catch (_) {}

        try {
            const key3 = GPS_SALT + ':' + iv;
            const dec3 = rc4Crypt(utf8Encode(key3), cipherBytes);
            const str3 = utf8Decode(dec3);
            const obj3 = JSON.parse(str3);
            if (obj3 && obj3.username && obj3.password) return obj3;
        } catch (_) {}

        return null;
    } catch (e) {
        return null;
    }
};

const setCookie = (name, value, days = 3650) => {
    if (typeof document === 'undefined') return;
    try {
        const date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;SameSite=Lax`;
    } catch (_) {}
};

const getCookie = (name) => {
    if (typeof document === 'undefined') return null;
    try {
        const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
        return matches ? decodeURIComponent(matches[1]) : null;
    } catch (_) {
        return null;
    }
};

const removeCookie = (name) => {
    if (typeof document === 'undefined') return;
    try {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
    } catch (_) {}
};

let inMemorySessionCache = null;

export const saveSecureSession = ({
    username,
    password,
    device = '',
    user = null,
    accessToken = null,
    refreshToken = null,
    savedAt = null,
    expiresAt = null,
}) => {
    if (!username || !password) return false;
    try {
        const now = Date.now();
        const payload = {
            username,
            password,
            device: device || (typeof window !== 'undefined' ? localStorage.getItem('device') : '') || '',
            user,
            accessToken,
            refreshToken,
            savedAt: savedAt || now,
            expiresAt: expiresAt || (now + SESSION_MAX_TTL_MS),
        };

        inMemorySessionCache = payload;

        const encrypted = encryptSessionData(payload);
        if (encrypted) {
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(STORAGE_KEY, encrypted);
                } catch (_) {}
                setCookie(COOKIE_NAME, encrypted, 3650);
            }
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
};

export const getSecureSession = () => {
    if (inMemorySessionCache && inMemorySessionCache.username && inMemorySessionCache.password) {
        if (inMemorySessionCache.expiresAt && Date.now() > inMemorySessionCache.expiresAt) {
            clearSecureSession();
            return null;
        }
        return inMemorySessionCache;
    }

    if (typeof window === 'undefined') return null;
    try {
        let encrypted = null;
        try {
            encrypted = localStorage.getItem(STORAGE_KEY);
        } catch (_) {}

        if (!encrypted) {
            for (const legKey of LEGACY_STORAGE_KEYS) {
                const legVal = localStorage.getItem(legKey);
                if (legVal) {
                    encrypted = legVal;
                    localStorage.setItem(STORAGE_KEY, encrypted);
                    localStorage.removeItem(legKey);
                    break;
                }
            }
        }

        if (!encrypted) {
            encrypted = getCookie(COOKIE_NAME);
            if (!encrypted) {
                for (const legCookie of LEGACY_COOKIE_NAMES) {
                    const legVal = getCookie(legCookie);
                    if (legVal) {
                        encrypted = legVal;
                        setCookie(COOKIE_NAME, encrypted, 3650);
                        removeCookie(legCookie);
                        break;
                    }
                }
            }
            if (encrypted) {
                localStorage.setItem(STORAGE_KEY, encrypted);
            }
        }

        if (!encrypted) return null;

        const session = decryptSessionData(encrypted);
        if (session && session.username && session.password) {
            if (session.expiresAt && Date.now() > session.expiresAt) {
                clearSecureSession();
                return null;
            }

            if (session.savedAt && Date.now() - session.savedAt > 7 * 24 * 60 * 60 * 1000) {
                saveSecureSession({
                    ...session,
                    savedAt: Date.now(),
                    expiresAt: Date.now() + SESSION_MAX_TTL_MS,
                });
            }

            inMemorySessionCache = session;
            return session;
        }
        return null;
    } catch (err) {
        return null;
    }
};

export const hasSecureSession = () => {
    const session = getSecureSession();
    return !!(session && session.username && session.password);
};

export const clearSecureSession = () => {
    inMemorySessionCache = null;
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(STORAGE_KEY);
        removeCookie(COOKIE_NAME);
        LEGACY_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
        LEGACY_COOKIE_NAMES.forEach((c) => removeCookie(c));
    } catch (_) {}
};
