export interface User {
  name: string;
  email: string;
  avatar?: string;
  /** From `GET /users` / session refresh; omit only on partial refresh payloads. */
  preferred_currency?: string;
}
