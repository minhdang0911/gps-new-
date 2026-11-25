/**
 * @file useSpatialDistrict.js
 * @description React hook nạp và sử dụng IKY-SpatialCore Engine một cách mượt mà và an toàn.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrLoadSpatialIndex, getCachedSpatialIndexSync } from './spatialLoader';
import { classifyCoordinateWithCache, classifyProvinceDevicesIntoDistricts } from './spatialClassifier';

export function useSpatialDistrict() {
    const [spatialIndex, setSpatialIndex] = useState(() => getCachedSpatialIndexSync());
    const [loadingStage, setLoadingStage] = useState('idle');
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Hàm gọi nạp chỉ mục có kiểm soát (Lazy trigger)
    const initSpatialIndex = useCallback(async () => {
        if (spatialIndex || getCachedSpatialIndexSync()) {
            return spatialIndex || getCachedSpatialIndexSync();
        }

        setLoadingStage('loading');
        const index = await getOrLoadSpatialIndex((stage) => {
            if (isMountedRef.current) setLoadingStage(stage);
        });

        if (isMountedRef.current) {
            setSpatialIndex(index);
            setLoadingStage(index ? 'ready' : 'error');
        }
        return index;
    }, [spatialIndex]);

    // Tìm quận cho 1 tọa độ
    const findDistrict = useCallback(
        (lat, lon, provinceId = null) => {
            const activeIndex = spatialIndex || getCachedSpatialIndexSync();
            if (!activeIndex) return null;
            return classifyCoordinateWithCache(lon, lat, activeIndex, provinceId);
        },
        [spatialIndex],
    );

    // Gom nhóm các xe trong 1 tỉnh thành từng quận
    const groupProvinceVehicles = useCallback(
        (provinceDevices, cruiseByImei, provinceId) => {
            const activeIndex = spatialIndex || getCachedSpatialIndexSync();
            if (!activeIndex) return {};
            return classifyProvinceDevicesIntoDistricts(
                provinceDevices,
                cruiseByImei,
                activeIndex,
                provinceId,
            );
        },
        [spatialIndex],
    );

    return {
        isReady: Boolean(spatialIndex || getCachedSpatialIndexSync()),
        loadingStage,
        initSpatialIndex,
        findDistrict,
        groupProvinceVehicles,
        spatialIndex: spatialIndex || getCachedSpatialIndexSync(),
    };
}
