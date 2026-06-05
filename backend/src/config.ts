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

function parsePositiveIntEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw == null || raw.trim() === "") return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

export const config = {
  port: parseInt(getEnv("PORT", "5000"), 10),
  sqliteDbPath: getEnv("SQLITE_DB_PATH", ""),
  demoMode: ["1", "true", "yes", "on"].includes((process.env.DEMO_MODE ?? "").toLowerCase()),
  demoSimulationYears: parsePositiveIntEnv("DEMO_SIMULATION_YEARS", 10),
  jwt: {
    secretKey: getEnv("JWT_SECRET_KEY", "fallback-secret-key-for-development"),
    accessTokenExpiresSec: parseInt(getEnv("JWT_ACCESS_TOKEN_EXPIRES", "3600"), 10),
    refreshTokenExpiresSec: parseInt(getEnv("JWT_REFRESH_TOKEN_EXPIRES", "2592000"), 10),
  },
  ai: {
    openRouterApiKey: process.env.OPENROUTER_API_KEY?.trim() ?? "",
    model: getEnv("AI_MODEL", "deepseek/deepseek-v4-flash:free"),
    endpoint: getEnv("AI_ENDPOINT", "https://openrouter.ai/api/v1/chat/completions"),
    maxSteps: parsePositiveIntEnv("AI_MAX_STEPS", 25),
    maxToolResultChars: parsePositiveIntEnv("AI_MAX_TOOL_RESULT_CHARS", 12_000),
    runTtlSec: parsePositiveIntEnv("AI_RUN_TTL_SEC", 3600),
    retryMaxAttempts: parsePositiveIntEnv("AI_RETRY_MAX_ATTEMPTS", 6),
    retryBaseDelayMs: parsePositiveIntEnv("AI_RETRY_BASE_DELAY_MS", 1500),
    /** Wall-clock limit for a single agent run (seconds). */
    runTimeoutSec: parsePositiveIntEnv("AI_RUN_TIMEOUT_SEC", 600),
    /** Per HTTP request retries inside the OpenRouter client (run-level retries are separate). */
    httpMaxRetries: parsePositiveIntEnv("AI_HTTP_MAX_RETRIES", 3),
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
