/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PREVIEW_ACCESS_READY?: string;
  readonly VITE_TEND_PREVIEW_AUTO_SYNC_ENABLED?: string;
  readonly VITE_TEND_SUPABASE_URL?: string;
  readonly VITE_TEND_SUPABASE_PUBLISHABLE_KEY?: string;
}
