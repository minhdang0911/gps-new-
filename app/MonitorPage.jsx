'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './MonitorPage.css';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getDevices, getDeviceInfo } from './lib/api/devices';
import { getBatteryStatusByImei } from './lib/api/batteryStatus';
import { getLastCruise } from './lib/api/cruise';

import markerIconStop from './assets/marker-red.webp';
import markerRun from './assets/marker-run.webp';
import markerRun50 from './assets/marker-run50.webp';
import markerRun80 from './assets/marker-run80.webp';

import { useRouter, usePathname } from 'next/navigation';
import { message, Modal, Skeleton } from 'antd';
import { CheckCircleFilled, LockFilled } from '@ant-design/icons';
import { reverseGeocodeAddress } from './lib/address/reverseGeocode';
import { parseTimToDate, toLocalDateTimeInput } from './util/time';
import { getDistanceMeters } from './util/geo';
import { toNumberOrNull } from './util/number';

import MqttConnector from './components/MqttConnector';

// i18n
import vi from './locales/vi.json';
import en from './locales/en.json';

const locales = { vi, en };
const { confirm } = Modal;

/** =========================
 *  Persist SOC (pin list bên trái)
 *  ========================= */
const SOC_BY_IMEI_KEY = 'iky_monitor_soc_by_imei_v1';

const loadSocCache = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(SOC_BY_IMEI_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === 'object' ? obj : {};
    } catch {
        return {};
    }
};

const saveSocCache = (obj) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SOC_BY_IMEI_KEY, JSON.stringify(obj));
    } catch {}
};

/** =========================
 *  Battery UI
 *  ========================= */
const clampSoc = (soc) => {
    const n = toNumberOrNull(soc);
    if (n == null) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
};

const BatteryBadge = ({ soc, showText = true, title, compact = true }) => {
    const s = clampSoc(soc);
    const level = s == null ? 'na' : s < 20 ? 'low' : s < 40 ? 'mid' : 'ok';

    return (
        <div className={`iky-battery-badge ${compact ? 'iky-battery-badge--compact' : ''}`} title={title || ''}>
            <div className={`iky-battery ${level}`}>
                <div className="iky-battery__fill" style={{ width: s == null ? '0%' : `${s}%` }} />
            </div>
            {showText && <span className={`iky-battery__text ${level}`}>{s == null ? '--' : `${s}%`}</span>}
        </div>
    );
};

const MonitorPage = () => {
    const router = useRouter();
    const pathname = usePathname() || '/';
    const queryClient = useQueryClient();

    // ===== token (client only) =====
    const token = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('accessToken') || '';
    }, []);

    // ----- LANG -----
    const [isEn, setIsEn] = useState(false);
    const [deprecatedAddress, setDeprecatedAddress] = useState('');
    const [role, setRole] = useState('');

    const lastMqttAtRef = useRef(0);
    const mqttSilenceTimerRef = useRef(null);
    const MQTT_SILENCE_MS = 60_000;

    // ✅ MQTT liveness
    const isMqttAlive = (lastMqttAtRef) => {
        const last = lastMqttAtRef.current;
        return !!last && Date.now() - last < MQTT_SILENCE_MS;
    };

    // Rule:
    // - MQTT alive  -> chỉ đọc liveTelemetry
    // - MQTT dead   -> fallback lastCruise -> batteryStatus (cho các field chung)
    const pickField = (field, { liveTelemetry, lastCruise, batteryStatus }, lastMqttAtRef) => {
        if (isMqttAlive(lastMqttAtRef)) return liveTelemetry?.[field];
        return lastCruise?.[field] ?? batteryStatus?.[field];
    };

    // ✅ ACC: chỉ MQTT hoặc lastCruise (KHÔNG batteryStatus)
    const pickAcc = ({ liveTelemetry, lastCruise }, lastMqttAtRef) => {
        if (isMqttAlive(lastMqttAtRef)) return liveTelemetry?.acc;
        return lastCruise?.acc;
    };

    // ✅ SPEED: chỉ MQTT hoặc lastCruise (ưu tiên spd rồi vgp) - KHÔNG batteryStatus
    const pickSpeed = ({ liveTelemetry, lastCruise }, lastMqttAtRef) => {
        if (isMqttAlive(lastMqttAtRef)) {
            return liveTelemetry?.spd ?? liveTelemetry?.vgp;
        }
        return lastCruise?.spd ?? lastCruise?.vgp;
    };

    // ✅ driver name helper (lấy từ API field `driver`)
    const getDriverName = (d) => {
        const raw = d?.driver;
        const s = typeof raw === 'string' ? raw.trim() : '';
        return s || '';
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const r = localStorage.getItem('role') || '';
        setRole(r);
    }, []);

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
    const NA_TEXT = isEn ? 'N/A' : 'Chưa rõ';

    // ----- UI STATE -----
    const [leftTab, setLeftTab] = useState('monitor');
    const [showPopup, setShowPopup] = useState(false);
    const [detailTab, setDetailTab] = useState('status');
    const [LMap, setLMap] = useState(null);

    const [historyDeviceId, setHistoryDeviceId] = useState('');
    const [historyStart, setHistoryStart] = useState('');
    const [historyEnd, setHistoryEnd] = useState('');
    const [historyMessage, setHistoryMessage] = useState('');
    const [historyMessageType, setHistoryMessageType] = useState('');

    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedDevice, setSelectedDevice] = useState(null);

    // giữ state như cũ để UI không phải rewrite sâu
    const [batteryStatus, setBatteryStatus] = useState(null);
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [lastCruise, setLastCruise] = useState(null);
    const [cruiseError, setCruiseError] = useState(null);

    const [lockLoading, setLockLoading] = useState(false);
    const [lockError, setLockError] = useState(null);
    const [pendingAction, setPendingAction] = useState(null); // 'lock' | 'unlock'

    const [address, setAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [addressError, setAddressError] = useState(null);

    const [lat] = useState(10.7542506);
    const [lng] = useState(106.6170202);

    const [liveTelemetry, setLiveTelemetry] = useState(null);
    const mqttClientRef = useRef(null);

    // ✅ SOC list (persist)
    const [socByImei, setSocByImei] = useState(() => loadSocCache());

    const upsertSoc = (imei, socVal) => {
        if (!imei) return;
        const next = clampSoc(socVal);
        if (next == null) return;

        setSocByImei((prev) => {
            if (prev[imei] === next) return prev;
            const merged = { ...prev, [imei]: next };
            saveSocCache(merged);
            return merged;
        });
    };

    // ⭐ anti-spam gọi last-cruise khi MQTT thiếu gps
    const lastCruiseTimeoutRef = useRef(null);
    const lastCruiseInFlightRef = useRef(false);
    const lastCruiseCallAtRef = useRef(0);
    const LAST_CRUISE_DEBOUNCE_MS = 800;
    const LAST_CRUISE_MIN_INTERVAL_MS = 15_000;

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

    // giữ makeIcon + state mobile + asset hiện tại để resize / update icon
    const makeIconRef = useRef(null);
    const isMobileNowRef = useRef(() => false);
    const currentMarkerAssetRef = useRef(markerIconStop);

    // lưu tọa độ cuối cùng đã dùng để gọi API địa chỉ
    const lastCoordsRef = useRef({ lat: null, lon: null });

    useEffect(() => {
        return () => {
            if (lastCruiseTimeoutRef.current) {
                clearTimeout(lastCruiseTimeoutRef.current);
                lastCruiseTimeoutRef.current = null;
            }
        };
    }, []);

    // ===== Marker icon selector (4 icons) =====
    const getMarkerAssetByStatus = ({ accValNum, usedSpeed }) => {
        if (accValNum === 1) return markerIconStop;

        const spd = Number(usedSpeed ?? 0);
        if (!Number.isFinite(spd) || spd <= 0) return markerIconStop;

        if (spd >= 80) return markerRun80;
        if (spd >= 50) return markerRun50;
        return markerRun;
    };

    // ✅ MAP INIT (chỉ 1 marker)
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

        LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

        const BASE_ANCHOR = [18, 36];
        const MOBILE_ANCHOR = [18, -15];

        const isMobileNow = () =>
            typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

        isMobileNowRef.current = isMobileNow;

        const makeIcon = (asset, isMobile) =>
            LMap.icon({
                iconUrl: asset?.src || asset,
                iconAnchor: isMobile ? MOBILE_ANCHOR : BASE_ANCHOR,
            });

        makeIconRef.current = makeIcon;

        currentMarkerAssetRef.current = markerIconStop;

        const marker = LMap.marker([lat, lng], { icon: makeIcon(markerIconStop, isMobileNow()) }).addTo(map);
        markerRef.current = marker;

        const updatePopupPosition = () => {
            const point = map.latLngToContainerPoint(marker.getLatLng());
            setMarkerScreenPos(point);
        };

        updatePopupPosition();

        marker.on('click', () => setShowPopup(true));
        map.on('click', () => setShowPopup(false));
        map.on('move zoom', updatePopupPosition);

        map.on('zoomend', () => {
            if (markerRef.current) {
                const pos = markerRef.current.getLatLng();
                map.setView(pos, map.getZoom(), { animate: false });
            }
        });

        let lastIsMobile = isMobileNow();

        const handleResize = () => {
            map.invalidateSize();
            updatePopupPosition();

            const nowIsMobile = isMobileNow();
            if (nowIsMobile !== lastIsMobile) {
                lastIsMobile = nowIsMobile;

                const asset = currentMarkerAssetRef.current || markerIconStop;
                markerRef.current?.setIcon(makeIcon(asset, nowIsMobile));
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            map.off('move', updatePopupPosition);
            map.off('zoom', updatePopupPosition);
            map.off('zoomend');
            map.remove();
        };
    }, [LMap, lat, lng]);

    // tự update icon theo trạng thái (stop/run/50/80)
    useEffect(() => {
        if (!LMap) return;
        if (!markerRef.current) return;
        if (!makeIconRef.current) return;

        const accValNum = toNumberOrNull(pickAcc({ liveTelemetry, lastCruise }, lastMqttAtRef));
        const usedSpeed = toNumberOrNull(pickSpeed({ liveTelemetry, lastCruise }, lastMqttAtRef));

        const nextAsset = getMarkerAssetByStatus({ accValNum, usedSpeed });

        const current = currentMarkerAssetRef.current;
        const changed = (current?.src || current) !== (nextAsset?.src || nextAsset);

        if (changed) {
            currentMarkerAssetRef.current = nextAsset;
            const isMobile = isMobileNowRef.current ? isMobileNowRef.current() : false;
            markerRef.current.setIcon(makeIconRef.current(nextAsset, isMobile));
        }
    }, [LMap, liveTelemetry, lastCruise, selectedDevice?.imei]);

    // =========================
    // ✅ TANSTACK QUERIES
    // =========================
    const devicesQuery = useQuery({
        queryKey: ['monitor', 'devices', token],
        enabled: !!token,
        queryFn: () => getDevices(token),

        // ✅ KHÔNG CACHE
        staleTime: 0,

        gcTime: 0, // nếu m dùng react-query v4 thì đổi thành cacheTime: 0

        // ✅ luôn gọi lại khi vào page / focus tab / reconnect
        refetchOnMount: 'always',
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: 'always',
    });

    const deviceList = devicesQuery.data?.devices || [];
    const loadingDevices = devicesQuery.isLoading;

    // auto select first device
    useEffect(() => {
        if (deviceList.length > 0 && !selectedDevice) {
            setSelectedDevice(deviceList[0]);
            setShowPopup(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceList]);

    const batteryQuery = useQuery({
        queryKey: ['monitor', 'batteryStatus', token, selectedDevice?.imei],
        enabled: !!token && !!selectedDevice?.imei,
        queryFn: () => getBatteryStatusByImei(token, selectedDevice.imei),
    });

    const deviceInfoQuery = useQuery({
        queryKey: ['monitor', 'deviceInfo', token, selectedDevice?._id],
        enabled: !!token && !!selectedDevice?._id,
        queryFn: () => getDeviceInfo(token, selectedDevice._id),
    });

    const lastCruiseQuery = useQuery({
        queryKey: ['monitor', 'lastCruise', token, selectedDevice?.imei],
        enabled: !!token && !!selectedDevice?.imei,
        queryFn: () => getLastCruise(token, selectedDevice.imei),
    });

    // sync query data -> local states (giữ UI logic cũ)
    useEffect(() => {
        const bs = batteryQuery.data?.batteryStatus || null;
        setBatteryStatus(bs);

        if (bs?.soc != null && selectedDevice?.imei) upsertSoc(selectedDevice.imei, bs.soc);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batteryQuery.data, selectedDevice?.imei]);

    useEffect(() => {
        setDeviceInfo(deviceInfoQuery.data || null);
    }, [deviceInfoQuery.data]);

    useEffect(() => {
        const cruise = lastCruiseQuery.data;

        if (!selectedDevice?.imei) return;

        if (!cruise || cruise?.error) {
            setLastCruise(null);
            setCruiseError(t.error.noTripData);
            return;
        }

        setLastCruise(cruise);
        setCruiseError(null);

        if (mapRef.current && markerRef.current && cruise.lat && cruise.lon && LMap) {
            const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
            markerRef.current.setLatLng(newLatLng);
            mapRef.current.setView(newLatLng, 16);

            lastCoordsRef.current = { lat: cruise.lat, lon: cruise.lon };
            fetchAddress(cruise.lat, cruise.lon);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastCruiseQuery.data, selectedDevice?.imei, LMap, isEn]);

    // history init
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

    // FETCH ADDRESS
    const fetchAddress = async (latVal, lonVal) => {
        if (latVal == null || lonVal == null) return;

        setLoadingAddress(true);
        setAddressError(null);
        setDeprecatedAddress('');

        const latNum = Number(latVal);
        const lonNum = Number(lonVal);

        if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
            setLoadingAddress(false);
            setAddress('');
            setAddressError(t.error.address);
            return;
        }

        try {
            const result = await reverseGeocodeAddress(latNum, lonNum, {
                lang: isEn ? 'en' : 'vi',
                isEn,
            });

            if (result && result.address) {
                setAddress(result.address);
                if (result.deprecatedAddress) setDeprecatedAddress(result.deprecatedAddress);
            } else {
                setAddress('');
                setAddressError(t.error.address);
            }
        } catch (err) {
            console.error('Fetch address error:', err);
            setAddress('');
            setAddressError(t.error.address);
        } finally {
            setLoadingAddress(false);
        }
    };

    // ⭐ schedule gọi API last-cruise khi MQTT thiếu gps
    // ✅ dùng queryClient.fetchQuery để tận dụng cache + dedupe của TanStack
    const scheduleRefreshLastCruise = () => {
        if (!selectedDevice?.imei) return;
        if (!token) return;

        if (lastCruiseTimeoutRef.current) {
            clearTimeout(lastCruiseTimeoutRef.current);
            lastCruiseTimeoutRef.current = null;
        }

        lastCruiseTimeoutRef.current = setTimeout(async () => {
            const now = Date.now();

            if (now - lastCruiseCallAtRef.current < LAST_CRUISE_MIN_INTERVAL_MS) return;
            if (lastCruiseInFlightRef.current) return;

            const imei = selectedDevice.imei;

            try {
                lastCruiseInFlightRef.current = true;
                lastCruiseCallAtRef.current = now;

                const cruise = await queryClient.fetchQuery({
                    queryKey: ['monitor', 'lastCruise', token, imei],
                    queryFn: () => getLastCruise(token, imei),
                    staleTime: 60_000,
                });

                if (!cruise || cruise.error) return;

                setLastCruise(cruise);
                setCruiseError(null);

                if (mapRef.current && markerRef.current && cruise.lat && cruise.lon && LMap) {
                    const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
                    markerRef.current.setLatLng(newLatLng);
                    mapRef.current.setView(newLatLng, 16);

                    lastCoordsRef.current = { lat: cruise.lat, lon: cruise.lon };
                    fetchAddress(cruise.lat, cruise.lon);
                }
            } catch (e) {
                console.error('Refresh lastCruise error:', e);
            } finally {
                lastCruiseInFlightRef.current = false;
            }
        }, LAST_CRUISE_DEBOUNCE_MS);
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

    // ✅ SEARCH: thêm driver vào điều kiện search
    const filteredDevices = useMemo(() => {
        const keyword = searchText.trim().toLowerCase();

        return deviceList.filter((d) => {
            const plate = (d.license_plate || '').toLowerCase();
            const imei = (d.imei || '').toLowerCase();
            const phone = (d.phone_number || '').toLowerCase();
            const driver = (getDriverName(d) || '').toLowerCase();

            const matchSearch =
                !keyword ||
                plate.includes(keyword) ||
                imei.includes(keyword) ||
                phone.includes(keyword) ||
                driver.includes(keyword);

            const isOnline = d.status === 10;
            let matchStatus = true;
            if (statusFilter === 'online') matchStatus = isOnline;
            if (statusFilter === 'offline') matchStatus = !isOnline;

            return matchSearch && matchStatus;
        });
    }, [deviceList, searchText, statusFilter]);

    const handleSelectDevice = async (device) => {
        if (!device) return;

        const sameDevice = selectedDevice?._id === device._id && selectedDevice?.imei === device.imei;

        // ✅ Click lại đúng device đang active
        if (sameDevice) {
            setShowPopup(true);

            if (!token) return;

            // === Check stale theo dataUpdatedAt ===
            const now = Date.now();
            const STALE_MS = 60_000;

            const keyBattery = ['monitor', 'batteryStatus', token, device.imei];
            const keyInfo = ['monitor', 'deviceInfo', token, device._id];
            const keyCruise = ['monitor', 'lastCruise', token, device.imei];

            const isStaleKey = (key) => {
                const st = queryClient.getQueryState(key);
                if (!st || !st.dataUpdatedAt) return true; // chưa có data => coi như stale
                return now - st.dataUpdatedAt >= STALE_MS;
            };

            const shouldRefetch = isStaleKey(keyBattery) || isStaleKey(keyInfo) || isStaleKey(keyCruise);

            // ✅ Đủ 1 phút => refetch ngay (khỏi cần qua device khác)
            if (shouldRefetch) {
                // Nếu muốn hiện thanh loading "refreshing"
                // (isFetching của query sẽ bật lên tự nhiên)
                await Promise.all([
                    queryClient.refetchQueries({ queryKey: keyBattery, exact: true }),
                    queryClient.refetchQueries({ queryKey: keyInfo, exact: true }),
                    queryClient.refetchQueries({ queryKey: keyCruise, exact: true }),
                ]);
            }

            return;
        }

        // ✅ Device khác -> reset + đổi selected (y như trước)
        setSelectedDevice(device);
        setShowPopup(true);

        if (lastCruiseTimeoutRef.current) {
            clearTimeout(lastCruiseTimeoutRef.current);
            lastCruiseTimeoutRef.current = null;
        }
        lastCruiseInFlightRef.current = false;
        lastCruiseCallAtRef.current = 0;

        setLiveTelemetry(null);

        currentMarkerAssetRef.current = markerIconStop;
        if (markerRef.current && makeIconRef.current) {
            const isMobile = isMobileNowRef.current ? isMobileNowRef.current() : false;
            markerRef.current.setIcon(makeIconRef.current(markerIconStop, isMobile));
        }

        setBatteryStatus(null);
        setDeviceInfo(null);
        setLastCruise(null);
        setCruiseError(null);
        setAddress('');
        setAddressError(null);
        lastCoordsRef.current = { lat: null, lon: null };
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

    useEffect(() => {
        if (!selectedDevice?.imei) return;

        if (mqttSilenceTimerRef.current) {
            clearInterval(mqttSilenceTimerRef.current);
            mqttSilenceTimerRef.current = null;
        }

        lastMqttAtRef.current = 0;

        mqttSilenceTimerRef.current = setInterval(() => {
            const last = lastMqttAtRef.current;
            if (!last) return;

            const silent = Date.now() - last >= MQTT_SILENCE_MS;
            if (silent) {
                setLiveTelemetry(null);
                scheduleRefreshLastCruise();
            }
        }, 5_000);

        return () => {
            if (mqttSilenceTimerRef.current) {
                clearInterval(mqttSilenceTimerRef.current);
                mqttSilenceTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDevice?.imei]);

    // MQTT update (chỉ selected)
    const handleMqttMessage = (topic, data) => {
        if (!selectedDevice) return;

        const arr = topic.split('/');
        if (arr[1] !== selectedDevice.imei) return;

        if (!data || typeof data !== 'object') return;

        lastMqttAtRef.current = Date.now();

        // update SOC cho list realtime + persist
        if (data.soc != null) upsertSoc(selectedDevice.imei, data.soc);

        if (data.gps == null) scheduleRefreshLastCruise();

        setLiveTelemetry((prev) => {
            const updated = { ...(prev || {}), ...data };
            const isTelemetryPacket = 'ev' in data;

            if (isTelemetryPacket) {
                if (data.gps == null) delete updated.gps;
                if (data.acc == null) delete updated.acc;
                if (data.spd == null) delete updated.spd;
                if (data.vgp == null) delete updated.vgp;
            }

            if (isTelemetryPacket && data.gps == null) delete updated.gps;

            if (!isTelemetryPacket) {
                if (!('sos' in data) && 'sos' in updated) delete updated.sos;
                if (!('acc' in data) && 'acc' in updated) delete updated.acc;
            }

            return updated;
        });

        if (data.lat != null && data.lon != null && LMap && mapRef.current && markerRef.current) {
            const latNum = Number(data.lat);
            const lonNum = Number(data.lon);

            if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
                const pos = LMap.latLng(latNum, lonNum);
                markerRef.current.setLatLng(pos);
                mapRef.current.setView(pos, 16);

                const prev = lastCoordsRef.current;
                const MIN_MOVE_METERS = 15;

                let tooClose = false;

                if (prev.lat != null && prev.lon != null) {
                    const dist = getDistanceMeters(prev.lat, prev.lon, latNum, lonNum);
                    if (dist != null && dist < MIN_MOVE_METERS) tooClose = true;
                }

                if (!tooClose) {
                    lastCoordsRef.current = { lat: latNum, lon: lonNum };
                    fetchAddress(latNum, lonNum);
                }
            }
        }
    };

    // RENDER BATTERY
    const renderBatteryInfo = () => {
        const src = liveTelemetry || {};
        const bs = batteryStatus || {};

        const soc = src.soc ?? bs.soc;
        const soh = src.soh ?? bs.soh;
        const voltage = src.vavg ?? src.vmax ?? src.vmin ?? bs.voltage;
        const temp = src.tavg ?? src.tmax ?? bs.temperature;
        const currentRaw = src.cur ?? bs.current;
        const chc = src.chc ?? bs.chc;

        const formatAmp = (val) => {
            const n = toNumberOrNull(val);
            if (n == null) return NA_TEXT;
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
              : NA_TEXT;

        return (
            <>
                <div>
                    {t.battery.imei} {selectedDevice?.imei || NA_TEXT}
                </div>
                <div>
                    {t.battery.voltage} {voltage != null ? <>{voltage} V</> : NA_TEXT}
                </div>
                <div>{currentLine}</div>
                <div>
                    {t.battery.status} {mode || NA_TEXT}
                </div>
                <div>
                    {t.battery.soc} {soc != null ? `${soc}%` : NA_TEXT}
                </div>
                <div>
                    {t.battery.soh} {soh != null ? `${soh}%` : NA_TEXT}
                </div>
                <div>
                    {isEn ? 'Charge/Discharge cycles' : 'Chu kỳ sạc/xả'}: {chc != null ? chc : 0}
                </div>
                <div>
                    {t.battery.temperature} {temp != null ? `${temp}°C` : NA_TEXT}
                </div>
                <div>
                    {t.battery.updatedAt} {updatedAt}
                </div>
            </>
        );
    };

    // RENDER STATUS
    const renderStatusInfo = () => {
        if (!selectedDevice) return <>{t.statusInfo.pleaseSelect}</>;

        const info = deviceInfo || selectedDevice;
        const ctx = { liveTelemetry, lastCruise, batteryStatus };

        const odo = pickField('mil', ctx, lastMqttAtRef);
        const distance = pickField('dst', ctx, lastMqttAtRef);

        const timVal = pickField('tim', ctx, lastMqttAtRef);
        const timeStr = timVal ? parseTimToDate(timVal)?.toLocaleString() : NA_TEXT;

        const fwr = pickField('fwr', ctx, lastMqttAtRef);

        const latVal = pickField('lat', ctx, lastMqttAtRef);
        const lonVal = pickField('lon', ctx, lastMqttAtRef);

        const accValNum = toNumberOrNull(pickAcc({ liveTelemetry, lastCruise }, lastMqttAtRef));
        const usedSpeed = toNumberOrNull(pickSpeed({ liveTelemetry, lastCruise }, lastMqttAtRef));

        const gpsValNum = toNumberOrNull(pickField('gps', ctx, lastMqttAtRef));

        const isEngineOff = accValNum === 1;
        const machineStatus = isEngineOff ? t.statusInfo.engineOff : t.statusInfo.engineOn;

        let vehicleStatus = t.statusInfo.vehicleStopped;
        if (isEngineOff) {
            vehicleStatus = t.statusInfo.vehicleParking;
        } else {
            if (usedSpeed != null && usedSpeed > 0) {
                vehicleStatus = t.statusInfo.vehicleRunning.replace('{speed}', String(usedSpeed));
            } else {
                vehicleStatus = t.statusInfo.vehicleStopped;
            }
        }

        const unknownPlateText = (t.list && t.list.unknownPlate) || (isEn ? 'No plate number' : 'Chưa có biển số');

        const driverName = getDriverName(info);

        return (
            <>
                <div>
                    {t.statusInfo.plate} {info.license_plate || unknownPlateText}
                </div>
                <div>
                    {isEn ? 'Driver' : 'Lái xe'}: {driverName || NA_TEXT}
                </div>
                <div>
                    {t.statusInfo.version} {fwr || NA_TEXT}
                </div>
                <div>
                    {t.statusInfo.vehicleType} {info.vehicle_category_id?.name || NA_TEXT}
                </div>
                <div>
                    {t.statusInfo.deviceType} {info.device_category_id?.name || NA_TEXT}
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

                {usedSpeed != null && usedSpeed > 0 && (
                    <div>
                        {t.statusInfo.speed} {usedSpeed} km/h
                    </div>
                )}

                {distance != null && (
                    <div>
                        {t.statusInfo.distance} {distance} km
                    </div>
                )}

                <div>ODO: {odo ?? 0} km</div>

                <div className="iky-monitor__location-row">
                    <span className="iky-monitor__location-label">{t.statusInfo.location}</span>
                    <span className="iky-monitor__location-text">
                        {loadingAddress
                            ? isEn
                                ? 'Resolving address...'
                                : 'Đang xác định vị trí...'
                            : addressError
                              ? addressError
                              : address || (isEn ? 'No location data' : 'Chưa có dữ liệu vị trí')}
                    </span>
                </div>

                {deprecatedAddress && (
                    <div className="iky-monitor__location-row">
                        <span className="iky-monitor__location-label">
                            {isEn ? 'Former address:' : 'Vị trí trước sáp nhập:'}
                        </span>
                        <span className="iky-monitor__location-text">{deprecatedAddress}</span>
                    </div>
                )}

                <div>
                    {t.statusInfo.coordinate}{' '}
                    {latVal != null && lonVal != null ? (
                        <span>
                            {`${latVal}, ${lonVal}`}{' '}
                            {gpsValNum === 1 && <span style={{ color: 'red', fontWeight: 600 }}>(*)</span>}
                        </span>
                    ) : (
                        NA_TEXT
                    )}
                </div>

                {cruiseError && (
                    <div className="iky-monitor__alert iky-monitor__alert--info" style={{ marginTop: 8 }}>
                        {cruiseError}
                    </div>
                )}
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

    const isLocked = liveTelemetry?.sos === 1 || liveTelemetry?.sos === '1';
    const deviceStatusText = isLocked ? t.control.statusActivated : t.control.statusNotActivated;
    const deviceStatusClass = isLocked ? 'iky-monitor__tag-red' : 'iky-monitor__tag-green';

    // loading flags theo query
    const loadingBattery = batteryQuery.isFetching;
    const loadingDeviceInfo = deviceInfoQuery.isFetching;
    const loadingCruise = lastCruiseQuery.isFetching;

    const isRefreshing = loadingDeviceInfo || loadingCruise || loadingBattery || loadingAddress;
    const isStatusLoading = !selectedDevice || deviceInfoQuery.isFetching || lastCruiseQuery.isFetching;

    const isBatteryLoading = !selectedDevice || batteryQuery.isFetching;

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
                                    <div className="iky-monitor__left-label">
                                        {t.list.label}{' '}
                                        <span className="iky-monitor__count">({filteredDevices.length})</span>
                                    </div>

                                    <div className="iky-monitor__device-list">
                                        {loadingDevices && <div className="iky-loading">{t.list.loading}</div>}

                                        {!loadingDevices && filteredDevices.length === 0 && (
                                            <div className="iky-monitor__empty">{t.list.empty}</div>
                                        )}

                                        {!loadingDevices &&
                                            filteredDevices.map((d, idx) => {
                                                const isActive = selectedDevice?._id === d._id;
                                                const socForItem = socByImei[d.imei];
                                                const driverName = getDriverName(d);

                                                return (
                                                    <div
                                                        key={d._id}
                                                        className={
                                                            'iky-monitor__device-item' +
                                                            (isActive ? ' iky-monitor__device-item--active' : '')
                                                        }
                                                        onClick={() => handleSelectDevice(d)}
                                                    >
                                                        <div className="iky-monitor__device-row">
                                                            <span className="iky-monitor__stt-badge">{idx + 1}</span>

                                                            <div className="iky-monitor__device-main">
                                                                <div className="iky-monitor__plate-row">
                                                                    <div className="plate">
                                                                        {d.license_plate || t.list.unknownPlate}
                                                                    </div>

                                                                    <BatteryBadge
                                                                        soc={socForItem}
                                                                        showText
                                                                        compact
                                                                        title={
                                                                            socForItem == null
                                                                                ? isEn
                                                                                    ? 'No battery data yet'
                                                                                    : 'Chưa có dữ liệu pin'
                                                                                : isEn
                                                                                  ? `Battery: ${socForItem}%`
                                                                                  : `Pin: ${socForItem}%`
                                                                        }
                                                                    />
                                                                </div>

                                                                <div
                                                                    className="iky-monitor__meta"
                                                                    style={{ marginTop: 2 }}
                                                                >
                                                                    <span className="imei">IMEI: {d.imei}</span>
                                                                    <span className="dot">•</span>
                                                                    <span className="phone">
                                                                        {t.list.phoneLabel}{' '}
                                                                        {d.phone_number || 'Chưa gán'}
                                                                    </span>
                                                                    <span className="dot">•</span>
                                                                    <span className="driver">
                                                                        {isEn ? 'Driver' : 'Lái xe'}:{' '}
                                                                        {driverName || NA_TEXT}
                                                                    </span>
                                                                </div>
                                                            </div>
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
                                        {deviceList.map((d, idx) => (
                                            <option key={d._id} value={d._id}>
                                                {idx + 1}. {(d.license_plate || d.imei || t.history.unknown).trim()}
                                                {getDriverName(d)
                                                    ? ` - ${isEn ? 'Driver' : 'Tài xế'}: ${getDriverName(d)}`
                                                    : ''}
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

                                        {role !== 'reporter' && (
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
                                        )}

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

                                    {isRefreshing && <div className="iky-monitor__refreshing-bar" />}

                                    <div className="iky-monitor__popup-body">
                                        {detailTab === 'status' && (
                                            <div className="iky-monitor__popup-col">
                                                {isStatusLoading ? (
                                                    <Skeleton active paragraph={{ rows: 8 }} />
                                                ) : (
                                                    renderStatusInfo()
                                                )}
                                            </div>
                                        )}

                                        {detailTab === 'control' && (
                                            <div className="iky-monitor__popup-col">
                                                {/* <div className="iky-monitor__control-row">
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
                                                </div> */}

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

                                                {lockError && (
                                                    <div className="iky-monitor__alert iky-monitor__alert--error">
                                                        {lockError}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {detailTab === 'battery' && (
                                            <div className="iky-monitor__popup-col">
                                                {isBatteryLoading ? (
                                                    <Skeleton active paragraph={{ rows: 7 }} />
                                                ) : (
                                                    renderBatteryInfo()
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </>
    );
};

export default MonitorPage;
