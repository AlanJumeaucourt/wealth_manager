import { unwrapEden } from "@/api/edenUnwrap";
import { wealthApi } from "@/api/wealthApi";
import { userStorage } from "@/utils/user-storage";
import { QueryClient } from "@tanstack/react-query";

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
}

interface AuthCredentials {
  email: string;
  password: string;
}

interface RegisterData extends AuthCredentials {
  name: string;
}

export const authService = {
  async login(credentials: AuthCredentials) {
    const data = await unwrapEden<LoginResponse>(
      wealthApi.users.login.post(credentials as never) as Promise<unknown>,
    );
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);

    if (data.user) {
      userStorage.setUser(data.user);
      userStorage.updateLastFetch();
    }

    return data;
  },

  async register(data: RegisterData) {
    return unwrapEden<Record<string, unknown>>(
      wealthApi.users.register.post(data as never) as Promise<unknown>,
    );
  },

  logout(queryClient?: QueryClient) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("lastUserFetch");

    localStorage.removeItem("selectedTeam");
    localStorage.removeItem("dateRange");

    if (queryClient) {
      queryClient.clear();
    }

    sessionStorage.clear();
  },
};
