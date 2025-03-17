import { API_URL } from '@/api/queries'
import { User } from '@/types/user'



export const userStorage = {
  getToken: () => localStorage.getItem('access_token'),

  getUser: (): User | null => {
    const userData = localStorage.getItem('user')
    return userData ? JSON.parse(userData) : null
  },

  setUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('lastUserFetch', Date.now().toString())
  },

  updateLastFetch: () => {
    localStorage.setItem('lastUserFetch', Date.now().toString())
  },

  shouldFetchUser: () => {
    const lastFetch = localStorage.getItem('lastUserFetch')
    if (!lastFetch) return true
    // Refetch if last fetch was more than 5 minutes ago
    return Date.now() - parseInt(lastFetch) > 5 * 60 * 1000
  },

  fetchUser: async () => {
    const response = await fetch(`${API_URL}/users/`, {
      headers: { 'Authorization': `Bearer ${userStorage.getToken()}` }
    })
    if (response.ok) {
      const user = await response.json()
      userStorage.setUser(user)
      userStorage.updateLastFetch()
    }
  }
}
