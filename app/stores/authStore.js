import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set) => ({
            user: null,
            hydrated: false,

            setUser: (user) => set({ user }),
            clearUser: () => set({ user: null }),

            setHydrated: () => set({ hydrated: true }),
        }),
        {
            name: 'iky_user',
            onRehydrateStorage: () => (state) => {
                state.setHydrated(); // Gọi khi đã hydrate xong
            },
        },
    ),
);
