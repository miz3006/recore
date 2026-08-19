import { ChipRow } from '@/components/chip-row';
import type { PlanDayRow } from '@/lib/db/plan';

/**
 * The split-day switcher above the session (13 Aug 2026 — the chips
 * `lib/next/sections.ts` has been designed around since it was written).
 *
 * Next has only ever shown the ONE day the athlete is due for. That is the
 * right default and it stays the default — but a lifter on a push/pull/legs
 * rotation also wants to know what Pull is going to ask of them on Thursday,
 * and the app already knows: `planStripFor` will progress any day-template on
 * demand. These chips are the door to that.
 *
 * ## Two rules that keep it honest
 *
 * **Selecting a chip is a PREVIEW and nothing else.** It writes nothing, and it
 * does not change which day is due — `setPlanDayChoice` is the only thing that
 * does that and lives on the session-start card (§8.2), where answering the
 * question is the point. Looking is not answering.
 *
 * **The due day is always marked**, whichever chip is selected, by a small dot
 * before its label. Without it a preview would be indistinguishable from the
 * real thing after two taps, and a screen that quietly changes what it is
 * claiming is worse than one that never offered the preview.
 *
 * ## It is Progression's control now (18 Aug 2026)
 *
 * This file used to draw its own pills — ink-filled when selected, scrolling
 * horizontally — while Progression's ordering chips wrapped and wore a blue
 * wash. Two controls, one job, one tab apart. `ChipRow` is the single one, and
 * everything above stays true: this file only decides WHAT goes in it.
 */
export function SplitChips({
  days,
  activeId,
  dueId,
  onSelect,
}: {
  days: PlanDayRow[];
  /** The chip currently shown — the due day unless the athlete picked another. */
  activeId: string | null;
  /** The day the rotation says is next. Marked wherever it sits. */
  dueId: string | null;
  onSelect: (id: string) => void;
}) {
  if (days.length < 2) return null;

  return (
    <ChipRow
      items={days.map((day) => ({
        key: day.id,
        label: day.label,
        marked: day.id === dueId,
        spoken: day.id === dueId ? `${day.label}, due next` : day.label,
      }))}
      activeKey={activeId}
      onSelect={onSelect}
      hint="Shows what that day would ask of you"
    />
  );
}
