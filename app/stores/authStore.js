import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// storage giả khi SSR (server không có localStorage)
const noopStorage = {
    getItem: (_key) => null,
    setItem: (_key, _value) => {},
    removeItem: (_key) => {},
};

const storage =
    typeof window === 'undefined'
        ? noopStorage
        : {
              getItem: (name) => localStorage.getItem(name),
              setItem: (name, value) => localStorage.setItem(name, value),
              removeItem: (name) => localStorage.removeItem(name),
          };

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
            storage: createJSONStorage(() => storage),
            partialize: (state) => ({ user: state.user }),
            onRehydrateStorage: () => (state, error) => {
                if (error) console.error('[zustand] rehydrate error', error);
                state?.setHydrated(true);
            },
        },
    ),
);
