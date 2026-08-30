import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Enter } from '@/lib/motion/index';
import { color, MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';

import type { TrialStep } from './timeline';

/**
 * THE VERTICAL TRIAL TIMELINE.
 *
 * Cal AI's `Vertical Trial Timeline` / `Orange Timeline Icons`
 * (`6480417616/pay_8ixcs`), rebuilt in Recore's own materials. The skeleton is
 * theirs and it is worth having: a 40 pt filled node per step, a rail joining
 * them, a bold title and two lines of quiet body to its right. Four unrelated
 * apps in the library draw it within a few points of the same geometry, which
 * is what makes it read as "a trial explained" before a word is read.
 *
 * ## The accent is spent here
 *
 * These three nodes and the selected plan card's border are the only brand
 * blue on the screen (owner's brief). Everything else is ink, secondary grey
 * and canvas. That is also why the RAIL IS NEUTRAL — `color.track`, the app's
 * own unfilled-rail token — and not a blue wash: Cal AI tints its rail because
 * a grey one would orphan its orange nodes, but three blue discs on a warm
 * grey line already read as one sequence, and a tinted rail would spend the
 * accent a fourth time to say nothing new.
 *
 * ## Nothing here moves on its own
 *
 * The rows arrive on the screen's one entrance stagger and then stop. A trial
 * timeline that animates its rail filling is a countdown, which CLAUDE.md §2
 * rule 6 rules out — and it would be a countdown of time that has not passed.
 *
 * ## THE ONE THING THAT IS LEFT-ALIGNED AND STAYS THAT WAY
 *
 * Two axes, and both are structural rather than eyeballed: the icons sit in a
 * fixed-width `spine`, so every node's centre lands on the same x whatever the
 * row above it did, and the text column starts where that spine ends, so every
 * title and every body share a second axis. The rail is absolutely positioned
 * inside the spine with no `left`, which in Yoga means it inherits the spine's
 * `alignItems: 'center'` — it runs through the node centres by construction and
 * cannot drift off them.
 *
 * ## The figure is drawn heavier than the sentence around it
 *
 * `step.strong` names a substring of the body — the person's own prescribed
 * load, "82.5 kg × 3" — and it is drawn in the reading face at 700 in primary
 * ink while the rest of the body stays secondary grey. It is not the accent
 * colour: brand blue is already spent on the nodes and the selected card, and a
 * third blue would leave the eye with three things claiming to be the point.
 * Weight and ink do the job here, which is also what a number wears everywhere
 * else in Recore.
 */

/**
 * 36, not Cal AI's 40. The whole screen has to clear the fold on a 393 × 852
 * phone — measured, and at 40 the CTA fell below it once the timeline bodies
 * wrapped to a third line at that width. Four points off each node and a
 * tighter row gap bought back the ~50 pt that decided it.
 */
const NODE = moderateScale(36);
const RAIL = moderateScale(6);
const GLYPH = moderateScale(17);

export function TrialTimeline({ steps, startIndex = 0 }: { steps: TrialStep[]; startIndex?: number }) {
  return (
    <View style={styles.wrap} accessibilityRole="list">
      {steps.map((step, i) => (
        <Enter key={step.title} index={startIndex + i}>
          <View
            style={styles.row}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${step.title}. ${step.body}`}>
            {/* The rail is drawn BEHIND the node and stretches to the row's
                full height, so a row that grows at Dynamic Type XL grows its
                rail with it. A fixed-height connector is the usual way this
                pattern breaks. */}
            <View style={styles.spine}>
              {step.last ? null : <View style={styles.rail} />}
              <View style={styles.node}>
                <Icon name={step.icon} size={GLYPH} tint={color.onInk} />
              </View>
            </View>

            <View style={[styles.text, step.last && styles.textLast]}>
              <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {step.title}
              </Text>
              <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {renderBody(step)}
              </Text>
            </View>
          </View>
        </Enter>
      ))}
    </View>
  );
}

/**
 * The body with its figure picked out, or the plain string when there is no
 * figure — and also when there IS one but it is not in the sentence, which is
 * what a copy edit that loses the substring looks like. Falling back to the
 * whole body means such an edit costs a highlight, never a rendered fragment.
 */
function renderBody(step: TrialStep) {
  if (!step.strong) return step.body;
  const at = step.body.indexOf(step.strong);
  if (at < 0) return step.body;
  return (
    <>
      {step.body.slice(0, at)}
      <Text style={styles.strong}>{step.strong}</Text>
      {step.body.slice(at + step.strong.length)}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flexDirection: 'row', gap: spacing.md },
  spine: { width: NODE, alignItems: 'center' },
  rail: {
    position: 'absolute',
    top: NODE / 2,
    bottom: 0,
    width: RAIL,
    borderRadius: RAIL / 2,
    backgroundColor: color.track,
  },
  /** One of the two places brand blue appears on this screen. */
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The bottom padding is the gap between rows, and it lives on the TEXT
   * rather than on the row, so the rail runs through it instead of stopping
   * short of the next node. */
  text: { flex: 1, paddingBottom: spacing.md, gap: spacing.xs },
  /** The last row has no next node to reach, so it carries no gap either. */
  textLast: { paddingBottom: 0 },
  title: { ...type.headline, fontWeight: '700', color: color.textPrimary },
  body: { ...type.subhead, color: color.textSecondary },
  /** Inherits the body's size — a nested Text takes its parent's `fontSize` —
   * so the figure changes weight, face and ink without changing the line. */
  strong: { ...readingStyle('700'), color: color.textPrimary },
});
