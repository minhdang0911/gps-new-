'use client';

import React, { useEffect, useRef } from 'react';
import { MAP4D_LOCATIONS } from '../data/map4d';
import { useMap4dSdk } from '../hooks/useMap4dSdk';
import styles from '../SupportPage.module.css';

export default function Map4DView({ location }) {
    const mapContainerRef = useRef(null);
    const sdkReady = useMap4dSdk();

    useEffect(() => {
        if (!sdkReady) return;
        if (!mapContainerRef.current) return;

        const cfg = MAP4D_LOCATIONS[location] || MAP4D_LOCATIONS.hcm;

        const map = new window.map4d.Map(mapContainerRef.current, {
            center: cfg.center,
            zoom: cfg.zoom,
            controls: true,
        });

        const poi = new window.map4d.POI({
            position: cfg.center,
            title: cfg.title,
            type: cfg.type,
        });
        poi.setMap(map);

        return () => {
            poi.setMap(null);
            if (map.destroy) map.destroy();
        };
    }, [sdkReady, location]);

    return (
        <div className={styles.mapShell}>
            {!sdkReady && (
                <div className={styles.mapLoading}>
                    <span>Đang tải bản đồ…</span>
                </div>
            )}
            <div ref={mapContainerRef} className={styles.mapFrame} />
        </div>
    );
}
