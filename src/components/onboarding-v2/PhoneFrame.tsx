import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color } from '@/lib/theme';

/**
 * AN iPHONE, DRAWN IN CODE — titanium band, black bezel, screen, Dynamic
 * Island with its camera, status bar, side keys. No bitmap.
 *
 * Two screens put a phone on the glass (owner, 16 September 2026): the
 * welcome hero, where the real Today page performs itself inside it, and the
 * recap screen, where a lock screen shows the weekly notice arriving. The
 * owner's reference (16 Sep, second pass) is the standard product render:
 * a light silver rim OUTSIDE the black bezel, grey keys standing off the
 * rim, and a real status bar — time on the left of the island, cellular /
 * Wi-Fi / battery on its right, a lens dot in the island's right lobe.
 *
 * Proportions are the 393 pt class measured off the simulator; everything
 * here scales off `width` so the same component draws both hero sizes.
 */
export interface PhoneMetrics {
  /** The silver rim's thickness. */
  band: number;
  /** The black bezel between rim and glass. */
  bezel: number;
  /** The glass. */
  screenW: number;
  screenH: number;
}

/** One source of geometry, so the pages scaled INTO the frame (`PhoneDemo`,
 * `LockScreenDemo`) can never disagree with the frame about where the glass
 * is. */
export function phoneMetrics(width: number, aspect = 2.16): PhoneMetrics {
  const band = Math.max(2, Math.round(width * 0.014));
  const bezel = Math.round(width * 0.03);
  const screenW = width - (band + bezel) * 2;
  return { band, bezel, screenW, screenH: screenW * aspect };
}

export function PhoneFrame({
  width,
  /** Screen height ÷ width. The 393-class panel is ≈ 2.16. */
  aspect = 2.16,
  screenColor = color.canvas,
  /** Drawn OVER the screen's content, under the island. */
  children,
  island = true,
  /** The status bar's ink — 'dark' over the paper screens, 'light' over the
   * lock screen's wallpaper, 'none' to draw no bar at all. */
  statusBar = 'dark',
  /** The small time beside the island. The lock screen passes '' — its big
   * clock IS the time, exactly as iOS draws it. */
  time = '9:41',
  style,
}: {
  width: number;
  aspect?: number;
  screenColor?: string;
  children?: ReactNode;
  island?: boolean;
  statusBar?: 'dark' | 'light' | 'none';
  time?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { band, bezel, screenW, screenH } = phoneMetrics(width, aspect);
  const outerRadius = width * 0.158;
  const bodyH = screenH + bezel * 2;
  const islandW = width * 0.29;
  const islandH = width * 0.085;
  const islandTop = bezel * 1.7;

  /** The hardware on the sides — action, volume up/down left, power right,
   * at the heights the real device carries them. Keys are the band's own
   * silver and stand a hair proud of it. */
  const stub = Math.max(2, Math.round(width * 0.014));
  const totalH = bodyH + band * 2;
  const keys = [
    { side: 'left' as const, top: totalH * 0.165, height: totalH * 0.032 },
    { side: 'left' as const, top: totalH * 0.225, height: totalH * 0.058 },
    { side: 'left' as const, top: totalH * 0.3, height: totalH * 0.058 },
    { side: 'right' as const, top: totalH * 0.235, height: totalH * 0.09 },
  ];

  const ink = statusBar === 'light' ? 'rgba(255,255,255,0.95)' : color.textPrimary;
  const glyph = Math.round(width * 0.042);

  return (
    <View
      style={[
        styles.rim,
        { width, height: totalH, borderRadius: outerRadius, padding: band },
        style,
      ]}
      // The frame is scenery; what plays inside it carries its own labels.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {keys.map((key, i) => (
        <View
          key={i}
          style={[
            styles.key,
            { width: stub * 2, height: key.height, top: key.top, borderRadius: stub },
            key.side === 'left' ? { left: -stub * 0.8 } : { right: -stub * 0.8 },
          ]}
        />
      ))}
      <View
        style={[
          styles.body,
          { borderRadius: outerRadius - band, padding: bezel },
        ]}>
        <View
          style={[
            styles.screen,
            {
              width: screenW,
              height: screenH,
              borderRadius: outerRadius - band - bezel * 0.7,
              backgroundColor: screenColor,
            },
          ]}>
          {children}

          {statusBar !== 'none' ? (
            <View style={[styles.statusRow, { top: islandTop, height: islandH }]}>
              <Text
                style={[styles.time, { color: ink, fontSize: glyph * 1.05 }]}
                allowFontScaling={false}>
                {time}
              </Text>
              <View style={styles.statusGlyphs}>
                <Ionicons name="cellular" size={glyph} color={ink} />
                <Ionicons name="wifi" size={glyph} color={ink} />
                <Battery ink={ink} width={glyph * 1.5} />
              </View>
            </View>
          ) : null}

          {island ? (
            <View
              style={[
                styles.island,
                {
                  width: islandW,
                  height: islandH,
                  borderRadius: islandH / 2,
                  top: islandTop,
                  left: (screenW - islandW) / 2,
                },
              ]}>
              {/* The lens, in the island's right lobe — the one detail that
                  makes the pill read as hardware rather than a hole. */}
              <View
                style={[
                  styles.lens,
                  {
                    width: islandH * 0.55,
                    height: islandH * 0.55,
                    borderRadius: islandH * 0.275,
                    right: islandH * 0.24,
                  },
                ]}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** iOS's battery: an outline capsule, a solid charge inside, a nub off the
 * right end. Drawn rather than fonted so the ink can follow the status bar. */
function Battery({ ink, width }: { ink: string; width: number }) {
  const h = width * 0.5;
  return (
    <View style={styles.batteryRow}>
      <View
        style={{
          width,
          height: h,
          borderRadius: h * 0.32,
          borderWidth: 1,
          borderColor: ink,
          opacity: 0.5,
          padding: 1.5,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 2.5,
          width: width - 5,
          height: h - 5,
          borderRadius: (h - 5) * 0.3,
          backgroundColor: ink,
        }}
      />
      <View
        style={{
          width: 1.5,
          height: h * 0.36,
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
          backgroundColor: ink,
          opacity: 0.5,
          marginLeft: 0.5,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** The titanium rim — the light silver edge the reference leads with. */
  rim: { backgroundColor: color.deviceBand },
  /** The black bezel body inside it. */
  body: { flex: 1, backgroundColor: color.device },
  screen: { overflow: 'hidden' },
  island: {
    position: 'absolute',
    backgroundColor: color.device,
    justifyContent: 'center',
  },
  /** A shade lighter than the island with a bluish cast, as glass reads. */
  lens: {
    position: 'absolute',
    backgroundColor: 'rgba(48,44,72,1)',
  },
  key: { position: 'absolute', backgroundColor: color.deviceBand },
  statusRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '7%',
  },
  time: { fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  statusGlyphs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  batteryRow: { flexDirection: 'row', alignItems: 'center' },
});
