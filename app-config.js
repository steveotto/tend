"use strict";
window.TEND_SUPABASE_CONFIG = {
  url: "https://fhujqvudflxdpcvonids.supabase.co",
  publishableKey: "sb_publishable_vGbIHgF-iLof7YaDzcUtQg_k2Dj5BbB",
  redirectUrl: "https://steveotto.github.io/tend/"
};
window.TEND_CLOUD_MODE = !!(
  window.TEND_SUPABASE_CONFIG.url &&
  window.TEND_SUPABASE_CONFIG.publishableKey &&
  !/YOUR_|PLACEHOLDER/i.test(window.TEND_SUPABASE_CONFIG.url + window.TEND_SUPABASE_CONFIG.publishableKey)
);
