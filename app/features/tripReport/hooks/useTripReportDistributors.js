import { useCallback, useEffect, useState } from 'react';

export function useTripReportDistributors({ getUserList }) {
    const [distributorMap, setDistributorMap] = useState({});

    const getDistributorLabel = useCallback(
        (id) => {
            if (!id) return '';
            return distributorMap[id] || id;
        },
        [distributorMap],
    );

    useEffect(() => {
        const fetchDistributors = async () => {
            try {
                const res = await getUserList({ position: 'distributor' });
                const items = res?.items || res?.data || [];

                const map = {};
                items.forEach((item) => {
                    const label = (item.name && item.name.trim()) || item.email || item.username;
                    map[item._id] = label;
                });

                setDistributorMap(map);
            } catch (err) {
                console.error('Lỗi lấy danh sách đại lý: ', err);
            }
        };

        fetchDistributors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { distributorMap, getDistributorLabel };
}
