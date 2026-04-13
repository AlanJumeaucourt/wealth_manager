import { unwrapEden } from "@/api/edenUnwrap";
import { wealthApi } from "@/api/wealthApi";
import { User } from "@/types/user";
import { userStorage } from "@/utils/user-storage";
import { useQuery } from "@tanstack/react-query";

async function fetchUser(): Promise<User> {
  const token = userStorage.getToken();

  if (!token) {
    throw new Error("No token found");
  }

  const userData = await unwrapEden<User>(wealthApi.users.get() as Promise<unknown>);
  userStorage.setUser(userData);
  userStorage.updateLastFetch();
  return userData;
}

export function useUser() {
  const storedUser = userStorage.getUser();
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user"],
    queryFn: fetchUser,
    initialData: storedUser,
    enabled: !!userStorage.getToken(),
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  return {
    user,
    isLoading: isLoading && !!userStorage.getToken(),
    error,
  };
}
