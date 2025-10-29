import { create } from 'zustand'
import { useUserApi } from '../api/userApi'

type Role = 'Buyer' | 'Seller'

interface UserState {
  id: string
  name: string
  email: string
  role: Role
  isLoading: boolean
  setUser: (user: Partial<UserState>) => void
  fetchUser: () => Promise<void>
  clearUser: () => void
}

const userApi = useUserApi()

export const useUserStore = create<UserState>((set) => ({
  id: '',
  name: '',
  email: '',
  role: 'Buyer',
  isLoading: false,

  setUser: (user) => set((state) => ({ ...state, ...user })),

  fetchUser: async () => {
    set({ isLoading: true })
    try {
      const data = await userApi.getDetail('test')
      set({ ...data, isLoading: false })
    } catch (error) {
      console.error(error)
      set({ isLoading: false })
    }
  },

  clearUser: () => set({ id: '', name: '', email: '', role: 'Buyer' }),
}))
