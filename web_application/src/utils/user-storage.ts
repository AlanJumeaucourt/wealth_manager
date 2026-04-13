import { unwrapEden } from "@/api/edenUnwrap";
import { wealthApi } from "@/api/wealthApi";
import { User } from "@/types/user";

export const userStorage = {
  getToken: () => localStorage.getItem("access_token"),

  getUser: (): User | null => {
    const userData = localStorage.getItem("user");
    return userData ? JSON.parse(userData) : null;
  },

  setUser: (user: User) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("lastUserFetch", Date.now().toString());
  },

  updateLastFetch: () => {
    localStorage.setItem("lastUserFetch", Date.now().toString());
  },

  shouldFetchUser: () => {
    const lastFetch = localStorage.getItem("lastUserFetch");
    if (!lastFetch) return true;
    return Date.now() - parseInt(lastFetch) > 5 * 60 * 1000;
  },

  fetchUser: async () => {
    try {
      const user = await unwrapEden<User>(wealthApi.users.get() as Promise<unknown>);
      userStorage.setUser(user);
      userStorage.updateLastFetch();
    } catch {
      /* ignore — session may be invalid */
    }
  },
};
