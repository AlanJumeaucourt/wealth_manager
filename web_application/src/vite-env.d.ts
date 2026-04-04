/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "*.css" {}

/** Vite injects env at build time; keep keys in sync with `.env*`. */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
