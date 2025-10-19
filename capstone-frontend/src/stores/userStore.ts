import { create } from 'zustand'

export type Role = 'Buyer' | 'Seller'

export interface UserState {
  id: string 
  name: string 
  email: string 
  role: Role 
  setUser: (user: Partial<UserState>) => void
  clearUser: () => void
}


export const useUserStore = create<UserState>((set) => ({
  id: '',
  name: '',
  email: '',
  role: 'Buyer', 

  setUser: (user) => set((state) => ({ ...state, ...user })),
  clearUser: () =>
    set({
      id: '',
      name: '',
      email: '',
      role: 'Buyer',
    }),
}))