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
            // Mirror tokens ra legacy keys để backward compat
            try {
                const { state } = JSON.parse(value);
                if (state.accessToken) localStorage.setItem('accessToken', state.accessToken);
                else localStorage.removeItem('accessToken');
                if (state.refreshToken) localStorage.setItem('refreshToken', state.refreshToken);
                else localStorage.removeItem('refreshToken');
            } catch {}
        },

        removeItem: (name) => {
            localStorage.removeItem(name);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
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

            setUser: (user) => set({ user }),
            clearUser: () => set({ user: null }), // compat

            /** Lưu token mới — chỉ ghi field nào được cung cấp (non-null) */
            setTokens: (access, refresh) =>
                set((s) => ({
                    ...(access  != null ? { accessToken:  access  } : {}),
                    ...(refresh != null ? { refreshToken: refresh } : {}),
                })),

            clearTokens: () => set({ accessToken: null, refreshToken: null }),

            /** Xóa toàn bộ auth state (logout) */
            clearAll: () => set({ user: null, accessToken: null, refreshToken: null }),

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

                state?.setHydrated(true);
            },
        },
    ),
);
