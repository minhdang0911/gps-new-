import { useEffect, useState } from 'react';
import { getAuthToken } from '../utils';

export function useChargingDeviceMap({ buildImeiToLicensePlateMap }) {
    const [imeiToPlate, setImeiToPlate] = useState(new Map());
    const [plateToImeis, setPlateToImeis] = useState(new Map());
    const [loadingDeviceMap, setLoadingDeviceMap] = useState(false);

    useEffect(() => {
        const loadMaps = async () => {
            try {
                setLoadingDeviceMap(true);

                const token = getAuthToken();
                if (!token) {
                    setImeiToPlate(new Map());
                    setPlateToImeis(new Map());
                    return;
                }

                // buildImeiToLicensePlateMap(token) phải return { imeiToPlate: Map, plateToImeis: Map }
                const res = await buildImeiToLicensePlateMap(token);

                setImeiToPlate(res?.imeiToPlate || new Map());
                setPlateToImeis(res?.plateToImeis || new Map());
            } catch (e) {
                console.error('Load device map failed:', e);
                setImeiToPlate(new Map());
                setPlateToImeis(new Map());
            } finally {
                setLoadingDeviceMap(false);
            }
        };

        loadMaps();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { imeiToPlate, plateToImeis, loadingDeviceMap };
}
