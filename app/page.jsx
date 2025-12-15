'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import './MonitorPage.css';

import { getDevices, getDeviceInfo } from './lib/api/devices';
import { getBatteryStatusByImei } from './lib/api/batteryStatus';
import { getLastCruise } from './lib/api/cruise';

import markerIcon from './assets/marker-red.png';
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

const MonitorPage = () => {
    // ----- LANG -----
    const pathname = usePathname() || '/';
    const [isEn, setIsEn] = useState(false);
    const [deprecatedAddress, setDeprecatedAddress] = useState('');
    const [role, setRole] = useState('');

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
    const [pendingAction, setPendingAction] = useState(null); // 'lock' | 'unlock'
    const [address, setAddress] = useState('');
    const [loadingAddress, setLoadingAddress] = useState(false);
    const [addressError, setAddressError] = useState(null);
    const [lat] = useState(10.7542506);
    const [lng] = useState(106.6170202);
    const [liveTelemetry, setLiveTelemetry] = useState(null);
    const mqttClientRef = useRef(null);

    // ⭐ ADD: anti-spam gọi last-cruise khi MQTT thiếu gps
    const lastCruiseTimeoutRef = useRef(null);
    const lastCruiseInFlightRef = useRef(false);
    const lastCruiseCallAtRef = useRef(0);
    const LAST_CRUISE_DEBOUNCE_MS = 800; // gom nhiều packet trong 0.8s
    const LAST_CRUISE_MIN_INTERVAL_MS = 15_000; // tối thiểu 15s mới gọi lại

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

    // lưu tọa độ cuối cùng đã dùng để gọi API địa chỉ
    const lastCoordsRef = useRef({ lat: null, lon: null });

    // ⭐ ADD: clear timer khi unmount (tránh gọi lạc)
    useEffect(() => {
        return () => {
            if (lastCruiseTimeoutRef.current) {
                clearTimeout(lastCruiseTimeoutRef.current);
                lastCruiseTimeoutRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

        // ===== marker icon: desktop vs mobile =====
        const BASE_ANCHOR = [18, 36]; // như bạn đang dùng
        const MOBILE_DELTA_Y = 10; // muốn xuống thêm bao nhiêu px trên mobile (tăng/giảm số này)
        const MOBILE_ANCHOR = [18, -15]; // anchor.y nhỏ hơn => marker xuống

        const makeIcon = (isMobile) =>
            LMap.icon({
                iconUrl: markerIcon.src,
                iconAnchor: isMobile ? MOBILE_ANCHOR : BASE_ANCHOR,
            });

        const isMobileNow = () =>
            typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

        const marker = LMap.marker([lat, lng], { icon: makeIcon(isMobileNow()) }).addTo(map);
        markerRef.current = marker;

        const updatePopupPosition = () => {
            const point = map.latLngToContainerPoint(marker.getLatLng());
            setMarkerScreenPos(point);
        };

        updatePopupPosition();

        marker.on('click', () => setShowPopup(true));
        map.on('click', () => setShowPopup(false));
        map.on('move zoom', updatePopupPosition);

        // sau khi zoom xong thì focus lại marker
        map.on('zoomend', () => {
            if (markerRef.current) {
                const pos = markerRef.current.getLatLng();
                map.setView(pos, map.getZoom(), { animate: false });
            }
        });

        // ===== resize: update map + popup + icon on breakpoint change =====
        let lastIsMobile = isMobileNow();

        const handleResize = () => {
            map.invalidateSize();
            updatePopupPosition();

            const nowIsMobile = isMobileNow();
            if (nowIsMobile !== lastIsMobile) {
                lastIsMobile = nowIsMobile;
                markerRef.current?.setIcon(makeIcon(nowIsMobile));
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
                if (result.deprecatedAddress) {
                    setDeprecatedAddress(result.deprecatedAddress);
                }
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

    // ⭐ ADD: schedule gọi API last-cruise khi MQTT thiếu gps (tránh spam)
    const scheduleRefreshLastCruise = () => {
        if (!selectedDevice?.imei) return;

        // debounce
        if (lastCruiseTimeoutRef.current) {
            clearTimeout(lastCruiseTimeoutRef.current);
            lastCruiseTimeoutRef.current = null;
        }

        lastCruiseTimeoutRef.current = setTimeout(async () => {
            const now = Date.now();

            // rate-limit
            if (now - lastCruiseCallAtRef.current < LAST_CRUISE_MIN_INTERVAL_MS) return;

            // tránh gọi chồng
            if (lastCruiseInFlightRef.current) return;

            const token = localStorage.getItem('accessToken');
            if (!token) return;

            const imei = selectedDevice.imei;

            try {
                lastCruiseInFlightRef.current = true;
                lastCruiseCallAtRef.current = now;

                // (optional) nếu bạn muốn show thanh loading refresh, bật cái này:
                // setLoadingCruise(true);

                const cruise = await getLastCruise(token, imei);

                if (!cruise || cruise.error) return;

                setLastCruise(cruise);
                setCruiseError(null);

                // update map + address theo cruise mới
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
                // setLoadingCruise(false);
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

        // ⭐ ADD: đổi xe thì clear timer + reset anti-spam để khỏi gọi lạc xe
        if (lastCruiseTimeoutRef.current) {
            clearTimeout(lastCruiseTimeoutRef.current);
            lastCruiseTimeoutRef.current = null;
        }
        lastCruiseInFlightRef.current = false;
        lastCruiseCallAtRef.current = 0;

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

        // reset để hiển thị skeleton
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

    // MQTT update
    const handleMqttMessage = (topic, data) => {
        if (!selectedDevice) return;

        const arr = topic.split('/');
        if (arr[1] !== selectedDevice.imei) return;

        if (!data || typeof data !== 'object') return;

        // ⭐ CHANGE: nếu MQTT có message nhưng thiếu gps -> schedule gọi last-cruise
        // (Bạn nói chỉ thiếu gps thôi => mình check đúng gps)
        if (data.gps == null) {
            scheduleRefreshLastCruise();
        }

        setLiveTelemetry((prev) => {
            const updated = { ...(prev || {}), ...data };

            const isTelemetryPacket = 'ev' in data;

            if (!isTelemetryPacket) {
                if (!('sos' in data) && 'sos' in updated) {
                    delete updated.sos;
                }

                if (!('acc' in data) && 'acc' in updated) {
                    delete updated.acc;
                }
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
                    if (dist != null && dist < MIN_MOVE_METERS) {
                        tooClose = true;
                    }
                }

                if (!tooClose) {
                    lastCoordsRef.current = { lat: latNum, lon: lonNum };
                    fetchAddress(latNum, lonNum);
                }
            }
        }
    };

    const BATTERY_FIELDS = ['soc', 'soh', 'tavg', 'tmax', 'tmin', 'vavg', 'vmax', 'vmin', 'cur', 'ckw', 'ckwh', 'an1'];

    // RENDER BATTERY
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
        const src = liveTelemetry || lastCruise || {};
        const mqttSrc = liveTelemetry || {};

        const speed = mqttSrc.spd;
        const distance = mqttSrc.dst;

        const timeStr = src.tim ? parseTimToDate(src.tim)?.toLocaleString() : NA_TEXT;
        const fwr = mqttSrc.fwr ?? src.fwr;

        const latVal = src.lat;
        const lonVal = src.lon;

        const accValNum = toNumberOrNull(
            mqttSrc.acc != null ? mqttSrc.acc : src.acc != null ? src.acc : batteryStatus?.acc,
        );

        console.log('accValNum', accValNum);

        const spdNum = toNumberOrNull(mqttSrc.spd || batteryStatus?.spd);
        const vgpNum = toNumberOrNull(mqttSrc.vgp);

        const gpsValNum = toNumberOrNull(mqttSrc.gps != null ? mqttSrc.gps : src.gps);
        const isAccOn = accValNum === 1;

        console.log('gpsValNum', gpsValNum);
        let machineStatus = t.statusInfo.engineOn;
        if (accValNum === 1) {
            machineStatus = t.statusInfo.engineOff;
        } else if (accValNum === 0) {
            machineStatus = t.statusInfo.engineOn;
        }

        let vehicleStatus = t.statusInfo.vehicleStopped;

        let usedSpeed = spdNum ?? vgpNum;

        if (!isAccOn) {
            vehicleStatus = t.statusInfo.vehicleParking;
        } else {
            if (usedSpeed == null || usedSpeed < 5) {
                vehicleStatus = t.statusInfo.vehicleStopped;
            } else {
                vehicleStatus = t.statusInfo.vehicleRunning.replace('{speed}', String(usedSpeed));
            }
        }

        const unknownPlateText = (t.list && t.list.unknownPlate) || (isEn ? 'No plate number' : 'Chưa có biển số');

        return (
            <>
                <div>
                    {t.statusInfo.plate} {info.license_plate || unknownPlateText}
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

                {speed != null && speed > 5 && (
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
                        <>
                            {`${latVal}, ${lonVal}`}{' '}
                            {gpsValNum === 1 && <span style={{ color: 'red', fontWeight: 600 }}>(*)</span>}
                        </>
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

    const curStatus = selectedDevice?.status;
    const isLocked = liveTelemetry?.sos === 1 || liveTelemetry?.sos === '1';
    const deviceStatusText = isLocked ? t.control.statusActivated : t.control.statusNotActivated;
    const deviceStatusClass = isLocked ? 'iky-monitor__tag-red' : 'iky-monitor__tag-green';

    const isRefreshing = loadingDeviceInfo || loadingCruise || loadingBattery || loadingAddress;

    const isStatusLoading =
        !selectedDevice || loadingDeviceInfo || loadingCruise || (!deviceInfo && !lastCruise && !cruiseError);

    const isBatteryLoading = !selectedDevice || loadingBattery || (!batteryStatus && !liveTelemetry);

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
                                                                <div className="plate">
                                                                    {d.license_plate || t.list.unknownPlate}
                                                                </div>

                                                                <div className="iky-monitor__meta">
                                                                    <span className="imei">IMEI: {d.imei}</span>
                                                                    <span className="dot">•</span>
                                                                    <span className="phone">
                                                                        {t.list.phoneLabel}{' '}
                                                                        {d.phone_number || 'Chưa gán'}
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

                                    {/* Thanh nhỏ báo đang cập nhật */}
                                    {isRefreshing && <div className="iky-monitor__refreshing-bar"></div>}

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
