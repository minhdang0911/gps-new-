// app/manage/devices/hooks/useDeviceTourConfig.js
import { useMemo } from 'react';
import { useGuidedTour } from '../../../hooks/common/useGuidedTour';

export function useDeviceTourConfig({ isEnglish, viewMode, canAddDevice }) {
    const tourSteps = useMemo(() => {
        const steps = [
            {
                element: '[data-tour="filters"]',
                intro: isEnglish ? 'Use filters to quickly find devices.' : 'Dùng bộ lọc để tìm thiết bị nhanh.',
            },
            {
                element: '[data-tour="searchBtn"]',
                intro: isEnglish ? 'Click to search with current filters.' : 'Bấm để tìm theo bộ lọc hiện tại.',
            },
            {
                element: '[data-tour="cmdk"]',
                intro: isEnglish ? 'Press Ctrl+K to open Command Bar.' : 'Nhấn Ctrl+K để mở Command Bar.',
            },
            {
                element: '[data-tour="table"]',
                intro: isEnglish ? 'This is the device list.' : 'Đây là danh sách thiết bị.',
            },
        ];

        if (canAddDevice) {
            steps.push({
                element: '[data-tour="addBtn"]',
                intro: isEnglish ? 'Admins can add new devices here.' : 'Admin có thể thêm thiết bị ở đây.',
            });
        }
        return steps;
    }, [isEnglish, canAddDevice]);

    return useGuidedTour({
        isEn: isEnglish,
        enabled: viewMode === 'list',
        steps: tourSteps,
    });
}
