const DEV_JWT_FALLBACK = "fallback-secret-key-for-development";

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value && (key === "SQLITE_DB_PATH" || key === "JWT_SECRET_KEY")) {
    if (key === "JWT_SECRET_KEY" && process.env.NODE_ENV === "development") {
      return DEV_JWT_FALLBACK;
    }
    if (key === "SQLITE_DB_PATH" && process.env.NODE_ENV === "test") {
      return "";
    }
    if (
      key === "SQLITE_DB_PATH" &&
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test"
    ) {
      return "wealth.sqlite";
    }
    throw new Error(`${key} environment variable must be set`);
  }
  return value!;
}

export const config = {
  port: parseInt(getEnv("PORT", "5000"), 10),
  sqliteDbPath: getEnv("SQLITE_DB_PATH", ""),
  jwt: {
    secretKey: getEnv("JWT_SECRET_KEY", "fallback-secret-key-for-development"),
    accessTokenExpiresSec: parseInt(getEnv("JWT_ACCESS_TOKEN_EXPIRES", "3600"), 10),
    refreshTokenExpiresSec: parseInt(getEnv("JWT_REFRESH_TOKEN_EXPIRES", "2592000"), 10),
  },
};

if (!config.sqliteDbPath && process.env.NODE_ENV !== "test") {
  throw new Error("SQLITE_DB_PATH environment variable must be set");
}

// Reject weak JWT secret in production
if (
  process.env.NODE_ENV === "production" &&
  (config.jwt.secretKey === DEV_JWT_FALLBACK || (config.jwt.secretKey?.length ?? 0) < 32)
) {
  throw new Error(
    "JWT_SECRET_KEY must be set to a strong secret (at least 32 characters) in production",
  );
}
