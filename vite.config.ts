import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [".github/workflows/cd.yml"],
  },
  lint: {
    ignorePatterns: ["**/*.test.ts", "**/*.test.tsx"],
    options: { typeAware: true, typeCheck: true },
  },
  staged: {
    "*": "vp check --fix",
  },
});
