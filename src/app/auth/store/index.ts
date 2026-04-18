import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'
import useCookie, { deleteCookie, getCookie, setCookie } from '../hooks/useCookie'

export const useAuthStore = create<any>()(
  (set, get) => ({
    token: getCookie('access_token') || null,
    payload: getCookie('access_token') ? jwtDecode(getCookie('access_token')!) : null,

    getUserRole: () => {
      const { payload } = get();
      return payload?.role || 'USER';
    },

    isAgent: () => {
      return get().getUserRole() === 'AGENT';
    },

    isAdmin: () => {
      return get().getUserRole() === 'ADMIN';
    },

    isManagement: () => {
      const role = get().getUserRole();
      return role === 'AGENT' || role === 'ADMIN';
    },

    login: (token: string) => {
      setCookie('access_token', token, 1)
      set({
        token,
        payload: jwtDecode(token),
      })
    },

    logout: () => {
      deleteCookie('access_token')
      set({
        token: null,
        payload: null,
      })
    }
  })
)
