/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  readonly GROQ_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
