
export function handleTokenExpiration(error: any) {
  if (error?.error === "token_expired" || error?.msg === "Token has expired") {
    localStorage.removeItem("access_token")
    window.location.href = "/"
    return true
  }
  return false
}
