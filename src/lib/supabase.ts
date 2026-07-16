import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { secureSessionStorage } from '@/lib/secure-storage';

/**
 * Supabase client (CLAUDE.md §2). Sessions persist in the Keychain/Keystore
 * via the chunked SecureStore adapter — never AsyncStorage. PKCE flow so the
 * OAuth redirect carries a one-time code instead of tokens in the URL.
 *
 * The client is safe to import when .env is not yet filled in (a placeholder
 * URL keeps createClient from throwing at startup); every network call simply
 * fails until the real project is configured, and the app stays local-first.
 */
export const supabase = createClient(
  isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'placeholder-anon-key',
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Refresh tokens only while the app is foregrounded (Supabase's recommended
// React Native pattern) — never block or wake the UI for it.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
