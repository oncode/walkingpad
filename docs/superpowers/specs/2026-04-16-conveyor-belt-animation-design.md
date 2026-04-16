# Conveyor Belt Background Animation — Design Spec

**Date:** 2026-04-16  
**Status:** Approved

## Overview

Replace the existing radial glow div in `ConnectedView` (`treadmill.tsx:210-215`) with a subtle animated "conveyor belt" effect: thin horizontal lines scrolling top-to-bottom behind the speed display, mimicking a treadmill belt in motion.

The animation is invisible at the edges (gradient mask), peaks at ~12% opacity in the centre, fades in/out when the belt starts/stops, and scales its speed proportionally to the walking speed.

---

## Component Structure

A new `ConveyorBelt` function component is added to `treadmill.tsx`. It replaces the glow `<div>` inside `<main>` in `ConnectedView`.

```tsx
<ConveyorBelt isRunning={isRunning} speed={targetSpeed} />
```

- **`isRunning`** — `beltStatus === "running"`. Drives the opacity fade.
- **`speed`** — `targetSpeed` (the user's intended speed, updated immediately on button press, not `stats.speed` which lags).

Rendered DOM (two layers):

```
<div absolute inset-0 pointer-events-none>        ← opacity wrapper (CSS transition)
  <div absolute inset-0 class="belt-lines">        ← stripe bg; JS writes backgroundPositionY
```

Both live in `treadmill.tsx`. No new file is needed.

---

## Animation Logic (rAF loop)

The component uses three mutable refs (no state, no re-renders):

| Ref             | Type             | Purpose                                                  |
| --------------- | ---------------- | -------------------------------------------------------- |
| `divRef`        | `HTMLDivElement` | DOM target for `backgroundPositionY` writes              |
| `posYRef`       | `number`         | Accumulated position in px (0–20, wraps)                 |
| `currentVelRef` | `number`         | Live velocity in px/s, eased each frame                  |
| `speedRef`      | `number`         | Mirror of the `speed` prop, kept in sync via `useEffect` |

### Frame loop

```
each frame:
  dt = min(timestamp − lastTimestamp, 50ms)        // cap: prevents jump after tab-switch
  targetVel = (STRIPE × speedRef.current) / K      // target velocity in px/s
  currentVel += (targetVel − currentVel) × 0.08   // exponential ease, ~0.6s to settle
  posY = (posY + currentVel × dt) % STRIPE
  divRef.current.style.backgroundPositionY = posY + "px"
```

Constants:

- `STRIPE = 20` — stripe repeat unit in px (1px line + 19px gap)
- `K = 8` — duration constant

### Speed → velocity mapping

```
velocity (px/s) = (STRIPE × speed) / K = 2.5 × speed
```

| Speed (km/h) | Velocity (px/s) | Loop period |
| ------------ | --------------- | ----------- |
| 2.0          | 5.0             | 4.0 s       |
| 3.5          | 8.75            | 2.3 s       |
| 6.0          | 15.0            | 1.33 s      |

### Why rAF instead of CSS `animation-duration`

Changing `animation-duration` mid-cycle causes the browser to recalculate the keyframe percentage from elapsed time, which produces a visible position jump. The rAF approach accumulates position continuously — speed changes ease the velocity, never reset the phase.

### Lifecycle

- Loop starts on mount via `requestAnimationFrame`.
- `speedRef` is kept current via a `useEffect([speed])` that writes to the ref (no loop restart needed).
- Loop is cancelled via `cancelAnimationFrame` on unmount.
- `dt` is capped at 50ms to absorb tab-switch gaps without a large position jump.

---

## CSS (styles.css)

Two new rules added to `src/styles.css`. No `@keyframes` needed.

```css
.belt-lines {
  background: repeating-linear-gradient(
    to bottom,
    var(--color-foreground) 0px,
    var(--color-foreground) 1px,
    transparent 1px,
    transparent 20px
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.12) 30%,
    rgba(0, 0, 0, 0.12) 70%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 0.12) 30%,
    rgba(0, 0, 0, 0.12) 70%,
    transparent 100%
  );
}
```

**Design decisions:**

- `var(--color-foreground)` — adapts to light/dark theme automatically.
- Mask peaks at `rgba(0,0,0,0.12)` — 12% alpha is the only opacity knob; lines are full-color, mask controls final visibility. This keeps the effect within the 10–15% requirement.
- `mask-image` edges fade from `transparent` (0%) to peak at 30% and 70%, then back to transparent — lines are invisible at top/bottom, strongest in the centre third.
- No `@keyframes` declared — `backgroundPositionY` is driven entirely by JS.

---

## Fade In / Out

The outer wrapper div uses an inline `transition: opacity 0.7s ease`. The `isRunning` prop toggles `opacity: 1` (running) vs `opacity: 0` (stopped). The rAF loop continues running while invisible — this avoids any position stutter when the belt restarts.

---

## Files Changed

| File                           | Change                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| `src/components/treadmill.tsx` | Add `ConveyorBelt` component; replace glow `<div>` with `<ConveyorBelt …/>` |
| `src/styles.css`               | Add `.belt-lines` CSS rule                                                  |
