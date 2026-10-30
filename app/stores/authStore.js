import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Custom storage adapter:
 *  - Lưu state JSON dưới key 'iky_user' (như cũ)
 *  - Đồng thời mirror accessToken/refreshToken ra localStorage keys riêng
 *    → mọi code cũ dùng localStorage.getItem('accessToken') vẫn hoạt động
 */
const buildStorage = () => {
    if (typeof window === 'undefined') {
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    }
    return {
        getItem: (name) => {
            const stored = localStorage.getItem(name);
            if (stored) return stored;

            // Migration lần đầu sau upgrade: reconstruct từ legacy keys
            try {
                const user =
                    JSON.parse(localStorage.getItem('currentUser') || 'null') ||
                    JSON.parse(localStorage.getItem('iky_user') || 'null')?.state?.user ||
                    null;
                return JSON.stringify({
                    state: {
                        user,
                        accessToken: localStorage.getItem('accessToken') || null,
                        refreshToken: localStorage.getItem('refreshToken') || null,
                    },
                });
            } catch {
                return null;
            }
        },

        setItem: (name, value) => {
            localStorage.setItem(name, value);
            // Mirror tokens & role ra legacy keys để backward compat
            try {
                const { state } = JSON.parse(value);
                if (state.accessToken) localStorage.setItem('accessToken', state.accessToken);
                else localStorage.removeItem('accessToken');
                if (state.refreshToken) localStorage.setItem('refreshToken', state.refreshToken);
                else localStorage.removeItem('refreshToken');

                const role = state?.user?.position || state?.user?.role || '';
                if (role) localStorage.setItem('role', role);
                if (state?.user?._id) localStorage.setItem('userid', String(state.user._id));
            } catch {}
        },

        removeItem: (name) => {
            localStorage.removeItem(name);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('role');
            localStorage.removeItem('userid');
        },
    };
};

const authStorage = buildStorage();

export const useAuthStore = create(
    persist(
        (set) => ({
            user:         null,
            accessToken:  null,
            refreshToken: null,
            hydrated:     false,

            setUser: (user) => {
                if (typeof window !== 'undefined' && user) {
                    const role = user.position || user.role || '';
                    if (role) localStorage.setItem('role', role);
                    if (user._id) localStorage.setItem('userid', String(user._id));
                }
                set({ user });
            },
            clearUser: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('role');
                    localStorage.removeItem('userid');
                }
                set({ user: null });
            }, // compat

            /** Lưu token mới — chỉ ghi field nào được cung cấp (non-null) */
            setTokens: (access, refresh) =>
                set((s) => ({
                    ...(access  != null ? { accessToken:  access  } : {}),
                    ...(refresh != null ? { refreshToken: refresh } : {}),
                })),

            clearTokens: () => set({ accessToken: null, refreshToken: null }),

            /** Xóa toàn bộ auth state (logout) */
            clearAll: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('role');
                    localStorage.removeItem('userid');
                }
                set({ user: null, accessToken: null, refreshToken: null });
            },

            setHydrated: (v) => set({ hydrated: v }),
        }),
        {
            name: 'iky_user',
            storage: createJSONStorage(() => authStorage),
            partialize: (state) => ({
                user:         state.user,
                accessToken:  state.accessToken,
                refreshToken: state.refreshToken,
            }),

            onRehydrateStorage: () => (state, error) => {
                if (error) console.error('[zustand] rehydrate error', error);

                // Migration: nếu store chưa có token nhưng localStorage có → pick up
                if (state && !state.accessToken && typeof window !== 'undefined') {
                    const at = localStorage.getItem('accessToken');
                    const rt = localStorage.getItem('refreshToken');
                    if (at || rt) state.setTokens(at, rt);
                }

                // Luôn bảo đảm role và userid được đồng bộ ra localStorage ngay khi hydrate
                if (state?.user && typeof window !== 'undefined') {
                    const r = state.user.position || state.user.role || '';
                    if (r && !localStorage.getItem('role')) {
                        localStorage.setItem('role', r);
                    }
                    if (state.user._id && !localStorage.getItem('userid')) {
                        localStorage.setItem('userid', String(state.user._id));
                    }
                }

                state?.setHydrated(true);
            },
        },
    ),
);
