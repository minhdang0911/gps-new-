'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * NProgressBar — Loading bar khi route change (Next.js App Router)
 *
 * App Router không có router.events như Pages Router.
 * Trick: detect pathname change → show bar → hide sau 400ms.
 * Dùng thuần CSS animation, không cần thư viện NProgress.
 */

const BAR_ID = 'iky-route-progress';

function injectStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('iky-progress-style')) return;

    const style = document.createElement('style');
    style.id = 'iky-progress-style';
    style.textContent = `
        #${BAR_ID} {
            position: fixed;
            top: 0;
            left: 0;
            width: 0%;
            height: 3px;
            background: linear-gradient(90deg, #1677ff 0%, #4096ff 50%, #69b1ff 100%);
            z-index: 99999;
            transition: width 0.3s ease, opacity 0.4s ease;
            opacity: 0;
            pointer-events: none;
            border-radius: 0 2px 2px 0;
            box-shadow: 0 0 8px rgba(22, 119, 255, 0.6);
        }
        #${BAR_ID}.iky-progress--loading {
            opacity: 1;
            animation: iky-progress-indeterminate 1.4s ease infinite;
        }
        #${BAR_ID}.iky-progress--done {
            width: 100% !important;
            opacity: 0;
            transition: width 0.2s ease, opacity 0.5s ease 0.2s;
        }
        @keyframes iky-progress-indeterminate {
            0%   { width: 0%;   left: 0; }
            50%  { width: 60%;  left: 20%; }
            100% { width: 0%;   left: 100%; }
        }
    `;
    document.head.appendChild(style);
}

function showProgress() {
    if (typeof document === 'undefined') return;
    injectStyles();
    let bar = document.getElementById(BAR_ID);
    if (!bar) {
        bar = document.createElement('div');
        bar.id = BAR_ID;
        document.body.appendChild(bar);
    }
    bar.className = 'iky-progress--loading';
}

function hideProgress() {
    if (typeof document === 'undefined') return;
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    bar.className = 'iky-progress--done';
    setTimeout(() => {
        bar.className = '';
    }, 700);
}

function RouteProgressBarInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        showProgress();
        const timer = setTimeout(() => hideProgress(), 350);
        return () => clearTimeout(timer);
    }, [pathname, searchParams]);

    return null;
}

/**
 * RouteProgressBar — Mount 1 lần ở LayoutWrapper
 * Wrapped trong Suspense vì useSearchParams cần Suspense boundary trong App Router.
 */
export default function RouteProgressBar() {
    return (
        <Suspense fallback={null}>
            <RouteProgressBarInner />
        </Suspense>
    );
}
