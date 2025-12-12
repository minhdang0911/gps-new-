import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            hydrated: false,

            setUser: (user) => set({ user }),
            clearUser: () => set({ user: null }),

            setHydrated: (v) => set({ hydrated: v }),
        }),
        {
            name: 'iky_user',
            partialize: (state) => ({ user: state.user }),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('rehydrate error', error);
                }

                state?.setHydrated(true);
            },
        },
    ),
);
