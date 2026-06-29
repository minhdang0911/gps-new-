'use client';

/**
 * TokenRefresher — "Never log out" session manager
 * ─────────────────────────────────────────────────
 * Chiến lược:
 *  1. Decode JWT để lấy expiry — không cần gọi API thêm
 *  2. Schedule proactive refresh TRƯỚC 2 phút khi access token hết hạn
 *  3. API trả refreshToken mới mỗi lần → sliding 30 ngày → session vô hạn
 *  4. Dùng chung lock với axios interceptor → không bao giờ double-refresh
 *  5. Wake-up handler khi máy ngủ / tab ẩn → refresh ngay khi quay lại
 *  6. Lỗi mạng → retry sau 30s, KHÔNG redirect login
 *  7. BroadcastChannel → đồng bộ token giữa nhiều tab
 *
 * Chỉ redirect /login khi:
 *  - Refresh token thực sự hết hạn (401/403 từ server)
 *  - Refresh token bị xóa khỏi storage
 */

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { proactiveRefresh } from '../lib/api/axios';

// Access token 15 phút → refresh trước 2 phút → timer 13 phút
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;   // 2 phút buffer
const FALLBACK_INTERVAL_MS     = 13 * 60 * 1000;  // fallback nếu không decode được JWT
const RETRY_ON_NETWORK_MS      = 30 * 1000;        // retry lỗi mạng sau 30s
const VISIBILITY_DEBOUNCE_MS   = 4 * 1000;         // debounce alt-tab

// ── Decode JWT exp (không verify, chỉ đọc payload) ────────────────
function getJwtExpiry(token) {
    try {
        if (!token) return null;
        const b64 = token.split('.')[1];
        if (!b64) return null;
        const json = JSON.parse(atob(b64.replace(/-/g, '+').replace(/_/g, '/')));
        return json.exp ? json.exp * 1000 : null; // seconds → ms
    } catch {
        return null;
    }
}

function getTokens() {
    if (typeof window === 'undefined') return {};
    return {
        accessToken:  localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
    };
}

// ── BroadcastChannel: sync token updates giữa nhiều tab ───────────
const CHANNEL_NAME = 'iky_token_sync';
let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
}

export function broadcastNewTokens() {
    broadcastChannel?.postMessage({ type: 'TOKEN_REFRESHED' });
}

// ─────────────────────────────────────────────────────────────────
export default function TokenRefresher() {
    const router   = useRouter();
    const pathname = usePathname();

    const timerRef     = useRef(null);
    const retryRef     = useRef(null);
    const routerRef    = useRef(router);
    const scheduleRef  = useRef(null);

    useEffect(() => { routerRef.current = router; }, [router]);

    useEffect(() => {
        // Không chạy ở trang login
        if (!pathname || pathname.startsWith('/login')) {
            clearTimeout(timerRef.current);
            return;
        }

        // ── Hàm thực hiện 1 lần refresh ─────────────────────────────
        const doRefresh = async () => {
            clearTimeout(retryRef.current);
            try {
                await proactiveRefresh(); // dùng chung lock với axios interceptor
                broadcastNewTokens();     // báo các tab khác cập nhật token
                scheduleRef.current?.(); // schedule lần tiếp theo
            } catch (err) {
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    // Token thực sự hết hạn → logout
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('role');
                    localStorage.removeItem('iky_user');
                    localStorage.removeItem('currentUser');
                    routerRef.current.replace('/login');
                    return;
                }
                // Lỗi mạng / server tạm thời → KHÔNG logout, retry sau 30s
                console.warn('[TokenRefresher] refresh failed (network?), retry in 30s');
                retryRef.current = setTimeout(doRefresh, RETRY_ON_NETWORK_MS);
            }
        };

        // ── Schedule lần refresh tiếp theo ───────────────────────────
        const schedule = () => {
            clearTimeout(timerRef.current);
            clearTimeout(retryRef.current);

            const { accessToken, refreshToken } = getTokens();

            if (!refreshToken) {
                // Không có refresh token → đã logout hoặc bị xóa
                routerRef.current.replace('/login');
                return;
            }

            if (!accessToken) {
                // Không có access token nhưng còn refresh → refresh ngay
                doRefresh();
                return;
            }

            const expiry  = getJwtExpiry(accessToken);
            const now     = Date.now();

            if (expiry) {
                const remaining = expiry - now;
                if (remaining <= REFRESH_BEFORE_EXPIRY_MS) {
                    // Token đã hết hạn hoặc sắp hết → refresh ngay
                    doRefresh();
                    return;
                }
                // Schedule đúng thời điểm: hết hạn - 2 phút
                timerRef.current = setTimeout(doRefresh, remaining - REFRESH_BEFORE_EXPIRY_MS);
            } else {
                // Không decode được JWT → dùng fallback interval 13 phút
                timerRef.current = setTimeout(doRefresh, FALLBACK_INTERVAL_MS);
            }
        };

        scheduleRef.current = schedule;
        schedule(); // Chạy ngay khi mount / khi pathname thay đổi

        // ── Wake-up: resume sau khi máy ngủ / tab ẩn ────────────────
        let visTimer = null;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            clearTimeout(visTimer);
            visTimer = setTimeout(() => {
                const { accessToken } = getTokens();
                const expiry = getJwtExpiry(accessToken);
                const isExpiredOrSoon = !expiry || Date.now() >= expiry - REFRESH_BEFORE_EXPIRY_MS;
                if (isExpiredOrSoon) doRefresh();
            }, VISIBILITY_DEBOUNCE_MS);
        };
        document.addEventListener('visibilitychange', onVisible);

        // ── BroadcastChannel: nhận token mới từ tab khác ─────────────
        const onBroadcast = (e) => {
            if (e.data?.type === 'TOKEN_REFRESHED') {
                // Tab khác vừa refresh → reschedule timer theo token mới
                schedule();
            }
        };
        broadcastChannel?.addEventListener('message', onBroadcast);

        return () => {
            clearTimeout(timerRef.current);
            clearTimeout(retryRef.current);
            clearTimeout(visTimer);
            document.removeEventListener('visibilitychange', onVisible);
            broadcastChannel?.removeEventListener('message', onBroadcast);
        };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return null;
}
