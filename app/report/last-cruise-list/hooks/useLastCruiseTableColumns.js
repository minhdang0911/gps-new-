// app/report/last-cruise-list/hooks/useLastCruiseTableColumns.js
import { useMemo } from 'react';
import { useReportColumns } from '../../../hooks/useReportColumns';
import { LOCKED_KEYS, STORAGE_KEY } from '../../../features/lastCruiseReport/constants';
import { buildAllColsMeta } from '../../../features/lastCruiseReport/columns/buildAllColsMeta';

export function useLastCruiseTableColumns({ translation, isEnglish, isMobileScreen }) {
    const allColsMeta = useMemo(
        () => buildAllColsMeta({ t: translation, isEn: isEnglish, isMobile: isMobileScreen }),
        [translation, isEnglish, isMobileScreen]
    );

    const { columns, visibleOrder, setVisibleOrder, allColsForModal } = useReportColumns({
        storageKey: STORAGE_KEY,
        allColsMeta,
        lockedKeys: LOCKED_KEYS,
    });

    const colLabelMap = useMemo(() => {
        const mapping = new Map();
        (allColsForModal || []).forEach((col) => mapping.set(col.key, col.label));
        return mapping;
    }, [allColsForModal]);

    const tableColumns = useMemo(() => {
        if (isMobileScreen) return columns;
        const pinnableLeftFields = new Set(['__rowNo', 'lat', 'lon', 'address']);
        let canPinContiguous = true;

        return (columns || []).map((col) => {
            const dataIndex = col?.dataIndex;
            if (canPinContiguous && pinnableLeftFields.has(dataIndex)) {
                return { ...col, fixed: 'left' };
            }
            canPinContiguous = false;
            if (col?.fixed === 'left') {
                const rest = { ...col };
                delete rest.fixed;
                return rest;
            }
            return col;
        });
    }, [columns, isMobileScreen]);

    return {
        columns,
        tableColumns,
        visibleOrder,
        setVisibleOrder,
        allColsForModal,
        colLabelMap,
    };
}
