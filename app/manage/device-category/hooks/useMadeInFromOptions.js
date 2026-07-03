'use client';

import useSWR from 'swr';
import { message } from 'antd';
import { useMemo } from 'react';
import { getMadeInFromOptions } from '../../../lib/api/deviceCategory';

export function useMadeInFromOptions({ t }) {
    const { data, isLoading, mutate, isValidating } = useSWR('madeInFromOptions', () => getMadeInFromOptions(), {
        revalidateOnFocus: false,
        dedupingInterval: 60_000,
        onError: (err) => {
            console.error('Load madeInFrom options error:', err);
            message.error(t.loadError);
        },
    });

    const mifOptions = useMemo(() => {
        const res = data || {};
        return Object.entries(res).map(([value, label]) => ({ value, label }));
    }, [data]);

    return {
        mifOptions,
        mifLoading: isLoading,
        mifValidating: isValidating,
        mutateMIF: mutate,
    };
}
