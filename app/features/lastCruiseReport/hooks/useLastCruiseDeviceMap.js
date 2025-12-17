import { useEffect, useState } from 'react';
import { getAuthToken } from '../utils';

export function useLastCruiseDeviceMap({ buildImeiToLicensePlateMap }) {
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    useEffect(() => {
        const loadMaps = async () => {
            try {
                setLoadingDeviceMap(true);

                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    return;
                }

                const { imeiToPlate } = await buildImeiToLicensePlateMap(token);
                setImeiToPlate(imeiToPlate || new Map());
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMaps();
    }, [buildImeiToLicensePlateMap]);

    return { imeiToPlate, loadingDeviceMap };
}
