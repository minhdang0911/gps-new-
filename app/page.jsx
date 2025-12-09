'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './MonitorPage.css';

import { getDevices, getDeviceInfo } from './lib/api/devices';
import { getBatteryStatusByImei } from './lib/api/batteryStatus';
import { getLastCruise } from './lib/api/cruise';

import markerIcon from './assets/marker-red.png';
import { useRouter, usePathname } from 'next/navigation';
import { message, Modal } from 'antd';
import { CheckCircleFilled, LockFilled } from '@ant-design/icons';

// 🔥 MQTT
import MqttConnector from './components/MqttConnector';

// 🔥 i18n giống StatusBar
import vi from './locales/vi.json';
import en from './locales/en.json';

const locales = { vi, en };

const { confirm } = Modal;

// Giữ nguyên nếu bạn vẫn muốn dùng 1 key chính ở nơi khác
const GOONG_API_KEY = process.env.NEXT_PUBLIC_GOONG_API_KEY;
// 🔑 MAPBOX
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
const VIETMAP_TOKEN = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
const TOMTOM_TOKEN = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
const TRACKASIA_KEY = process.env.NEXT_PUBLIC_TRACKASIA_API_KEY;
const OPENCAGE_KEY = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY; // 👈 thêm OpenCage

// ===============================
// 🔑 NHIỀU GOONG API KEY + XOAY VÒNG
// ===============================
const GOONG_KEYS = [
    process.env.NEXT_PUBLIC_GOONG_API_KEY,
    process.env.NEXT_PUBLIC_GOONG_API_KEY1,
    process.env.NEXT_PUBLIC_GOONG_API_KEY3,
    process.env.NEXT_PUBLIC_GOONG_API_KEY4,
    process.env.NEXT_PUBLIC_GOONG_API_KEY5,
    process.env.NEXT_PUBLIC_GOONG_API_KEY6,
    process.env.NEXT_PUBLIC_GOONG_API_KEY7,
].filter(Boolean);

const VIETMAP_KEYS = [
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY1,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY2,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY3,
    process.env.NEXT_PUBLIC_VIETMAP_API_KEY4,
];

let goongKeyIndex = 0;

const getCurrentGoongKey = () => {
    if (!GOONG_KEYS.length) return null;
    return GOONG_KEYS[goongKeyIndex % GOONG_KEYS.length];
};

const moveToNextGoongKey = () => {
    if (!GOONG_KEYS.length) return;
    goongKeyIndex = (goongKeyIndex + 1) % GOONG_KEYS.length;
};

// Chọn địa chỉ đẹp nhất từ Goong v2
const pickBestGoongV2Address = (results = []) => {
    if (!Array.isArray(results) || results.length === 0) return '';

    const poiCandidates = results.filter((r) => {
        const name = (r.name || '').trim();
        const addr = (r.address || r.formatted_address || '').trim();
        const formatted = (r.formatted_address || '').trim();
        const types = Array.isArray(r.types) ? r.types : [];

        const isHouseNumberType = types.includes('house_number');

        const startsWithDigit = /^\d/.test(name);

        return name && !startsWithDigit && name !== addr && name !== formatted && !isHouseNumberType;
    });

    const chosen = poiCandidates[0] || results[0];

    const name = (chosen.name || '').trim();
    const formatted = (chosen.formatted_address || '').trim();
    const addr = (chosen.address || '').trim();

    // Nếu formatted_address đã có đầy đủ (thường là "CÔNG TY..., 38-40 Đường...")
    if (formatted) return formatted;

    // Nếu không có formatted thì tự ghép
    if (name && addr) return `${name}, ${addr}`;
    if (addr) return addr;
    if (name) return name;

    return '';
};

// ✅ Goong có hỗ trợ language, nên cho nhận lang
// ✅ Goong v2 + xoay key + ưu tiên POI (công ty, cây xăng, nhà sách...)
const callGoongWithRotation = async (lat, lon, lang = 'vi') => {
    if (!GOONG_KEYS.length) return '';

    for (let i = 0; i < GOONG_KEYS.length; i++) {
        const apiKey = getCurrentGoongKey();
        if (!apiKey) break;

        try {
            const url =
                `https://rsapi.goong.io/v2/geocode?latlng=${lat},${lon}` +
                `&api_key=${apiKey}` +
                `&limit=2` + // như bạn test thấy ổn
                `&has_deprecated_administrative_unit=true` +
                `&language=${lang}`;

            const res = await fetch(url);

            // Nếu bị limit/quota/forbidden → chuyển qua key khác
            if (res.status === 429 || res.status === 403) {
                console.warn('Goong key bị limit hoặc forbidden, đổi key khác...');
                moveToNextGoongKey();
                continue;
            }

            if (!res.ok) {
                console.error('Goong v2 API error với key hiện tại:', res.status);
                moveToNextGoongKey();
                continue;
            }

            const data = await res.json();

            if (data.error || data.error_code) {
                console.error('Goong v2 trả error body:', data);
                if (data.error_code === 429 || data.error_code === 403) {
                    moveToNextGoongKey();
                    continue;
                }
            }

            const addr = pickBestGoongV2Address(data?.results || []);

            if (addr) {
                return addr;
            }

            // Không có địa chỉ → coi như fail, nhảy key
            moveToNextGoongKey();
        } catch (e) {
            console.error('Lỗi gọi Goong v2 với key hiện tại:', e);
            moveToNextGoongKey();
        }
    }

    // Nếu chạy hết vòng mà vẫn không có địa chỉ
    return '';
};

// ===============================
// 🔢 TÍNH KHOẢNG CÁCH 2 TỌA ĐỘ (MÉT)
// ===============================
const toRad = (deg) => (deg * Math.PI) / 180;

const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
    if (
        lat1 == null ||
        lon1 == null ||
        lat2 == null ||
        lon2 == null ||
        Number.isNaN(lat1) ||
        Number.isNaN(lon1) ||
        Number.isNaN(lat2) ||
        Number.isNaN(lon2)
    ) {
        return null;
    }

    const R = 6371000; // bán kính Trái đất (m)
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // mét
};

const toLocalDateTimeInput = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const MonitorPage = () => {
    // ----- LANG -----
    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);

    const isEnFromPath = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        return last === 'en';
    }, [pathname]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (isEnFromPath) {
            setIsEn(true);
            localStorage.setItem('iky_lang', 'en');
        } else {
            const saved = localStorage.getItem('iky_lang');
            setIsEn(saved === 'en');
        }
    }, [isEnFromPath]);

    const t = isEn ? locales.en.monitor : locales.vi.monitor;

    // ----- STATE GỐC -----
    const [leftTab, setLeftTab] = useState('monitor');
    const [showPopup, setShowPopup] = useState(false);
    const [detailTab, setDetailTab] = useState('status');
    const [LMap, setLMap] = useState(null);

    const [historyDeviceId, setHistoryDeviceId] = useState('');
    const [historyStart, setHistoryStart] = useState('');
    const [historyEnd, setHistoryEnd] = useState('');
    const [historyMessage, setHistoryMessage] = useState('');
    const [historyMessageType, setHistoryMessageType] = useState('');

    const [deviceList, setDeviceList] = useState([]);
    const [loadingDevices, setLoadingDevices] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [selectedDevice, setSelectedDevice] = useState(null);

    const [batteryStatus, setBatteryStatus] = useState(null);
    const [loadingBattery, setLoadingBattery] = useState(false);

    const [deviceInfo, setDeviceInfo] = useState(null);
    const [loadingDeviceInfo, setLoadingDeviceInfo] = useState(false);

    const [lastCruise, setLastCruise] = useState(null);
    const [loadingCruise, setLoadingCruise] = useState(false);
    const [cruiseError, setCruiseError] = useState(null);

    const [lockLoading, setLockLoading] = useState(false);
    const [lockError, setLockError] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);

    const [address, setAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [addressError, setAddressError] = useState(null);

    const [lat] = useState(10.7542506);
    const [lng] = useState(106.6170202);

    // 🔥 dữ liệu realtime từ MQTT
    const [liveTelemetry, setLiveTelemetry] = useState(null);
    const mqttClientRef = useRef(null);

    useEffect(() => {
        const loadLeaflet = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            setLMap(L);
        };
        loadLeaflet();
    }, []);

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const [markerScreenPos, setMarkerScreenPos] = useState(null);

    // ✅ lưu tọa độ cuối cùng đã dùng để gọi API địa chỉ
    const lastCoordsRef = useRef({ lat: null, lon: null });

    const router = useRouter();

    useEffect(() => {
        if (!LMap) return;

        const map = LMap.map('iky-map', {
            center: [lat, lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
        });

        mapRef.current = map;

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        const customIcon = LMap.icon({
            iconUrl: markerIcon.src,
            iconAnchor: [18, 36],
        });

        const marker = LMap.marker([lat, lng], { icon: customIcon }).addTo(map);
        markerRef.current = marker;

        const updatePopupPosition = () => {
            const point = map.latLngToContainerPoint(marker.getLatLng());
            setMarkerScreenPos(point);
        };

        updatePopupPosition();

        marker.on('click', () => setShowPopup(true));
        map.on('click', () => setShowPopup(false));
        map.on('move zoom', updatePopupPosition);

        // 🟢 quan trọng: sau khi zoom xong thì focus lại marker
        map.on('zoomend', () => {
            if (markerRef.current) {
                const pos = markerRef.current.getLatLng();
                // giữ nguyên level zoom hiện tại, chỉ pan về marker
                map.setView(pos, map.getZoom(), { animate: false });
            }
        });

        const handleResize = () => {
            map.invalidateSize();
            updatePopupPosition();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            map.off('move', updatePopupPosition);
            map.off('zoom', updatePopupPosition);
            map.off('zoomend'); // nhớ bỏ listener
            map.remove();
        };
    }, [LMap, lat, lng]);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const fetchDevices = async () => {
            try {
                setLoadingDevices(true);
                const res = await getDevices(token);
                setDeviceList(res.devices || []);
            } catch (err) {
                console.error('Load devices error:', err);
            } finally {
                setLoadingDevices(false);
            }
        };

        fetchDevices();
    }, []);

    // =============================
    // 🔥 PARSE TIM (YYMMDDHHmmSS)
    // =============================
    const parseTimToDate = (tim) => {
        if (!tim) return null;

        const s = String(tim);
        if (s.length !== 12) return null;

        const yy = s.slice(0, 2);
        const MM = s.slice(2, 4);
        const dd = s.slice(4, 6);
        const hh = s.slice(6, 8);
        const mm = s.slice(8, 10);
        const ss = s.slice(10, 12);

        const yyyy = 2000 + Number(yy);

        const date = new Date(`${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`);

        if (isNaN(date.getTime())) return null;
        return date;
    };

    useEffect(() => {
        if (deviceList.length > 0 && !selectedDevice) {
            handleSelectDevice(deviceList[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceList]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!deviceList.length) return;

        if (!historyDeviceId && deviceList[0]) {
            setHistoryDeviceId(deviceList[0]._id);
        }

        if (!historyStart || !historyEnd) {
            const now = new Date();

            const start = new Date(now);
            start.setHours(0, 0, 0, 0);

            const end = new Date(now);
            end.setHours(23, 59, 0, 0);

            setHistoryStart(toLocalDateTimeInput(start));
            setHistoryEnd(toLocalDateTimeInput(end));
        }
    }, [deviceList, historyDeviceId, historyStart, historyEnd]);

    // =============================
    // 🔄 FETCH ADDRESS (Goong → VietMap → TrackAsia → OpenCage → TomTom → Mapbox → Nominatim)
    // =============================
    const fetchAddress = async (latVal, lonVal) => {
        if (latVal == null || lonVal == null) return;

        setLoadingAddress(true);
        setAddressError(null);

        const latNum = Number(latVal);
        const lonNum = Number(lonVal);

        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
            setLoadingAddress(false);
            setAddress('');
            setAddressError(t.error.address);
            return;
        }

        const lang = isEn ? 'en' : 'vi';

        // 1️⃣ Goong (xoay key, có language theo web)
        const tryGoong = async () => {
            try {
                const addr = await callGoongWithRotation(latNum, lonNum, lang);
                return addr || '';
            } catch (e) {
                console.error('Goong error:', e);
                return '';
            }
        };

        // 2️⃣ VietMap (api.vnmap.com.vn)
        const tryVietMap = async () => {
            if (!VIETMAP_KEYS.length) return '';

            for (let i = 0; i < VIETMAP_KEYS.length; i++) {
                const key = VIETMAP_KEYS[i];
                const url = `https://api.vnmap.com.vn/geocoding?latlng=${latNum},${lonNum}&key=${key}`;

                try {
                    const res = await fetch(url);

                    if (res.status === 403 || res.status === 429) {
                        console.warn(`VietMap key ${i} bị limit/quota/forbidden`);
                        continue;
                    }

                    if (!res.ok) {
                        console.warn(`VietMap key ${i} lỗi HTTP`, res.status);
                        continue;
                    }

                    const data = await res.json();
                    const addr = data?.results?.[0]?.formatted_address || '';

                    if (addr) {
                        console.log(`VietMap key ${i} OK`);
                        return addr;
                    } else {
                        console.warn(`VietMap key ${i} trả rỗng`);
                    }
                } catch (err) {
                    console.error(`VietMap key ${i} exception:`, err);
                }
            }

            return '';
        };

        // 3️⃣ TrackAsia
        const tryTrackAsia = async () => {
            if (!TRACKASIA_KEY) return '';

            const url = `https://maps.track-asia.com/api/v2/geocode/json?latlng=${latNum},${lonNum}&key=${TRACKASIA_KEY}`;

            try {
                const res = await fetch(url);

                if (!res.ok) {
                    console.warn('TrackAsia HTTP error:', res.status);
                    return '';
                }

                const data = await res.json();
                const addr = data?.results?.[0]?.formatted_address || '';
                return addr || '';
            } catch (e) {
                console.error('TrackAsia failed:', e);
                return '';
            }
        };

        // 4️⃣ OpenCage (có language theo web)
        const tryOpenCage = async () => {
            if (!OPENCAGE_KEY) return '';

            // q = "lat+lon", language: vi / en
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${latNum}+${lonNum}&key=${OPENCAGE_KEY}&language=${lang}`;

            try {
                const res = await fetch(url);

                if (!res.ok) {
                    console.warn('OpenCage HTTP error:', res.status);
                    return '';
                }

                const data = await res.json();
                const addr = data?.results?.[0]?.formatted || '';
                return addr || '';
            } catch (e) {
                console.error('OpenCage failed:', e);
                return '';
            }
        };

        // 5️⃣ TomTom
        const tryTomTom = async () => {
            if (!TOMTOM_TOKEN) return '';

            const ttLang = isEn ? 'en-US' : 'vi-VN';
            const url = `https://api.tomtom.com/search/2/reverseGeocode/${latNum},${lonNum}.json?key=${TOMTOM_TOKEN}&language=${ttLang}`;

            try {
                const res = await fetch(url);

                if (res.status === 429 || res.status === 403) {
                    console.warn('TomTom bị limit/quota/forbidden');
                    return '';
                }

                if (!res.ok) {
                    console.error('TomTom API error:', res.status);
                    return '';
                }

                const data = await res.json();
                const addr = data?.addresses?.[0]?.address?.freeformAddress || '';
                return addr || '';
            } catch (e) {
                console.error('TomTom failed:', e);
                return '';
            }
        };

        // 6️⃣ Mapbox
        const tryMapbox = async () => {
            if (!MAPBOX_TOKEN) return '';

            const mbLang = isEn ? 'en' : 'vi';
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lonNum},${latNum}.json?access_token=${MAPBOX_TOKEN}&language=${mbLang}&limit=1`;

            try {
                const res = await fetch(url);

                if (res.status === 429 || res.status === 403) {
                    console.warn('Mapbox bị limit/quota/forbidden');
                    return '';
                }

                if (!res.ok) {
                    console.error('Mapbox API error:', res.status);
                    return '';
                }

                const data = await res.json();
                const addr = data?.features?.[0]?.place_name || '';
                return addr || '';
            } catch (e) {
                console.error('Mapbox failed:', e);
                return '';
            }
        };

        // 7️⃣ Nominatim (OSM)
        const tryNominatim = async () => {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&zoom=18&addressdetails=1&accept-language=${lang}`;

            try {
                const res = await fetch(url);

                if (!res.ok) {
                    console.error('Nominatim error status:', res.status);
                    return '';
                }

                const data = await res.json();
                const addr = data?.display_name || '';
                return addr || '';
            } catch (e) {
                console.error('Nominatim failed:', e);
                return '';
            }
        };

        // 🔁 chạy lần lượt theo thứ tự ưu tiên
        try {
            const providers = [tryGoong, tryVietMap, tryTrackAsia, tryOpenCage, tryTomTom, tryMapbox, tryNominatim];

            let addr = '';
            for (const fn of providers) {
                addr = await fn();
                if (addr) break;
            }

            if (addr) {
                setAddress(addr);
            } else {
                setAddress('');
                setAddressError(t.error.address);
            }
        } catch (err) {
            console.error('Fetch address error (all providers):', err);
            setAddress('');
            setAddressError(t.error.address);
        } finally {
            setLoadingAddress(false);
        }
    };

    const publishControlCommand = (payload) => {
        if (!selectedDevice || !selectedDevice.imei) {
            const msgText = t.error.missingDeviceOrImei;
            setLockError(msgText);
            message.error(msgText);
            return;
        }

        const client = mqttClientRef.current;
        if (!client) {
            const msgText = t.error.mqttNotReady;
            setLockError(msgText);
            message.error(msgText);
            return;
        }

        const topic = `device/${selectedDevice.imei}/control`;

        try {
            client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) {
                    console.error('❌ Publish control error:', err);
                    const msgText = t.error.controlFailed;
                    setLockError(msgText);
                    message.error(msgText);
                } else {
                    console.log('📤 Đã gửi lệnh control:', topic, payload);
                    setLockError(null);
                }
            });
        } catch (e) {
            console.error('❌ Publish exception:', e);
            const msgText = t.error.controlException;
            setLockError(msgText);
            message.error(msgText);
        }
    };

    const filteredDevices = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return deviceList.filter((d) => {
            const plate = (d.license_plate || '').toLowerCase();
            const imei = (d.imei || '').toLowerCase();
            const phone = (d.phone_number || '').toLowerCase();

            const matchSearch =
                !keyword || plate.includes(keyword) || imei.includes(keyword) || phone.includes(keyword);

            const isOnline = d.status === 10;
            let matchStatus = true;
            if (statusFilter === 'online') matchStatus = isOnline;
            if (statusFilter === 'offline') matchStatus = !isOnline;

            return matchSearch && matchStatus;
        });
    }, [deviceList, searchText, statusFilter]);

    const handleSelectDevice = async (device) => {
        setSelectedDevice(device);
        setShowPopup(true);

        // reset MQTT data khi đổi xe
        setLiveTelemetry(null);

        const token = localStorage.getItem('accessToken');
        if (!token || !device?.imei) {
            setBatteryStatus(null);
            setDeviceInfo(null);
            setLastCruise(null);
            setCruiseError(t.error.missingTokenOrImei);
            return;
        }

        setBatteryStatus(null);
        setDeviceInfo(null);
        setLastCruise(null);
        setCruiseError(null);
        setAddress('');
        setAddressError(null);
        lastCoordsRef.current = { lat: null, lon: null };

        try {
            setLoadingBattery(true);
            const res = await getBatteryStatusByImei(token, device.imei);
            setBatteryStatus(res?.batteryStatus || null);
        } catch {
            setBatteryStatus(null);
        } finally {
            setLoadingBattery(false);
        }

        try {
            setLoadingDeviceInfo(true);
            const info = await getDeviceInfo(token, device._id);
            setDeviceInfo(info || null);
        } catch {
            setDeviceInfo(null);
        } finally {
            setLoadingDeviceInfo(false);
        }

        try {
            setLoadingCruise(true);
            const cruise = await getLastCruise(token, device.imei);

            if (!cruise || cruise.error) {
                setLastCruise(null);
                setCruiseError(t.error.noTripData);
            } else {
                setLastCruise(cruise);
                setCruiseError(null);

                if (mapRef.current && markerRef.current && cruise.lat && cruise.lon && LMap) {
                    const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
                    markerRef.current.setLatLng(newLatLng);
                    mapRef.current.setView(newLatLng, 16);

                    // ✅ cập nhật tọa độ đã reverse geocode lần cuối
                    lastCoordsRef.current = { lat: cruise.lat, lon: cruise.lon };
                    fetchAddress(cruise.lat, cruise.lon);
                }
            }
        } catch {
            setLastCruise(null);
            setCruiseError(t.error.tripLoadFailed);
        } finally {
            setLoadingCruise(false);
        }
    };

    const handleLockDevice = () => {
        publishControlCommand({ sos: 1 });
        message.success(t.control.lockSuccessToast);
    };

    const handleUnlockDevice = () => {
        publishControlCommand({ sos: 0 });
        message.success(t.control.unlockSuccessToast);
    };

    const handleConfirmLock = () => {
        if (!selectedDevice) return;
        const plate = selectedDevice.license_plate || selectedDevice.imei || t.common.deviceFallback;

        confirm({
            title: t.control.confirmLockTitle,
            content: t.control.confirmLockContent.replace('{plate}', plate),
            okText: t.control.confirmLockOk,
            cancelText: t.control.confirmCancel,
            onOk: () => {
                setPendingAction('lock');
                setLockLoading(true);
                handleLockDevice();
                setLockLoading(false);
                setPendingAction(null);
            },
        });
    };

    const handleConfirmUnlock = () => {
        if (!selectedDevice) return;
        const plate = selectedDevice.license_plate || selectedDevice.imei || t.common.deviceFallback;

        confirm({
            title: t.control.confirmUnlockTitle,
            content: t.control.confirmUnlockContent.replace('{plate}', plate),
            okText: t.control.confirmUnlockOk,
            cancelText: t.control.confirmCancel,
            onOk: () => {
                setPendingAction('unlock');
                setLockLoading(true);
                handleUnlockDevice();
                setLockLoading(false);
                setPendingAction(null);
            },
        });
    };

    const isConnected = selectedDevice?.status === 10;

    // helper normalize number
    const toNumberOrNull = (val) => {
        if (val == null) return null;
        const n = Number(val);
        return Number.isNaN(n) ? null : n;
    };

    // 🔥 nhận MQTT → update liveTelemetry + map (kèm check tọa độ + khoảng cách để tránh gọi API thừa)
    const handleMqttMessage = (topic, data) => {
        if (!selectedDevice) return;

        const arr = topic.split('/');
        if (arr[1] !== selectedDevice.imei) return;

        if (!data || typeof data !== 'object') return;
        setLiveTelemetry((prev) => {
            const updated = { ...(prev || {}), ...data };

            const isTelemetryPacket = 'ev' in data;

            // Nếu là gói status (không có ev)
            if (!isTelemetryPacket) {
                // Xóa sos nếu gói mới không có sos
                if (!('sos' in data) && 'sos' in updated) {
                    delete updated.sos;
                }

                // Xóa acc nếu gói mới không có acc
                if (!('acc' in data) && 'acc' in updated) {
                    delete updated.acc;
                }
            }

            return updated;
        });

        // ✅ Chỉ handle tọa độ khi có lat, lon
        if (data.lat != null && data.lon != null && LMap && mapRef.current && markerRef.current) {
            const latNum = Number(data.lat);
            const lonNum = Number(data.lon);

            if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
                const pos = LMap.latLng(latNum, lonNum);
                markerRef.current.setLatLng(pos);
                mapRef.current.setView(pos, 16);

                const prev = lastCoordsRef.current;
                const MIN_MOVE_METERS = 15; // 👈 ngưỡng di chuyển tối thiểu để gọi lại API (chỉnh tùy ý)

                let tooClose = false;

                if (prev.lat != null && prev.lon != null) {
                    const dist = getDistanceMeters(prev.lat, prev.lon, latNum, lonNum);
                    if (dist != null && dist < MIN_MOVE_METERS) {
                        tooClose = true;
                    }
                }

                // 🔥 Chỉ gọi API reverse geocode nếu di chuyển đủ xa
                if (!tooClose) {
                    lastCoordsRef.current = { lat: latNum, lon: lonNum };
                    fetchAddress(latNum, lonNum);
                }
            }
        }
    };

    const DEVICE_FIELDS = [
        'tim',
        'lat',
        'lon',
        'spd',
        'dst',
        'gps',
        'sos',
        'acc',
        'mov',
        'alm',
        'pro',
        'vib',
        'mil',
        'gic',
        'onl',
        'fwr',
        'vgp',
    ];

    const BATTERY_FIELDS = ['soc', 'soh', 'tavg', 'tmax', 'tmin', 'vavg', 'vmax', 'vmin', 'cur', 'ckw', 'ckwh', 'an1'];

    // 🔋 dùng MQTT override batteryStatus
    const renderBatteryInfo = () => {
        const src = liveTelemetry || {};
        const bs = batteryStatus || {};

        const soc = src.soc ?? bs.soc;
        const soh = src.soh ?? bs.soh;
        const voltage = src.vavg ?? src.vmax ?? src.vmin ?? bs.voltage;
        const temp = src.tavg ?? src.tmax ?? bs.temperature;
        const currentRaw = src.cur ?? bs.current;

        const formatAmp = (val) => {
            const n = toNumberOrNull(val);
            if (n == null) return '--';
            const abs = Math.abs(n);
            const s = abs.toFixed(2).replace('.', ',');
            return `${s}A`;
        };

        let mode = t.battery.unknown;
        let currentLine = t.battery.currentLineDefault;

        const cur = toNumberOrNull(currentRaw);

        if (cur == null) {
            mode = t.battery.unknown;
            currentLine = t.battery.currentLineDefault;
        } else if (cur > 0) {
            mode = t.battery.charging;
            currentLine = `${t.battery.chargeCurrent} ${formatAmp(cur)}`;
        } else if (cur < 0) {
            mode = t.battery.discharging;
            currentLine = `${t.battery.dischargeCurrent} ${formatAmp(cur)}`;
        } else {
            mode = t.battery.idle;
            currentLine = t.battery.currentIdle;
        }

        const updatedAt = src.tim
            ? parseTimToDate(src.tim)?.toLocaleString()
            : bs.updatedAt
            ? new Date(bs.updatedAt).toLocaleString()
            : '--';

        return (
            <>
                <div>
                    {t.battery.imei} {selectedDevice?.imei}
                </div>
                <div>
                    {t.battery.voltage} {voltage ?? '--'} V
                </div>
                <div>{currentLine}</div>
                <div>
                    {t.battery.status} {mode}
                </div>
                <div>
                    {t.battery.soc} {soc ?? '--'}%
                </div>
                <div>
                    {t.battery.soh} {soh ?? '--'}%
                </div>
                <div>
                    {t.battery.temperature} {temp ?? '--'}°C
                </div>
                <div>
                    {t.battery.updatedAt} {updatedAt}
                </div>
            </>
        );
    };

    const renderStatusInfo = () => {
        if (!selectedDevice) return <>{t.statusInfo.pleaseSelect}</>;

        const info = deviceInfo || selectedDevice;
        const src = liveTelemetry || lastCruise || {};
        const mqttSrc = liveTelemetry || {};

        const speed = mqttSrc.spd;
        const distance = mqttSrc.dst;

        const timeStr = src.tim ? parseTimToDate(src.tim)?.toLocaleString() : '--';
        const fwr = mqttSrc.fwr ?? src.fwr;

        const latVal = src.lat;
        const lonVal = src.lon;

        const accValNum = toNumberOrNull(mqttSrc.acc);
        const spdNum = toNumberOrNull(mqttSrc.spd);
        const vgpNum = toNumberOrNull(mqttSrc.vgp);
        const gpsValNum = toNumberOrNull(mqttSrc.gps);

        let machineStatus = '--';
        if (accValNum === 1) {
            machineStatus = t.statusInfo.engineOff;
        } else {
            machineStatus = t.statusInfo.engineOn;
        }

        let vehicleStatus = '--';

        if (accValNum === 1) {
            vehicleStatus = t.statusInfo.vehicleParking;
        } else {
            let usedSpeed = null;
            if (spdNum != null) usedSpeed = spdNum;
            else if (vgpNum != null) usedSpeed = vgpNum;

            if (usedSpeed == null) {
                vehicleStatus = t.statusInfo.vehicleUnknown;
            } else if (usedSpeed > 0) {
                vehicleStatus = t.statusInfo.vehicleRunning.replace('{speed}', String(usedSpeed));
            } else {
                vehicleStatus = t.statusInfo.vehicleParking;
            }
        }

        return (
            <>
                <div>
                    {t.statusInfo.plate} {info.license_plate || '---'}
                </div>
                <div>
                    {t.statusInfo.version} {fwr || '---'}
                </div>
                <div>
                    {t.statusInfo.vehicleType} {info.vehicle_category_id?.name || '---'}
                </div>
                <div>
                    {t.statusInfo.deviceType} {info.device_category_id?.name || '---'}
                </div>
                <div>
                    {t.statusInfo.atTime} {timeStr}
                </div>

                <div>
                    {t.statusInfo.engineStatus} {machineStatus}
                </div>
                <div>
                    {t.statusInfo.vehicleStatus} {vehicleStatus}
                </div>

                {speed != null && (
                    <div>
                        {t.statusInfo.speed} {speed} km/h
                    </div>
                )}
                {distance != null && (
                    <div>
                        {t.statusInfo.distance} {distance} km
                    </div>
                )}

                <div className="iky-monitor__location-row">
                    <span className="iky-monitor__location-label">{t.statusInfo.location}</span>
                    <span className="iky-monitor__location-text">{address || '--'}</span>
                </div>
                <div>
                    {t.statusInfo.coordinate}{' '}
                    {latVal != null && lonVal != null ? (
                        <>
                            {`${latVal}, ${lonVal}`}{' '}
                            {gpsValNum === 1 && <span style={{ color: 'red', fontWeight: 600 }}>(*)</span>}
                        </>
                    ) : (
                        '--'
                    )}
                </div>
            </>
        );
    };

    const handleSaveHistoryFilter = () => {
        setHistoryMessage('');
        setHistoryMessageType('');

        if (!historyDeviceId || !historyStart || !historyEnd) {
            setHistoryMessage(t.history.errorMissing);
            setHistoryMessageType('error');
            return;
        }

        const startDate = new Date(historyStart);
        const endDate = new Date(historyEnd);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            setHistoryMessage(t.history.errorInvalidDate);
            setHistoryMessageType('error');
            return;
        }

        if (endDate < startDate) {
            setHistoryMessage(t.history.errorEndBeforeStart);
            setHistoryMessageType('error');
            return;
        }

        const filter = {
            deviceId: historyDeviceId,
            imei: deviceList.find((d) => d._id === historyDeviceId)?.imei || '',
            start: historyStart,
            end: historyEnd,
        };
        try {
            localStorage.setItem('iky_cruise_filter', JSON.stringify(filter));
            router.push('/cruise');
            setHistoryMessage(t.history.saveSuccess);
            setHistoryMessageType('success');
        } catch (e) {
            setHistoryMessage(t.history.saveFailed);
            setHistoryMessageType('error');
        }
    };

    const curStatus = selectedDevice?.status;
    const isLocked = liveTelemetry?.sos === 1 || liveTelemetry?.sos === '1';
    let deviceStatusText = isLocked ? t.control.statusActivated : t.control.statusNotActivated;
    const deviceStatusClass = isLocked ? 'iky-monitor__tag-red' : 'iky-monitor__tag-green';

    return (
        <>
            <MqttConnector
                imei={selectedDevice?.imei}
                onMessage={handleMqttMessage}
                onClientReady={(client) => {
                    mqttClientRef.current = client;
                }}
            />

            <div className="iky-monitor">
                {/* LEFT */}
                <aside className="iky-monitor__left">
                    <div
                        className={
                            'iky-monitor__left-card' + (leftTab === 'monitor' ? ' iky-monitor__left-card--full' : '')
                        }
                    >
                        <div className="iky-monitor__left-tabs">
                            <button
                                className={
                                    'iky-monitor__left-tab' +
                                    (leftTab === 'monitor' ? ' iky-monitor__left-tab--active' : '')
                                }
                                onClick={() => setLeftTab('monitor')}
                            >
                                {t.tabs.monitor}
                            </button>
                            <button
                                className={
                                    'iky-monitor__left-tab' +
                                    (leftTab === 'history' ? ' iky-monitor__left-tab--active' : '')
                                }
                                onClick={() => setLeftTab('history')}
                            >
                                {t.tabs.history}
                            </button>
                        </div>

                        {leftTab === 'monitor' && (
                            <div className="iky-monitor__left-body">
                                <div className="iky-monitor__left-section">
                                    <div className="iky-monitor__left-label">{t.filter.searchLabel}</div>
                                    <input
                                        className="iky-monitor__input"
                                        placeholder={t.filter.searchPlaceholder}
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                    />
                                </div>

                                <div className="iky-monitor__left-section">
                                    <div className="iky-monitor__left-label">{t.filter.statusLabel}</div>
                                    <select
                                        className="iky-monitor__select"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="all">{t.filter.statusAll}</option>
                                        <option value="online">{t.filter.statusOnline}</option>
                                        <option value="offline">{t.filter.statusOffline}</option>
                                    </select>
                                </div>

                                <div className="iky-monitor__left-section iky-monitor__left-section--list">
                                    <div className="iky-monitor__left-label">{t.list.label}</div>

                                    <div className="iky-monitor__device-list">
                                        {loadingDevices && <div className="iky-loading">{t.list.loading}</div>}

                                        {!loadingDevices && filteredDevices.length === 0 && (
                                            <div className="iky-monitor__empty">{t.list.empty}</div>
                                        )}

                                        {!loadingDevices &&
                                            filteredDevices.map((d) => {
                                                const isOnline = d.status === 10;
                                                const isActive = selectedDevice?._id === d._id;
                                                return (
                                                    <div
                                                        key={d._id}
                                                        className={
                                                            'iky-monitor__device-item' +
                                                            (isActive ? ' iky-monitor__device-item--active' : '')
                                                        }
                                                        onClick={() => handleSelectDevice(d)}
                                                    >
                                                        <div className="plate">
                                                            {d.license_plate || t.list.unknownPlate}
                                                        </div>
                                                        <div className="imei">IMEI: {d.imei}</div>
                                                        <div className="phone">
                                                            {t.list.phoneLabel} {d.phone_number}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {leftTab === 'history' && (
                            <div className="iky-monitor__left-body">
                                <div className="iky-monitor__left-section">
                                    <div className="iky-monitor__left-label">{t.history.selectVehicleLabel}</div>
                                    <select
                                        className="iky-monitor__select"
                                        value={historyDeviceId}
                                        onChange={(e) => setHistoryDeviceId(e.target.value)}
                                    >
                                        <option value="">{t.history.selectVehiclePlaceholder}</option>
                                        {deviceList.map((d) => (
                                            <option key={d._id} value={d._id}>
                                                {(d.license_plate || d.imei || t.history.unknown).trim()}
                                                {d.phone_number ? ` - ${d.phone_number}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="iky-monitor__left-section">
                                    <div className="iky-monitor__left-label">{t.history.fromLabel}</div>
                                    <input
                                        type="datetime-local"
                                        className="iky-monitor__input"
                                        value={historyStart}
                                        onChange={(e) => setHistoryStart(e.target.value)}
                                    />
                                </div>

                                <div className="iky-monitor__left-section">
                                    <div className="iky-monitor__left-label">{t.history.toLabel}</div>
                                    <input
                                        type="datetime-local"
                                        className="iky-monitor__input"
                                        value={historyEnd}
                                        onChange={(e) => setHistoryEnd(e.target.value)}
                                    />
                                </div>

                                <button className="iky-monitor__primary-btn" onClick={handleSaveHistoryFilter}>
                                    {t.history.saveButton}
                                </button>

                                {historyMessage && (
                                    <div
                                        className={
                                            'iky-monitor__alert ' +
                                            (historyMessageType === 'error'
                                                ? 'iky-monitor__alert--error'
                                                : 'iky-monitor__alert--success')
                                        }
                                    >
                                        {historyMessage}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="iky-monitor__center">
                    <div className="iky-monitor__map">
                        <div id="iky-map" className="iky-monitor__map-inner" />

                        {markerScreenPos && showPopup && (
                            <div
                                className="iky-monitor__popup-wrapper"
                                style={{ left: markerScreenPos.x, top: markerScreenPos.y }}
                            >
                                <div className="iky-monitor__popup">
                                    <div className="iky-monitor__popup-tabs">
                                        <button
                                            className={
                                                'iky-monitor__popup-tab' +
                                                (detailTab === 'status' ? ' iky-monitor__popup-tab--active' : '')
                                            }
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailTab('status');
                                            }}
                                        >
                                            {t.tabsDetail.status}
                                        </button>
                                        <button
                                            className={
                                                'iky-monitor__popup-tab' +
                                                (detailTab === 'control' ? ' iky-monitor__popup-tab--active' : '')
                                            }
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailTab('control');
                                            }}
                                        >
                                            {t.tabsDetail.control}
                                        </button>
                                        <button
                                            className={
                                                'iky-monitor__popup-tab' +
                                                (detailTab === 'battery' ? ' iky-monitor__popup-tab--active' : '')
                                            }
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDetailTab('battery');
                                            }}
                                        >
                                            {t.tabsDetail.battery}
                                        </button>
                                    </div>

                                    <div className="iky-monitor__popup-body">
                                        {detailTab === 'status' && (
                                            <div className="iky-monitor__popup-col">{renderStatusInfo()}</div>
                                        )}

                                        {detailTab === 'control' && (
                                            <div className="iky-monitor__popup-col">
                                                <div className="iky-monitor__control-row">
                                                    <span>{t.control.connectionStatus}</span>
                                                    <div
                                                        className={
                                                            'iky-monitor__connection ' +
                                                            (isConnected
                                                                ? 'iky-monitor__connection--on'
                                                                : 'iky-monitor__connection--off')
                                                        }
                                                    >
                                                        <span className="iky-monitor__connection-icon">✓</span>
                                                        <span className="iky-monitor__connection-text">
                                                            {isConnected
                                                                ? t.control.connectionOn
                                                                : t.control.connectionOff}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="iky-monitor__control-row">
                                                    <span>{t.control.emergencyStop}</span>

                                                    <div className={`iky-status-badge ${deviceStatusClass}`}>
                                                        {isLocked ? (
                                                            <LockFilled className="iky-status-icon" />
                                                        ) : (
                                                            <CheckCircleFilled className="iky-status-icon" />
                                                        )}
                                                        <span>{deviceStatusText}</span>
                                                    </div>
                                                </div>

                                                <div className="iky-monitor__control-row">
                                                    <span>{t.control.lockDevice}</span>
                                                    <button
                                                        className="iky-monitor__secondary-btn"
                                                        onClick={handleConfirmLock}
                                                        disabled={lockLoading}
                                                    >
                                                        {lockLoading && pendingAction === 'lock'
                                                            ? t.control.locking
                                                            : t.control.lockButton}
                                                    </button>
                                                </div>

                                                <div className="iky-monitor__control-row">
                                                    <span>{t.control.unlockDevice}</span>
                                                    <button
                                                        className="iky-monitor__secondary-btn"
                                                        onClick={handleConfirmUnlock}
                                                        disabled={lockLoading}
                                                    >
                                                        {lockLoading && pendingAction === 'unlock'
                                                            ? t.control.unlocking
                                                            : t.control.unlockButton}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {detailTab === 'battery' && (
                                            <div className="iky-monitor__popup-col">{renderBatteryInfo()}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {showPopup && detailTab === 'battery' && (
                    <aside className="iky-monitor__right">
                        <h4 className="iky-monitor__right-title">{t.rightPanel.title}</h4>
                        <div className="iky-monitor__battery-box">{renderBatteryInfo()}</div>
                    </aside>
                )}
            </div>
        </>
    );
};

export default MonitorPage;
