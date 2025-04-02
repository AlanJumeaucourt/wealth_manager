import { useQuery } from '@tanstack/react-query'
import { API_URL } from '@/api/queries'
import { userStorage } from '@/utils/user-storage'
import { handleTokenExpiration } from '@/utils/auth'
import { User } from '@/types/user'

async function fetchUser(): Promise<User> {
  const token = userStorage.getToken()

  if (!token) {
    throw new Error('No token found')
  }

  const response = await fetch(`${API_URL}/users/`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    if (handleTokenExpiration(error)) {
      throw new Error('Token expired')
    }
    throw new Error('Failed to fetch user data')
  }

  const userData = await response.json()
  userStorage.setUser(userData)
  userStorage.updateLastFetch()
  return userData
}

export function useUser() {
  const storedUser = userStorage.getUser()
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user'],
    queryFn: fetchUser,
    initialData: storedUser,
    enabled: !!userStorage.getToken(),
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
  })

  return {
    user,
    isLoading: isLoading && !!userStorage.getToken(),
    error
  }
}
