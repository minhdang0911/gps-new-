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
const GOONG_API_KEY = process.env.NEXT_PUBLIC_GOONG_API_KEY;

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
            iconSize: [36, 36],
            iconAnchor: [18, 36],
        });

        const marker = LMap.marker([lat, lng], { icon: customIcon }).addTo(map);
        markerRef.current = marker;

        const updatePopupPosition = () => {
            const point = map.latLngToContainerPoint(marker.getLatLng());
            setMarkerScreenPos(point);
        };

        updatePopupPosition();

        marker.on('click', () => {
            setShowPopup(true);
        });

        map.on('click', () => {
            setShowPopup(false);
        });

        map.on('move zoom', updatePopupPosition);

        const handleResize = () => {
            map.invalidateSize();
            updatePopupPosition();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            map.off('move', updatePopupPosition);
            map.off('zoom', updatePopupPosition);
            map.remove();
        };
    }, [LMap, lat, lng]);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const fetchDevices = async () => {
            try {
                setLoadingDevices(true);
                const res = await getDevices(token, { limit: 50 });
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

    const fetchAddressFromGoong = async (latVal, lonVal) => {
        if (latVal == null || lonVal == null) return;

        setLoadingAddress(true);
        setAddressError(null);

        const lat = Number(latVal);
        const lon = Number(lonVal);

        const tryGoong = async () => {
            if (!GOONG_API_KEY) return '';

            const res = await fetch(`https://rsapi.goong.io/Geocode?latlng=${lat},${lon}&api_key=${GOONG_API_KEY}`);

            if (!res.ok) {
                throw new Error('Goong API error');
            }

            const data = await res.json();
            const addr = data?.results?.[0]?.formatted_address || '';
            return addr;
        };

        const tryNominatim = async () => {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

            const res = await fetch(url);

            if (!res.ok) {
                throw new Error('Nominatim error');
            }

            const data = await res.json();
            const addr = data?.display_name || '';
            return addr;
        };

        try {
            let addr = '';

            try {
                addr = await tryGoong();
            } catch (e) {
                console.error('Goong failed, fallback Nominatim:', e);
            }

            if (!addr) {
                try {
                    addr = await tryNominatim();
                } catch (e2) {
                    console.error('Nominatim failed:', e2);
                }
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

                if (mapRef.current && markerRef.current && cruise.lat && cruise.lon) {
                    const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
                    markerRef.current.setLatLng(newLatLng);
                    mapRef.current.setView(newLatLng, 16);
                }

                if (cruise.lat != null && cruise.lon != null) {
                    fetchAddressFromGoong(cruise.lat, cruise.lon);
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

    // 🔥 nhận MQTT → update liveTelemetry + map
    const handleMqttMessage = (topic, data) => {
        if (!selectedDevice) return;

        const arr = topic.split('/');
        if (arr[1] !== selectedDevice.imei) return;

        if (!data || typeof data !== 'object') return;

        setLiveTelemetry((prev) => ({ ...(prev || {}), ...data }));

        if (data.lat != null && data.lon != null && LMap && mapRef.current && markerRef.current) {
            const pos = LMap.latLng(data.lat, data.lon);
            markerRef.current.setLatLng(pos);
            mapRef.current.setView(pos, 16);
            fetchAddressFromGoong(data.lat, data.lon);
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

        const latVal = src.lat;
        const lonVal = src.lon;

        const accValNum = toNumberOrNull(mqttSrc.acc);
        const spdNum = toNumberOrNull(mqttSrc.spd);
        const vgpNum = toNumberOrNull(mqttSrc.vgp);

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

                <div>
                    {t.statusInfo.location} {address || '--'}
                </div>
                <div>
                    {t.statusInfo.coordinate} {latVal && lonVal ? `${latVal}, ${lonVal}` : '--'}
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
    const isLocked = Number(liveTelemetry?.sos) === 1;

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
                                                        {/* <div className="status">
                                                            {t.list.statusLabel}{' '}
                                                            <span className={isOnline ? 'online' : 'offline'}>
                                                                {isOnline ? t.list.statusOnline : t.list.statusOffline}
                                                            </span>
                                                        </div> */}
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
