// app/manage/user/hooks/useManageUserTour.js
import { useMemo } from 'react';
import { useGuidedTour } from '../../../hooks/common/useGuidedTour';

export function useManageUserTour({ isEnglish, canExport, canCreate }) {
    const tourSteps = useMemo(() => {
        const steps = [
            {
                element: '[data-tour="searchBox"]',
                intro: isEnglish
                    ? 'Use these filters to find users.'
                    : 'Dùng các bộ lọc này để tìm người dùng nhanh.',
            },
            {
                element: '[data-tour="roleFilter"]',
                intro: isEnglish ? 'Filter users by role.' : 'Lọc người dùng theo vai trò.',
            },
            {
                element: '[data-tour="table"]',
                intro: isEnglish ? 'This table shows the user list.' : 'Bảng hiển thị danh sách người dùng.',
            },
        ];
        if (canExport) {
            steps.push({
                element: '[data-tour="exportBtn"]',
                intro: isEnglish ? 'Export to Excel.' : 'Xuất danh sách ra Excel.',
            });
        }
        if (canCreate) {
            steps.push({
                element: '[data-tour="addBtn"]',
                intro: isEnglish ? 'Create new user.' : 'Tạo người dùng mới.',
            });
        }
        return steps;
    }, [isEnglish, canExport, canCreate]);

    return useGuidedTour({ isEn: isEnglish, enabled: true, steps: tourSteps });
}
