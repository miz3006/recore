import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native';

import { hasBlur, hasLiquidGlass } from '@/lib/capabilities';
import { makeStyles, useTheme } from '@/lib/theme';

/**
 * `Glass` — the ONLY place glass is constructed (CLAUDE.md §6.9).
 *
 * Glass is a **functional layer for controls and navigation that float above
 * content.** It is not a material you decorate with. It is allowed on exactly
 * four things: the tab bar (system, via `NativeTabs`), the composer accessory
 * bar, the floating rest-timer pill, and system-provided sheet furniture. It is
 * forbidden on cards, the session summary, stat tiles, the paywall, onboarding,
 * charts, list rows, and **anything containing a scroll view** — scrollable
 * content inside a `GlassView` renders incorrectly and destroys the material.
 *
 * ## The three-way fallback
 *
 * 1. **Reduce Transparency on** → a solid `surface` at full opacity. Checked
 *    first, because this is a stated user preference and no capability check
 *    outranks it.
 * 2. **Liquid Glass available** → `GlassView`. The check is a *runtime* one, not
 *    an iOS-version one: some iOS 26 builds ship without the API, and
 *    `isLiquidGlassAvailable` resolves through `requireNativeModule`, which
 *    throws when the module is not linked. `hasLiquidGlass()` swallows that.
 * 3. **Otherwise** → `BlurView`, and a solid surface if even blur is absent.
 *
 * ## Two rules the platform teaches the hard way
 *
 * · **Never animate `opacity` on a glass view or any of its ancestors.** Any
 *   value below 1 stops the effect rendering entirely — the view does not fade,
 *   it turns off. Fade with the built-in `animate` config or translate it off
 *   screen instead.
 * · **`isInteractive` does not update in place.** Toggling it requires a
 *   remount with a new `key`, which is why it is fixed at mount here.
 */

/** Live Reduce Transparency, subscribed — the user can change it under us. */
export function useReduceTransparency(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export function Glass({
  children,
  style,
  interactive = false,
}: {
  children?: React.ReactNode;
  /** Placement and shape only — never an `opacity` (see above). */
  style?: StyleProp<ViewStyle>;
  /** Fixed at mount: the native flag cannot be toggled in place. */
  interactive?: boolean;
}) {
  const styles = useStyles();
  const t = useTheme();
  const reduced = useReduceTransparency();

  if (reduced) return <View style={[style, styles.solid]}>{children}</View>;

  if (hasLiquidGlass()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        isInteractive={interactive}
        // The app owns its scheme (§6.3 defaults to `system` but the user may
        // override it), so the glass must be told rather than left on 'auto' —
        // otherwise a user on light-in-a-dark-OS gets dark chrome on a paper app.
        colorScheme={t.scheme}>
        {children}
      </GlassView>
    );
  }

  if (hasBlur()) {
    return (
      <BlurView intensity={40} tint={t.scheme} style={style}>
        {children}
      </BlurView>
    );
  }

  return <View style={[style, styles.solid]}>{children}</View>;
}

const useStyles = makeStyles((t) => ({
  solid: {
    backgroundColor: t.surface,
  },
}));
