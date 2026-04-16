# Conveyor Belt Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static radial glow in the treadmill dashboard with a subtle animated conveyor belt — thin horizontal lines scrolling downward, speed-proportional, smoothly easing on speed changes with no position jumps.

**Architecture:** A `ConveyorBelt` React component drives `background-position-y` via a `requestAnimationFrame` loop, accumulating position as `velocity × Δt` so speed changes ease the velocity rather than resetting the animation phase. The CSS stripe pattern and gradient mask are static rules in `styles.css`; no `@keyframes` needed.

**Tech Stack:** React 19, Tailwind CSS v4, TypeScript. No test framework — validation is `npm run lint` (runs Oxlint + type-check) plus visual verification in the dev server.

---

## Files Changed

| File                           | Change                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| `src/styles.css`               | Add `.belt-lines` CSS rule (stripe pattern + mask)                         |
| `src/components/treadmill.tsx` | Add `ConveyorBelt` component; replace glow `<div>` with `<ConveyorBelt />` |

---

## Task 1: Add the `.belt-lines` CSS rule

**Files:**

- Modify: `src/styles.css` — append after the `@layer base` block (after line 136)

- [ ] **Step 1: Add the CSS rule**

Open `src/styles.css`. After the closing `}` of the `@layer base` block (the last line in the file), append:

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

**What this does:**

- `repeating-linear-gradient` — 1px foreground-colored line, 19px transparent gap, repeating every 20px. Uses `var(--color-foreground)` so it's dark on light theme, light on dark theme.
- `mask-image` — fades lines in from the top (0%→30%), holds at 12% alpha in the centre (30%→70%), fades out to bottom (70%→100%). The 12% alpha cap is the only opacity knob.
- `-webkit-mask-image` — Safari prefix; keep both.
- No `@keyframes`, no `animation` property — `background-position-y` is written by JS.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors. (This is a CSS-only change so type errors are not expected, but lint also runs format checks.)

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat: add belt-lines CSS rule for conveyor belt animation"
```

---

## Task 2: Implement the `ConveyorBelt` component and wire it in

**Files:**

- Modify: `src/components/treadmill.tsx`
  - Add `ConveyorBelt` function component (new function, before `ConnectedView`)
  - Replace glow `<div>` at lines 210–215 with `<ConveyorBelt />`

- [ ] **Step 1: Add constants and the `ConveyorBelt` component**

Open `src/components/treadmill.tsx`. Directly above the `function ConnectedView()` declaration (currently around line 122), insert:

```tsx
// ---------------------------------------------------------------------------
// Conveyor belt background animation
// ---------------------------------------------------------------------------
const BELT_STRIPE = 20; // px — repeat unit matching the CSS (1px line + 19px gap)
const BELT_K = 8; // duration constant: period(s) = K / speed(km/h)
// → 2.0 km/h = 4.0 s/loop, 6.0 km/h = 1.33 s/loop

function ConveyorBelt({ isRunning, speed }: { isRunning: boolean; speed: number }) {
  const divRef = useRef<HTMLDivElement>(null);
  const posYRef = useRef(0);
  const currentVelRef = useRef((BELT_STRIPE * speed) / BELT_K);
  const speedRef = useRef(speed);

  // Keep speedRef current whenever the prop changes — no loop restart needed.
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Single rAF loop for the lifetime of this component.
  useEffect(() => {
    let lastTs: number | null = null;
    let rafId: number;

    function frame(ts: number) {
      if (lastTs !== null) {
        // Cap dt at 50 ms to absorb tab-switch gaps without a large position jump.
        const dt = Math.min((ts - lastTs) / 1000, 0.05);

        // Ease velocity toward target (exponential, ~0.6 s to settle at 60 fps).
        const targetVel = (BELT_STRIPE * speedRef.current) / BELT_K;
        currentVelRef.current += (targetVel - currentVelRef.current) * 0.08;

        // Accumulate position — this is why there are no jumps on speed change.
        posYRef.current = (posYRef.current + currentVelRef.current * dt) % BELT_STRIPE;

        if (divRef.current) {
          divRef.current.style.backgroundPositionY = `${posYRef.current}px`;
        }
      }
      lastTs = ts;
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []); // empty deps — loop runs once on mount, cleans up on unmount

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ opacity: isRunning ? 1 : 0, transition: "opacity 0.7s ease" }}
    >
      <div ref={divRef} className="belt-lines absolute inset-0" />
    </div>
  );
}
```

- [ ] **Step 2: Replace the glow div with `<ConveyorBelt />`**

Inside `ConnectedView`, find the glow div inside `<main>` (currently lines 210–215):

```tsx
{
  /* Subtle background glow attached to the speed to ground it */
}
<div
  className={cn(
    "absolute top-1/2 left-1/2 h-[50vh] w-[50vw] -translate-x-1/2 -translate-y-1/2 rounded-[100%] blur-[120px] transition-opacity duration-1000",
    isRunning ? "pointer-events-none bg-primary opacity-15" : "opacity-0",
  )}
></div>;
```

Replace it entirely with:

```tsx
<ConveyorBelt isRunning={isRunning} speed={targetSpeed} />
```

**Why `targetSpeed` and not `stats.speed`:** `targetSpeed` updates immediately on button press (it's the user's intended speed). `stats.speed` lags behind by a Bluetooth round-trip. Using `targetSpeed` means the belt animation responds instantly to button presses, matching the speed number displayed on screen.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors. If you see "unused variable" for `cn` — it is still used elsewhere in the file, so this should not appear. If TypeScript complains about `useRef<HTMLDivElement>`, confirm `useRef` is already imported from `"react"` at line 2.

- [ ] **Step 4: Start the dev server and do a visual check**

```bash
npm run dev
```

Open the app in a browser and connect to the walking pad (or observe the `ConnectedView` if already connected). Check:

1. **Idle (belt stopped):** The belt lines should be invisible — `opacity: 0`.
2. **Start belt:** Lines fade in over ~0.7 s. Lines scroll downward continuously.
3. **Speed up / speed down:** Lines accelerate/decelerate smoothly with no position jump. Tap speed buttons rapidly to stress-test.
4. **Stop belt:** Lines fade out over ~0.7 s.
5. **Light theme (if applicable):** Lines should be visible as dark stripes on a light background.
6. **Both +/− buttons at various speeds:** Confirm the belt lines feel proportional — visibly slower at 2 km/h, noticeably faster at 6 km/h.

- [ ] **Step 5: Commit**

```bash
git add src/components/treadmill.tsx
git commit -m "feat: replace glow with rAF-driven conveyor belt animation"
```
