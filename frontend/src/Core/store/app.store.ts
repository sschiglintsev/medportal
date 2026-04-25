import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { userHasCabinetAccess } from '../cabinetAccess';
import type { Department, IncidentType, OrganizationProfile, User } from '../types/common';

type AppState = {
  departments: Department[];
  incidentTypes: IncidentType[];
  user: User | null;
  token: string | null;
  portalView: 'promo' | 'cabinet';
  organization: OrganizationProfile | null;
  setDepartments: (departments: Department[]) => void;
  setIncidentTypes: (incidentTypes: IncidentType[]) => void;
  setAuth: (payload: { user: User; token: string }) => void;
  setUser: (user: User | null) => void;
  setPortalView: (view: 'promo' | 'cabinet') => void;
  setOrganization: (org: OrganizationProfile) => void;
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
      organization: null,
      setDepartments: (departments) => set({ departments }),
      setIncidentTypes: (incidentTypes) => set({ incidentTypes }),
      setOrganization: (organization) => set({ organization }),
      setAuth: ({ user, token }) =>
        set({
          user,
          token,
          portalView: userHasCabinetAccess(user.permissions) ? 'cabinet' : 'promo',
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
