import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { isCoachModeOn } from '@/lib/env';
import { devLog, errorText } from '@/lib/log';
import { supabase } from '@/lib/supabase';

/**
 * PUSH FOR COMMENTS (coach feature, Phase 5) — the only REMOTE notification in
 * an app whose other three are local.
 *
 * `recap.ts`, `rest-alert.ts` and `billing/notifications.ts` all schedule
 * against the device clock and need no server and no token. A comment arrives
 * from another person, so this one does — and everything that follows exists
 * because a push token is a durable identifier and has to be handled like one.
 *
 * ## WHEN PERMISSION IS ASKED, AND WHY NOT SOONER
 *
 * Only after a coaching link exists (`registerForComments` is called from the
 * redeem and invite paths, never from app launch). The spec asks for exactly
 * this and it is also the only honest moment: before there is a link there is
 * nothing that could notify you, so the system prompt would be asking for
 * permission to do nothing. An app that asks on first launch is asking before
 * it has earned an answer, and a denied prompt is close to permanent.
 *
 * It also never asks twice. `getPermissionsAsync` first; if the person has
 * already said no, that is their answer and the feature degrades to "open the
 * app to see replies" rather than nagging.
 *
 * ## THE TOKEN IS DELETED WHEN THE LINK IS
 *
 * `unregister` runs on sign-out and on revoking the last link. A token left
 * behind is a device that can still be reached about a relationship that has
 * ended — the `push_tokens` RLS makes it the owner's row, but the owner has to
 * actually be able to remove it, and nothing in a notification settings screen
 * would do that for them.
 */

/** Where a tapped notification wants to go. */
export interface CommentTarget {
  workoutId: string;
  exerciseRef: string | null;
}

/**
 * Ask (at most once), get the Expo token, store it. Returns false for every
 * ordinary reason it cannot: a simulator, a build without the flag, a person
 * who declined, no project id, no network. None of them is an error worth
 * showing — the feature simply works without push.
 */
export async function registerForComments(userId: string): Promise<boolean> {
  if (!isCoachModeOn()) return false;
  // A simulator has no APNs token to give, and asking produces a confusing
  // system prompt that can never be satisfied.
  if (!Device.isDevice) return false;

  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      const next = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      granted = next.granted;
    }
    if (!granted) return false;

    const token = await Notifications.getExpoPushTokenAsync();
    if (!token?.data) return false;

    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token: token.data,
        platform: Platform.OS === 'android' ? 'android' : 'ios',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    if (error) {
      devLog('push token upsert failed:', errorText(error));
      return false;
    }
    return true;
  } catch (err) {
    devLog('push registration failed:', errorText(err));
    return false;
  }
}

/** Drop this device's token. Called on sign-out and when the last link ends. */
export async function unregisterForComments(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const token = await Notifications.getExpoPushTokenAsync();
    if (!token?.data) return;
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token.data);
  } catch (err) {
    devLog('push unregister failed:', errorText(err));
  }
}

/**
 * The tapped notification's destination, or null when the payload is not one of
 * ours. Every field is validated rather than cast: a notification payload comes
 * off the network and lands in a router push, so a wrong shape here would be a
 * navigation to a route built out of arbitrary strings.
 */
export function targetOf(response: Notifications.NotificationResponse): CommentTarget | null {
  const data = response?.notification?.request?.content?.data as
    | Record<string, unknown>
    | undefined;
  const workoutId = data?.workoutId;
  if (typeof workoutId !== 'string' || workoutId.length === 0) return null;
  const ref = data?.exerciseRef;
  return {
    workoutId,
    exerciseRef: typeof ref === 'string' && ref.length > 0 ? ref : null,
  };
}
