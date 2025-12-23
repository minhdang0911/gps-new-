import { useEffect, useState } from 'react';
import { MAP4D_KEY } from '../data/map4d';

export function useMap4dSdk() {
    const [sdkReady, setSdkReady] = useState(() => {
        // init state ngay từ đầu (client), không cần setState trong effect
        if (typeof window === 'undefined') return false;
        return Boolean(window.map4d);
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // nếu đã có SDK thì thôi (không setState ở đây nữa)
        if (window.map4d) return;

        // callback sẽ chạy khi SDK load xong => setState trong callback OK
        window.__iky_map4d_ready = () => setSdkReady(true);

        const existing = document.querySelector('script[data-map4d-sdk="true"]');
        if (existing) return;

        const script = document.createElement('script');
        script.src = `https://api.map4d.vn/sdk/map/js?version=2.0&key=${MAP4D_KEY}&callback=__iky_map4d_ready`;
        script.async = true;
        script.defer = true;
        script.dataset.map4dSdk = 'true';
        document.head.appendChild(script);

        return () => {
            // cleanup optional: tránh giữ callback global khi unmount
            if (window.__iky_map4d_ready) delete window.__iky_map4d_ready;
        };
    }, []);

    return sdkReady;
}
