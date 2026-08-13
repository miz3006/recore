import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { SUPPORT_EMAIL } from './legal';

/**
 * Contact support — the mail composer, pre-addressed and pre-titled.
 *
 * It carries the app version and the OS in the body because the first reply to
 * any support mail asks for exactly those two things, and an athlete writing
 * from a locker room should not have to go and find them. **Nothing else is
 * attached**: no training data, no note text, no identifiers (§12 — what leaves
 * the device is the user's choice, and a support mail is not consent to send a
 * record). The body is plain, editable text in their own mail app; they can
 * delete every line of it before sending.
 *
 * Returns false when the device has no mail account configured, so the caller
 * can say something true instead of appearing to do nothing.
 */
export async function contactSupport(): Promise<boolean> {
  const version = Constants.expoConfig?.version ?? 'unknown';
  const build = Platform.OS === 'ios' ? 'iOS' : Platform.OS;
  const subject = `Recore support (${version})`;
  const body = [
    '',
    '',
    '—',
    `Recore ${version} · ${build} ${String(Platform.Version)}`,
  ].join('\n');

  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** The address itself, for the "no mail app" fallback line. */
export { SUPPORT_EMAIL };
