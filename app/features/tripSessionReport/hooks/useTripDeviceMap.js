import { useEffect, useState } from 'react';
import { getAuthToken } from '../utils';

export function useTripDeviceMap({ buildImeiToLicensePlateMap }) {
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
                const { imeiToPlate, plateToImeis } = await buildImeiToLicensePlateMap(token);
                setImeiToPlate(imeiToPlate);
                setPlateToImeis(plateToImeis);
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
