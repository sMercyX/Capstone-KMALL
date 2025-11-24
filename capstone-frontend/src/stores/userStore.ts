import { create } from "zustand";
import { useUserApi, type User } from "../api/userApi";

type Role = "Buyer" | "Seller" | "Admin";

interface UserState {
  id: string;
  name: string;
  email: string;
  role: Role;
  isLoading: boolean;
  setUser: (user: Partial<UserState>) => void;
  fetchUser: () => Promise<void>;
  clearUser: () => void;
}

const { getMe } = useUserApi();

function normalizeRoleFromUser(u: User | null): Role {
  if (!u || !u.roles || u.roles.length === 0) return "Buyer";

  const raw = u.roles[0].toLowerCase();
  switch (raw) {
    case "buyer":
      return "Buyer";
    case "seller":
      return "Seller";
    case "admin":
      return "Admin";
    default:
      return "Buyer";
  }
}

export const useUserStore = create<UserState>((set) => ({
  id: "",
  name: "",
  email: "",
  role: "Buyer",
  isLoading: false,

  setUser: (user) => set((state) => ({ ...state, ...user })),

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const data = await getMe();

      set({
        id: data.id,
        name: data.name,
        email: data.email,
        role: normalizeRoleFromUser(data),
        isLoading: false,
      });
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  clearUser: () =>
    set({
      id: "",
      name: "",
      email: "",
      role: "Buyer",
      isLoading: false,
    }),
}));
