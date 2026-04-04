import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: [".github/workflows/cd.yml"],
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  staged: {
    "*": "vp check --fix",
  },
});
