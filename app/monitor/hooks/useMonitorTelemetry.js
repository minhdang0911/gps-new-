'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBatteryStatusByImei } from '../../lib/api/batteryStatus';
import { getDeviceInfo } from '../../lib/api/devices';
import { getLastCruise } from '../../lib/api/cruise';
import { getDistanceMeters } from '../../util/geo';
import { toNumberOrNull } from '../../util/number';
import { isDatBikeDevice, getDatBikeStateInfo } from '../../util/cruiseUtils';
import { updateMarkerSmoothMovement, calculateBearingFromPoints } from '../../lib/map/smoothMarkerHelper';
import {
    loadSocCache, saveSocCache, clampSoc, pickAcc, pickSpeed, pickBikeState, getMarkerAssetByStatus,
} from '../util/monitorHelpers';
import { useMonitorAddress } from './useMonitorAddress';

export function useMonitorTelemetry({
    token, selectedDevice, LMap, mapRef, markerRef, updatePopupPosition,
    makeIconRef, isMobileNowRef, currentMarkerAssetRef, currentHeadingRef,
    isEn, t, lastMqttAtRef,
}) {
    const queryClient = useQueryClient();
    const addressHook = useMonitorAddress({ isEn, t });

    const [batteryStatus, setBatteryStatus] = useState(null);
    const [deviceInfo, setDeviceInfo] = useState(null);
    const [lastCruise, setLastCruise] = useState(null);
    const [cruiseError, setCruiseError] = useState(null);

    const [liveTelemetry, setLiveTelemetry] = useState(null);
    const [socByImei, setSocByImei] = useState(() => loadSocCache());

    const socWriteTimerRef = useRef(null);
    const lastCruiseTimeoutRef = useRef(null);
    const lastCruiseInFlightRef = useRef(false);
    const lastCruiseCallAtRef = useRef(0);
    const LAST_CRUISE_DEBOUNCE_MS = 800;
    const LAST_CRUISE_MIN_INTERVAL_MS = 10_000;
    const MQTT_SILENCE_MS = 60_000;
    const mqttSilenceTimerRef = useRef(null);

    const upsertSoc = (imei, socVal) => {
        if (!imei) return;
        const next = clampSoc(socVal);
        if (next == null) return;

        setSocByImei((prev) => {
            if (prev[imei] === next) return prev;
            const merged = { ...prev, [imei]: next };
            clearTimeout(socWriteTimerRef.current);
            socWriteTimerRef.current = setTimeout(() => saveSocCache(merged), 5000);
            return merged;
        });
    };

    const scheduleRefreshLastCruise = () => {
        if (!selectedDevice?.imei || !token) return;

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
                    queryFn: () => getLastCruise(imei),
                    staleTime: 10_000,
                });

                if (!cruise || cruise.error) return;

                setLastCruise(cruise);
                setCruiseError(null);

                if (mapRef.current && markerRef.current && cruise.lat && cruise.lon && LMap) {
                    try {
                        const map = mapRef.current;
                        if (map && map._loaded && !map._removed && map._mapPane) {
                            const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
                            markerRef.current.setLatLng(newLatLng);
                            map.setView(newLatLng, 16);
                            updatePopupPosition(true);

                            addressHook.lastCoordsRef.current = { lat: cruise.lat, lon: cruise.lon };
                            addressHook.fetchAddress(cruise.lat, cruise.lon);
                        }
                    } catch (err) {
                        console.warn('scheduleRefreshLastCruise map view error:', err);
                    }
                }
            } catch (e) {
                console.error('Refresh lastCruise error:', e);
            } finally {
                lastCruiseInFlightRef.current = false;
            }
        }, LAST_CRUISE_DEBOUNCE_MS);
    };

    useEffect(() => {
        return () => {
            if (lastCruiseTimeoutRef.current) {
                clearTimeout(lastCruiseTimeoutRef.current);
                lastCruiseTimeoutRef.current = null;
            }
        };
    }, []);

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
        queryFn: () => getLastCruise(selectedDevice.imei),
    });

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
            addressHook.resetAddress();
            setLastCruise(null);
            setCruiseError(t.error.noTripData);
            return;
        }

        setLastCruise(cruise);
        setCruiseError(null);

        if (mapRef.current && markerRef.current && cruise.lat && cruise.lon && LMap) {
            try {
                const map = mapRef.current;
                if (map && map._loaded && !map._removed && map._mapPane) {
                    const newLatLng = LMap.latLng(cruise.lat, cruise.lon);
                    markerRef.current.setLatLng(newLatLng);
                    map.setView(newLatLng, 16);
                    updatePopupPosition(true);

                    addressHook.lastCoordsRef.current = { lat: cruise.lat, lon: cruise.lon };
                    addressHook.fetchAddress(cruise.lat, cruise.lon);
                }
            } catch (err) {
                console.warn('Cruise map view error:', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastCruiseQuery.data, selectedDevice?.imei, LMap, isEn]);

    useEffect(() => {
        if (!LMap || !markerRef.current || !makeIconRef.current) return;

        const accValNum = toNumberOrNull(pickAcc({ liveTelemetry, lastCruise }, lastMqttAtRef));
        const usedSpeed = toNumberOrNull(pickSpeed({ liveTelemetry, lastCruise }, lastMqttAtRef));

        const info = deviceInfo || selectedDevice;
        const isDatBike = isDatBikeDevice(info);
        const bikeStateVal = pickBikeState({ liveTelemetry, lastCruise }, lastMqttAtRef);
        const datBikeState = (isDatBike || bikeStateVal != null) ? getDatBikeStateInfo(bikeStateVal, isEn) : null;

        const nextAsset = getMarkerAssetByStatus({ accValNum, usedSpeed, datBikeState });
        const current = currentMarkerAssetRef.current;
        const changed = (current?.src || current) !== (nextAsset?.src || nextAsset);

        if (changed) {
            currentMarkerAssetRef.current = nextAsset;
            const isMobile = isMobileNowRef.current ? isMobileNowRef.current() : false;
            markerRef.current.setIcon(makeIconRef.current(nextAsset, isMobile, currentHeadingRef.current));
        }
    }, [LMap, liveTelemetry, lastCruise, selectedDevice?.imei]);

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

    const handleMqttMessage = (topic, data) => {
        if (!selectedDevice) return;
        const arr = topic.split('/');
        if (arr[1] !== selectedDevice.imei) return;
        if (!data || typeof data !== 'object') return;

        lastMqttAtRef.current = Date.now();

        if (data.soc != null) upsertSoc(selectedDevice.imei, data.soc);
        if (data.gps == null) scheduleRefreshLastCruise();

        setLiveTelemetry((prev) => {
            const updated = { ...(prev || {}), ...data };
            const isTelemetryPacket = 'ev' in data;

            if (isTelemetryPacket) {
                ['gps', 'acc', 'spd', 'vgp', 'vlp', 'onl', 'ste', 'state'].forEach((k) => {
                    if (data[k] == null) delete updated[k];
                });
            } else {
                ['sos', 'acc'].forEach((k) => {
                    if (!(k in data) && k in updated) delete updated[k];
                });
            }

            return updated;
        });

        if (data.lat != null && data.lon != null && LMap && mapRef.current && markerRef.current) {
            const latNum = Number(data.lat);
            const lonNum = Number(data.lon);

            if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
                try {
                    const map = mapRef.current;
                    const marker = markerRef.current;
                    if (!map || !map._loaded || map._removed || !map._mapPane) return;

                    const currentPos = marker.getLatLng();
                    const hasMoved =
                        !currentPos ||
                        Math.abs(currentPos.lat - latNum) > 0.00002 ||
                        Math.abs(currentPos.lng - lonNum) > 0.00002;

                    if (hasMoved) {
                        const pos = LMap.latLng(latNum, lonNum);
                        const prev = addressHook.lastCoordsRef.current;
                        let nextHeading = currentHeadingRef.current;
                        const dataAng = data.ang ?? data.heading;
                        if (dataAng != null && Number.isFinite(Number(dataAng))) {
                            nextHeading = Number(dataAng);
                        } else if (prev.lat != null && prev.lon != null) {
                            const calculatedBearing = calculateBearingFromPoints(prev.lat, prev.lon, latNum, lonNum);
                            if (calculatedBearing > 0) nextHeading = calculatedBearing;
                        }
                        currentHeadingRef.current = nextHeading;

                        updateMarkerSmoothMovement(marker, pos, nextHeading);
                        updatePopupPosition(true);

                        const bounds = map.getBounds();
                        if (bounds && !bounds.contains(pos)) {
                            map.panTo(pos, { animate: true, duration: 0.5 });
                        }

                        const MIN_MOVE_METERS = 15;
                        let tooClose = false;

                        if (prev.lat != null && prev.lon != null) {
                            const dist = getDistanceMeters(prev.lat, prev.lon, latNum, lonNum);
                            if (dist != null && dist < MIN_MOVE_METERS) tooClose = true;
                        }

                        if (!tooClose) {
                            addressHook.lastCoordsRef.current = { lat: latNum, lon: lonNum };
                            addressHook.fetchAddress(latNum, lonNum);
                        }
                    }
                } catch (err) {
                    console.warn('Map update error suppressed:', err);
                }
            }
        }
    };

    const resetTelemetry = () => {
        if (lastCruiseTimeoutRef.current) {
            clearTimeout(lastCruiseTimeoutRef.current);
            lastCruiseTimeoutRef.current = null;
        }
        lastCruiseInFlightRef.current = false;
        lastCruiseCallAtRef.current = 0;
        setLiveTelemetry(null);

        if (markerRef.current && makeIconRef.current) {
            const isMobile = isMobileNowRef.current ? isMobileNowRef.current() : false;
            markerRef.current.setIcon(makeIconRef.current(currentMarkerAssetRef.current, isMobile));
        }

        setBatteryStatus(null);
        setDeviceInfo(null);
        setLastCruise(null);
        setCruiseError(null);
        addressHook.resetAddress();
    };

    return {
        batteryStatus, deviceInfo, lastCruise, cruiseError,
        address: addressHook.address, deprecatedAddress: addressHook.deprecatedAddress,
        loadingAddress: addressHook.loadingAddress, addressError: addressHook.addressError,
        liveTelemetry, socByImei, batteryQuery, deviceInfoQuery,
        lastCruiseQuery, handleMqttMessage, resetTelemetry, upsertSoc,
    };
}
