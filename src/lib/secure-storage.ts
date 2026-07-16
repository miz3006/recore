import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by the iOS Keychain / Android Keystore
 * (expo-secure-store) — NOT AsyncStorage, not plain storage.
 *
 * SecureStore warns above ~2KB per value and a Supabase session JSON (access +
 * refresh JWTs) regularly exceeds that, so values are transparently split into
 * <2KB chunks: `${key}.0`, `${key}.1`, … with the chunk count in `${key}.#`.
 * Every chunk lives in the Keychain; nothing touches disk unencrypted.
 */
const CHUNK_SIZE = 1900;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.c${i}`;

const OPTIONS: SecureStore.SecureStoreOptions = {
  // Sessions must be readable by background token refresh after first unlock.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const rawCount = await SecureStore.getItemAsync(countKey(key), OPTIONS);
    if (!rawCount) return null;
    const count = parseInt(rawCount, 10);
    if (!Number.isFinite(count) || count <= 0) return null;

    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i), OPTIONS);
      if (chunk == null) return null; // torn write — treat as signed out
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = await SecureStore.getItemAsync(countKey(key), OPTIONS);
    const previousCount = previous ? parseInt(previous, 10) : 0;

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]!, OPTIONS);
    }
    await SecureStore.setItemAsync(countKey(key), String(chunks.length), OPTIONS);

    // Drop stale tail chunks from a previously longer value.
    for (let i = chunks.length; i < previousCount; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i), OPTIONS);
    }
  },

  async removeItem(key: string): Promise<void> {
    const rawCount = await SecureStore.getItemAsync(countKey(key), OPTIONS);
    const count = rawCount ? parseInt(rawCount, 10) : 0;
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i), OPTIONS);
    }
    await SecureStore.deleteItemAsync(countKey(key), OPTIONS);
  },
};
