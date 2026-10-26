'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

 
const BAR_ID = 'iky-route-progress-bar';

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
            height: 3px;
            width: 0%;
            background: linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #0ea5e9 100%);
            z-index: 9999999;
            pointer-events: none;
            opacity: 0;
            border-radius: 0 2px 2px 0;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.8), 0 0 5px #0284c7;
            transition: width 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.25s ease;
        }
        #${BAR_ID}.animating {
            opacity: 1;
        }
        #${BAR_ID}.done {
            width: 100% !important;
            opacity: 0;
            transition: width 0.15s ease, opacity 0.35s ease 0.15s;
        }
    `;
    document.head.appendChild(style);
}

let progressTimer = null;
let currentProgress = 0;
let autoTimeoutTimer = null;

function getBarElement() {
    if (typeof document === 'undefined') return null;
    injectStyles();
    let bar = document.getElementById(BAR_ID);
    if (!bar) {
        bar = document.createElement('div');
        bar.id = BAR_ID;
        document.body.appendChild(bar);
    }
    return bar;
}

export function startProgress() {
    if (typeof window === 'undefined') return;
    const bar = getBarElement();
    if (!bar) return;

    if (progressTimer) clearInterval(progressTimer);
    if (autoTimeoutTimer) clearTimeout(autoTimeoutTimer);

    bar.classList.remove('done');
    bar.classList.add('animating');
    currentProgress = 20;
    bar.style.width = `${currentProgress}%`;

    // Trickle progress while waiting
    progressTimer = setInterval(() => {
        if (currentProgress < 65) {
            currentProgress += Math.random() * 10 + 6;
        } else if (currentProgress < 85) {
            currentProgress += Math.random() * 3 + 1;
        } else if (currentProgress < 94) {
            currentProgress += 0.3;
        }
        if (bar) bar.style.width = `${Math.min(currentProgress, 94)}%`;
    }, 180);

    // Safety timeout: tự động ẩn sau 7s nếu navigation bị hủy
    autoTimeoutTimer = setTimeout(() => {
        completeProgress();
    }, 7000);
}

export function completeProgress() {
    if (typeof window === 'undefined') return;
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    if (autoTimeoutTimer) {
        clearTimeout(autoTimeoutTimer);
        autoTimeoutTimer = null;
    }

    const bar = document.getElementById(BAR_ID);
    if (!bar) return;

    currentProgress = 100;
    bar.style.width = '100%';
    bar.classList.add('done');
    bar.classList.remove('animating');

    setTimeout(() => {
        if (bar && !bar.classList.contains('animating')) {
            bar.style.width = '0%';
            bar.classList.remove('done');
            currentProgress = 0;
        }
    }, 450);
}

function RouteProgressBarInner() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Hoàn thành progress khi route change đã hoàn tất và trang mới mount
    useEffect(() => {
        completeProgress();
    }, [pathname, searchParams]);

    // Bắt sự kiện click vào bất kỳ link nội bộ nào để bật progress NGAY LẬP TỨC
    useEffect(() => {
        const handleClick = (e) => {
            const anchor = e.target.closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            // Bỏ qua external links, new tab, download, hash, mailto, tel
            if (
                anchor.target === '_blank' ||
                anchor.hasAttribute('download') ||
                (href.startsWith('http') && !href.startsWith(window.location.origin)) ||
                href.startsWith('mailto:') ||
                href.startsWith('tel:') ||
                href.startsWith('#')
            ) {
                return;
            }

            try {
                const targetUrl = new URL(anchor.href, window.location.href);
                if (
                    targetUrl.pathname === window.location.pathname &&
                    targetUrl.search === window.location.search
                ) {
                    return;
                }
            } catch (_) {}

            startProgress();
        };

        // Monkey patch history.pushState / replaceState để bắt programmatic navigation (router.push)
        const origPushState = window.history.pushState;
        const origReplaceState = window.history.replaceState;

        window.history.pushState = function (...args) {
            try {
                const newUrl = args[2];
                if (newUrl && String(newUrl) !== window.location.href) {
                    startProgress();
                }
            } catch (_) {}
            return origPushState.apply(this, args);
        };

        window.history.replaceState = function (...args) {
            try {
                const newUrl = args[2];
                if (newUrl && String(newUrl) !== window.location.href) {
                    startProgress();
                }
            } catch (_) {}
            return origReplaceState.apply(this, args);
        };

        document.addEventListener('click', handleClick, { capture: true });

        return () => {
            document.removeEventListener('click', handleClick, { capture: true });
            window.history.pushState = origPushState;
            window.history.replaceState = origReplaceState;
            completeProgress();
        };
    }, []);

    return null;
}

export default function RouteProgressBar() {
    return (
        <Suspense fallback={null}>
            <RouteProgressBarInner />
        </Suspense>
    );
}
