/**
 * Which way the funnel last moved.
 *
 * Every step of the flow is its own route, so a screen cannot see the screen it
 * replaced — the same reason `ProgressRail` keeps the previous fill in a module
 * variable. This is that variable for the entrance: the renderer records the
 * direction just before it navigates, and the screen that mounts next reads it
 * to decide which side its content arrives from.
 *
 * Forward from the right, Back from the left (Claude Design canvas, 13 Aug
 * 2026: "horizontal slide with crossfade"). A flow that always slides in from
 * the same side tells the user nothing — going back would look exactly like
 * going forward, and the motion would be decoration.
 *
 * A cold start begins at `1`: arriving at a resumed step IS moving forward.
 */
export type FlowDirection = 1 | -1;

let direction: FlowDirection = 1;

export function setFlowDirection(next: FlowDirection): void {
  direction = next;
}

export function flowDirection(): FlowDirection {
  return direction;
}
