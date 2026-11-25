'use client';

import { useState, useRef, useCallback } from 'react';
import { getCruiseHistory } from '../../lib/api/cruise';
import cruiseCacheManager from '../../lib/cache/CruiseCacheManager';
import { snapRouteToRoads } from '../../lib/map/roadSnap';
import {
    FETCH_PAGE_LIMIT,
    VISUAL_MAX_POINTS_ON_MAP,
    MAP_MIN_SAMPLE_DIST_M,
    toNum,
    buildStatusHard,
    safeTimeMs,
    calcTotalDistanceKm,
    buildMapSample,
    toApiDateTime,
} from '../../util/cruiseUtils';

export function useCruiseRouteLoader({
    selectedDeviceId,
    selectedImei,
    start,
    end,
    deviceList,
    isEn,
    t,
    ensureAddress,
}) {
    const [rawRouteData, setRawRouteData] = useState([]);
    const [mapRouteData, setMapRouteData] = useState([]);
    const mapToRawIndexRef = useRef([]);
    const [totalKm, setTotalKm] = useState(0);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [error, setError] = useState(null);

    const [snapToRoad, setSnapToRoad] = useState(true);
    const [snappedPolyline, setSnappedPolyline] = useState([]);
    const [isSnappingRoad, setIsSnappingRoad] = useState(false);
    const [snapProgress, setSnapProgress] = useState(0);

    const routeLoadSeqRef = useRef(0);

    const handleLoadRoute = useCallback(async () => {
        if (!selectedDeviceId) {
            setError(t?.error?.selectVehicle || 'Vui lòng chọn xe');
            return;
        }
        if (!start || !end) {
            setError(t?.error?.selectTime || 'Vui lòng chọn thời gian');
            return;
        }

        const startApi = toApiDateTime(start);
        const endApi = toApiDateTime(end);

        if (!startApi || !endApi) {
            setError(t?.error?.invalidTime || 'Thời gian không hợp lệ');
            return;
        }

        const currentDevice = deviceList.find((d) => d._id === selectedDeviceId);
        const imei = selectedImei || currentDevice?.imei;
        if (!imei) {
            setError(t?.error?.noVehicle || 'Không tìm thấy thông tin xe');
            return;
        }

        const loadSeq = ++routeLoadSeqRef.current;
        setLoadingRoute(true);
        setError(null);
        setSnappedPolyline([]);

        try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';
            const fetchPageFn = async (pNum, limit) => {
                return await getCruiseHistory(token, {
                    imei,
                    start: startApi,
                    end: endApi,
                    page: pNum,
                    limit,
                });
            };

            const result = await cruiseCacheManager.smartLoadRoute(
                imei,
                startApi,
                endApi,
                fetchPageFn,
                FETCH_PAGE_LIMIT,
            );

            if (routeLoadSeqRef.current !== loadSeq) return;

            let allData = result?.data || [];

            if (routeLoadSeqRef.current !== loadSeq) return;

            if (!allData.length) {
                setError(t?.error?.noData || 'Không có dữ liệu hành trình trong khoảng thời gian này');
                setRawRouteData([]);
                setMapRouteData([]);
                mapToRawIndexRef.current = [];
                setTotalKm(0);
                return;
            }

            allData.sort((a, b) => {
                const ta = safeTimeMs({ timRaw: a.tim, dateTime: a.tim || a.createdAt, createdAt: a.createdAt });
                const tb = safeTimeMs({ timRaw: b.tim, dateTime: b.tim || b.createdAt, createdAt: b.createdAt });
                return (ta || 0) - (tb || 0);
            });

            const currentDevice = deviceList.find((d) => d._id === selectedDeviceId) || {};
            const plate = (currentDevice.license_plate || t?.common?.unknownPlate || 'Chưa có biển số').trim();
            const vehicleName = currentDevice.name || currentDevice.vehicle_name || '';
            const manufacturer = currentDevice.device_category_id?.name || currentDevice.device_category_id?.code || '';

            const mapped = allData.map((item) => {
                const speedNum = toNum(item.vgp) ?? 0;
                const status = buildStatusHard(
                    { acc: item.acc, spd: speedNum, onl: item.onl, ste: item.ste, state: item.state },
                    isEn,
                );

                const timRaw = item.tim;
                const createdAt = item.createdAt;
                const dateTime = item.tim || item.createdAt || item.created || '';

                return {
                    lat: item.lat,
                    lon: item.lon,
                    gps: item.gps,
                    sat: item.sat,
                    mil: item.mil,
                    timRaw,
                    createdAt,
                    licensePlate: plate,
                    vehicleName,
                    manufacturer,
                    selector: item._id,
                    dateTime,
                    velocity: status.speedText,
                    velocityNum: status.speedNum,
                    acc: item.acc,
                    spd: item.vgp,
                    statusType: status.type,
                    address: '',
                    __timeMs: safeTimeMs({ timRaw, dateTime, createdAt }),
                };
            });

            setRawRouteData(mapped);
            setTotalKm(calcTotalDistanceKm(mapped));

            const sample = buildMapSample(mapped, VISUAL_MAX_POINTS_ON_MAP, MAP_MIN_SAMPLE_DIST_M);
            mapToRawIndexRef.current = sample.indices;
            setMapRouteData(sample.points);

            if (sample.points && sample.points.length >= 2) {
                setIsSnappingRoad(true);
                setSnapProgress(5);
                snapRouteToRoads(sample.points, {
                    onProgress: (pct) => {
                        if (routeLoadSeqRef.current === loadSeq) setSnapProgress(pct);
                    },
                })
                    .then((snapped) => {
                        if (routeLoadSeqRef.current !== loadSeq) return;
                        if (snapped && snapped.length >= 2) {
                            setSnappedPolyline(snapped);
                        }
                    })
                    .catch((err) => {
                        if (routeLoadSeqRef.current === loadSeq) {
                            console.error('Road snap error:', err);
                        }
                    })
                    .finally(() => {
                        if (routeLoadSeqRef.current === loadSeq) {
                            setIsSnappingRoad(false);
                        }
                    });
            }

            const firstValid = mapped.find((p) => typeof p.lat === 'number' && typeof p.lon === 'number');
            if (firstValid && ensureAddress) ensureAddress(firstValid.lat, firstValid.lon);
        } catch (e) {
            console.error(e);
            if (routeLoadSeqRef.current === loadSeq) {
                setError(t?.error?.loadFailed || 'Tải dữ liệu hành trình thất bại');
            }
        } finally {
            if (routeLoadSeqRef.current === loadSeq) {
                setLoadingRoute(false);
            }
        }
    }, [selectedDeviceId, selectedImei, start, end, deviceList, isEn, t, ensureAddress]);

    return {
        rawRouteData,
        setRawRouteData,
        mapRouteData,
        setMapRouteData,
        mapToRawIndexRef,
        totalKm,
        setTotalKm,
        loadingRoute,
        setLoadingRoute,
        error,
        setError,
        snapToRoad,
        setSnapToRoad,
        snappedPolyline,
        setSnappedPolyline,
        isSnappingRoad,
        snapProgress,
        routeLoadSeqRef,
        handleLoadRoute,
    };
}
