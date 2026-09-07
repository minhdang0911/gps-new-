'use client';

/**
 * TokenRefresher — Session manager
 * ──────────────────────────────────
 * 1. Decode JWT để lấy expiry → schedule proactive refresh trước 2 phút
 * 2. API trả refreshToken mới mỗi lần → sliding 30 ngày → session vô hạn
 * 3. Dùng chung lock với axios interceptor → không bao giờ double-refresh
 * 4. Wake-up handler khi máy ngủ / tab ẩn → refresh ngay khi quay lại
 * 5. Lỗi mạng → retry sau 30s, KHÔNG redirect login
 * 6. Đọc/ghi token qua Zustand store (không BroadcastChannel — per-tab là đủ)
 *
 * Chỉ redirect /login khi refresh token thực sự hết hạn (401/403 từ server)
 */

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { proactiveRefresh } from '../lib/api/axios';
import { useAuthStore } from '../stores/authStore';

const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;  // 2 phút buffer
const FALLBACK_INTERVAL_MS     = 13 * 60 * 1000; // fallback nếu không decode được JWT
const RETRY_ON_NETWORK_MS      = 30 * 1000;       // retry lỗi mạng sau 30s
const VISIBILITY_DEBOUNCE_MS   = 4 * 1000;        // debounce alt-tab

function getJwtExpiry(token) {
    try {
        if (!token) return null;
        const b64 = token.split('.')[1];
        if (!b64) return null;
        const json = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
        return json.exp ? json.exp * 1000 : null;
    } catch {
        return null;
    }
}

export default function TokenRefresher() {
    const router   = useRouter();
    const pathname = usePathname();

    const timerRef    = useRef(null);
    const retryRef    = useRef(null);
    const routerRef   = useRef(router);
    const scheduleRef = useRef(null);

    useEffect(() => { routerRef.current = router; }, [router]);

    useEffect(() => {
        if (!pathname || pathname.startsWith('/login')) {
            clearTimeout(timerRef.current);
            return;
        }

        // ── Thực hiện 1 lần refresh ───────────────────────────────────
        const doRefresh = async () => {
            clearTimeout(retryRef.current);
            try {
                await proactiveRefresh();
                // Token mới đã được lưu vào store bởi proactiveRefresh
                scheduleRef.current?.(); // schedule lần tiếp theo
            } catch (err) {
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    // proactiveRefresh đã gọi clearAll() + dispatch auth:logout
                    // useAuthLogout sẽ handle redirect → không cần làm gì thêm
                    return;
                }
                // Lỗi mạng / server tạm thời → KHÔNG logout, retry sau 30s
                console.warn('[TokenRefresher] refresh failed (network?), retry in 30s');
                retryRef.current = setTimeout(doRefresh, RETRY_ON_NETWORK_MS);
            }
        };

        // ── Schedule lần refresh tiếp theo ────────────────────────────
        const schedule = () => {
            clearTimeout(timerRef.current);
            clearTimeout(retryRef.current);

            const { accessToken, refreshToken } = useAuthStore.getState();

            if (!refreshToken) {
                routerRef.current.replace('/login');
                return;
            }

            if (!accessToken) {
                doRefresh();
                return;
            }

            const expiry = getJwtExpiry(accessToken);
            const now    = Date.now();

            if (expiry) {
                const remaining = expiry - now;
                if (remaining <= REFRESH_BEFORE_EXPIRY_MS) {
                    doRefresh();
                    return;
                }
                timerRef.current = setTimeout(doRefresh, remaining - REFRESH_BEFORE_EXPIRY_MS);
            } else {
                // Không decode được JWT → fallback interval
                timerRef.current = setTimeout(doRefresh, FALLBACK_INTERVAL_MS);
            }
        };

        scheduleRef.current = schedule;
        schedule();

        // ── Wake-up: resume sau khi máy ngủ / tab ẩn ─────────────────
        let visTimer = null;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            clearTimeout(visTimer);
            visTimer = setTimeout(() => {
                const { accessToken } = useAuthStore.getState();
                const expiry = getJwtExpiry(accessToken);
                if (!expiry || Date.now() >= expiry - REFRESH_BEFORE_EXPIRY_MS) doRefresh();
            }, VISIBILITY_DEBOUNCE_MS);
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearTimeout(timerRef.current);
            clearTimeout(retryRef.current);
            clearTimeout(visTimer);
            document.removeEventListener('visibilitychange', onVisible);
        };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return null;
}
