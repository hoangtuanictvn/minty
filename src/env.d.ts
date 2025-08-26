// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PRIVY_APP_ID: string
    readonly VITE_X_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
