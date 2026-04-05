import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Department, IncidentType, User } from '../types/common';

type AppState = {
  departments: Department[];
  incidentTypes: IncidentType[];
  user: User | null;
  token: string | null;
  portalView: 'promo' | 'cabinet';
  setDepartments: (departments: Department[]) => void;
  setIncidentTypes: (incidentTypes: IncidentType[]) => void;
  setAuth: (payload: { user: User; token: string }) => void;
  setUser: (user: User | null) => void;
  setPortalView: (view: 'promo' | 'cabinet') => void;
  clearAuth: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      departments: [],
      incidentTypes: [],
      user: null,
      token: null,
      portalView: 'promo',
      setDepartments: (departments) => set({ departments }),
      setIncidentTypes: (incidentTypes) => set({ incidentTypes }),
      setAuth: ({ user, token }) =>
        set({
          user,
          token,
          portalView:
            user.role === 'Администратор' || user.role === 'Контроль качества' ? 'cabinet' : 'promo',
        }),
      setUser: (user) => set({ user }),
      setPortalView: (portalView) => set({ portalView }),
      clearAuth: () => set({ user: null, token: null, portalView: 'promo' }),
    }),
    {
      name: 'medportal-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        portalView: state.portalView,
      }),
    },
  ),
);
