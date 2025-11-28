'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReportHomePage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/report/usage-session');
    }, []);

    return null;
}
