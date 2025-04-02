import { API_URL } from "@/api/queries"
import { QueryClient } from "@tanstack/react-query"
import { userStorage } from "@/utils/user-storage"

interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: number
    email: string
    name: string
  }
}

interface AuthCredentials {
  email: string
  password: string
}

interface RegisterData extends AuthCredentials {
  name: string
}

export const authService = {
  async login(credentials: AuthCredentials) {
    const response = await fetch(`${API_URL}/users/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.msg || "Login failed")
    }

    const data: LoginResponse = await response.json()
    localStorage.setItem("access_token", data.access_token)

    // Store user data from login response
    if (data.user) {
      userStorage.setUser(data.user)
      userStorage.updateLastFetch()
    }

    return data
  },

  async register(data: RegisterData) {
    const response = await fetch(`${API_URL}/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.msg || "Registration failed")
    }

    const responseData: LoginResponse = await response.json()
    localStorage.setItem("access_token", responseData.access_token)
    return responseData
  },

  logout(queryClient?: QueryClient) {
    // Clear all auth-related items from localStorage
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
    localStorage.removeItem("lastUserFetch")

    // Clear any other app-specific data
    localStorage.removeItem("selectedTeam")
    localStorage.removeItem("dateRange")

    // Clear all React Query cache if queryClient is provided
    if (queryClient) {
      queryClient.clear()
    }

    // Clear any other cached data
    sessionStorage.clear()
  },
}
