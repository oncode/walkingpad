# WalkingPad Settings Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings dropdown to the WalkingPad dashboard header (left of "Reset Session") triggered by a gear icon, allowing configuration of speed limits (min, max, step) and a feature to auto-restore the last set speed.

**Architecture:** We will create a new `SettingsMenu` component that encapsulates the state and UI for settings. We will use shadcn/ui's `DropdownMenu` for the dropdown container. Inside, we'll use standard inputs (since shadcn inputs might be overkill for simple number inputs, but we'll use basic HTML inputs styled with Tailwind or shadcn `Input` component if preferred). We will manage the state in local storage using a custom hook (similar to `useBodyWeight`). We will integrate this into `ConnectedView` in `src/components/treadmill.tsx`. We will also need to modify the `useWalkingPad` context or `ConnectedView` to support restoring the last speed. We need `RiSettings3Line` from `@remixicon/react` for the gear icon.

**Tech Stack:** React 19, shadcn/ui (`DropdownMenu`, `Label`, `Input`, `Checkbox` or `Switch`), Tailwind CSS, local storage.

---

### Task 1: Create Settings Hook

**Files:**

- Create: `src/hooks/use-treadmill-settings.ts`

- [ ] **Step 1: Write the hook**

Create a custom hook to manage settings in local storage.

```typescript
import { useState, useCallback, useEffect } from "react";

const SETTINGS_KEY = "walkingpad.settings";

export interface TreadmillSettings {
  maxSpeed: number;
  minSpeed: number;
  speedStep: number;
  restoreSpeed: boolean;
  lastSpeed: number;
}

const DEFAULT_SETTINGS: TreadmillSettings = {
  maxSpeed: 6.0,
  minSpeed: 0.5,
  speedStep: 0.5,
  restoreSpeed: false,
  lastSpeed: 0,
};

export function useTreadmillSettings() {
  const [settings, setSettingsState] = useState<TreadmillSettings>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = useCallback((updates: Partial<TreadmillSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates };
      // Enforce absolute limits
      if (next.maxSpeed < 0.1) next.maxSpeed = 0.1;
      if (next.minSpeed < 0) next.minSpeed = 0;
      if (next.speedStep < 0.1) next.speedStep = 0.1;

      // Ensure min is not greater than max
      if (next.minSpeed > next.maxSpeed) next.minSpeed = next.maxSpeed;

      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return [settings, updateSettings] as const;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-treadmill-settings.ts
git commit -m "feat: add useTreadmillSettings hook"
```

### Task 2: Create Settings Component

**Files:**

- Create: `src/components/treadmill-settings.tsx`

- [ ] **Step 1: Write the component**

We will use shadcn/ui components (`DropdownMenu`, `Input`, `Checkbox`, `Label`). We assume they are available or we will use standard HTML elements styled appropriately if they are not all present, but `DropdownMenu`, `Input`, `Label` are already verified present. `Checkbox` and `Popover` were added.

```tsx
import { RiSettings3Line } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTreadmillSettings } from "@/hooks/use-treadmill-settings";

export function TreadmillSettingsMenu() {
  const [settings, updateSettings] = useTreadmillSettings();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="pt-0.5 text-muted-foreground transition-colors duration-500 hover:text-foreground focus:outline-none flex items-center gap-2">
        <RiSettings3Line className="size-4" />
        <span className="sr-only">Settings</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-secondary/90 backdrop-blur-md border-white/10"
      >
        <DropdownMenuLabel className="font-bold tracking-widest text-xs uppercase opacity-80">
          Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        <DropdownMenuGroup className="p-2 flex flex-col gap-4">
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="max-speed" className="text-xs font-semibold text-muted-foreground">
              Max Speed
            </Label>
            <Input
              id="max-speed"
              type="number"
              min={0.1}
              step={0.1}
              className="h-8 text-xs bg-black/20 border-white/10"
              value={settings.maxSpeed}
              onChange={(e) =>
                updateSettings({
                  maxSpeed: parseFloat(e.target.value) || DEFAULT_SETTINGS.maxSpeed,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="min-speed" className="text-xs font-semibold text-muted-foreground">
              Min Speed
            </Label>
            <Input
              id="min-speed"
              type="number"
              min={0}
              step={0.1}
              className="h-8 text-xs bg-black/20 border-white/10"
              value={settings.minSpeed}
              onChange={(e) =>
                updateSettings({
                  minSpeed: parseFloat(e.target.value) || DEFAULT_SETTINGS.minSpeed,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="step-speed" className="text-xs font-semibold text-muted-foreground">
              Step Speed
            </Label>
            <Input
              id="step-speed"
              type="number"
              min={0.1}
              step={0.1}
              className="h-8 text-xs bg-black/20 border-white/10"
              value={settings.speedStep}
              onChange={(e) =>
                updateSettings({
                  speedStep: parseFloat(e.target.value) || DEFAULT_SETTINGS.speedStep,
                })
              }
            />
          </div>

          <DropdownMenuSeparator className="bg-white/5 my-2" />

          <div className="flex items-center space-x-2 px-1">
            <Checkbox
              id="restore-speed"
              checked={settings.restoreSpeed}
              onCheckedChange={(checked) => updateSettings({ restoreSpeed: checked === true })}
              className="border-white/20 data-[state=checked]:bg-primary"
            />
            <Label
              htmlFor="restore-speed"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
            >
              Restore last speed on start
            </Label>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

_Note: In the code above, we need to import `DEFAULT_SETTINGS` from the hook file or redefine it. Let's fix that in the component._

Let's adjust `src/components/treadmill-settings.tsx`:

```tsx
import { RiSettings3Line } from "@remixicon/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTreadmillSettings } from "@/hooks/use-treadmill-settings";

export function TreadmillSettingsMenu() {
  const [settings, updateSettings] = useTreadmillSettings();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="pt-0.5 text-muted-foreground transition-colors duration-500 hover:text-foreground focus:outline-none flex items-center gap-2">
        <RiSettings3Line className="size-4" />
        <span className="sr-only">Settings</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-secondary/90 backdrop-blur-md border-white/10"
      >
        <DropdownMenuLabel className="font-bold tracking-widest text-xs uppercase opacity-80">
          Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        <DropdownMenuGroup className="p-2 flex flex-col gap-4">
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="max-speed" className="text-xs font-semibold text-muted-foreground">
              Max Speed
            </Label>
            <Input
              id="max-speed"
              type="number"
              min={0.1}
              step={0.1}
              className="h-8 text-xs bg-black/20 border-white/10"
              value={settings.maxSpeed}
              onChange={(e) => updateSettings({ maxSpeed: parseFloat(e.target.value) || 6.0 })}
            />
          </div>
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="min-speed" className="text-xs font-semibold text-muted-foreground">
              Min Speed
            </Label>
            <Input
              id="min-speed"
              type="number"
              min={0}
              step={0.1}
              className="h-8 text-xs bg-black/20 border-white/10"
              value={settings.minSpeed}
              onChange={(e) => updateSettings({ minSpeed: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="grid grid-cols-2 items-center gap-2">
            <Label htmlFor="step-speed" className="text-xs font-semibold text-muted-foreground">
              Step Speed
            </Label>
            <Input
              id="step-speed"
              type="number"
              min={0.1}
              step={0.1}
              className="h-8 text-xs bg-black/20 border-white/10"
              value={settings.speedStep}
              onChange={(e) => updateSettings({ speedStep: parseFloat(e.target.value) || 0.5 })}
            />
          </div>

          <DropdownMenuSeparator className="bg-white/5 my-2" />

          <div className="flex items-center space-x-2 px-1">
            <Checkbox
              id="restore-speed"
              checked={settings.restoreSpeed}
              onCheckedChange={(checked) => updateSettings({ restoreSpeed: checked === true })}
              className="border-white/20 data-[state=checked]:bg-primary"
            />
            <Label
              htmlFor="restore-speed"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
            >
              Restore last speed on start
            </Label>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Check for type errors (TypeScript verification step)**

Run: `npx tsc --noEmit`
Expected: PASS or at least no errors related to our new files.

- [ ] **Step 3: Commit**

```bash
git add src/components/treadmill-settings.tsx
git commit -m "feat: add settings component"
```

### Task 3: Integrate Settings and Restore Logic in Dashboard

**Files:**

- Modify: `src/components/treadmill.tsx`

- [ ] **Step 1: Modify `src/components/treadmill.tsx`**

1. Import `TreadmillSettingsMenu` and `useTreadmillSettings`.
2. Add `TreadmillSettingsMenu` to the header.
3. Update `handleSpeedUp` and `handleSpeedDown` to respect the new settings min/max/step.
4. Add logic to track last set speed.
5. Add a `useEffect` to trigger restoring the speed 1 second after the belt transitions to running, if the setting is enabled.

```tsx
import { RiBluetoothLine, RiLoader4Line } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { WalkingPadProvider, useWalkingPad } from "@/lib/walking-pad/context";
import { SENSITIVITY_LABELS, countdownLabel, isCountdown } from "@/lib/walking-pad/protocol";
import type { AutoSensitivity } from "@/lib/walking-pad/protocol";
import { TreadmillSettingsMenu } from "@/components/treadmill-settings";
import { useTreadmillSettings } from "@/hooks/use-treadmill-settings";

// ... existing code down to ConnectedView ...

function ConnectedView() {
  const {
    stats,
    mode,
    sensitivity,
    disconnect,
    setSpeed,
    setMode,
    setSensitivity,
    resetSession,
    handleStartStop,
    isStartStopPending,
  } = useWalkingPad();
  const { beltStatus } = stats;

  const [bodyWeight, setBodyWeight] = useBodyWeight();
  const [weightInput, setWeightInput] = useState(String(bodyWeight));
  const [settings, updateSettings] = useTreadmillSettings();

  const isRunning = beltStatus === "running";
  const calories = calculateCalories(stats.time, stats.distance, bodyWeight);

  const [targetSpeed, setTargetSpeed] = useState(stats.speed);
  const lastCmdTimeRef = useRef(0);
  const prevBeltStatusRef = useRef(beltStatus);

  useEffect(() => {
    if (Date.now() - lastCmdTimeRef.current > 2000) {
      setTargetSpeed(stats.speed);
    }
  }, [stats.speed]);

  // Logic to restore speed
  useEffect(() => {
    if (prevBeltStatusRef.current !== "running" && beltStatus === "running") {
      // Just transitioned to running
      if (settings.restoreSpeed && settings.lastSpeed > 0) {
        // We delay slightly to let it settle into running state
        const timeoutId = setTimeout(() => {
          void setSpeed(settings.lastSpeed);
          setTargetSpeed(settings.lastSpeed);
        }, 1000);
        return () => clearTimeout(timeoutId);
      }
    }
    prevBeltStatusRef.current = beltStatus;
  }, [beltStatus, settings.restoreSpeed, settings.lastSpeed, setSpeed]);


  const handleSpeedDown = () => {
    const next = Math.max(settings.minSpeed, targetSpeed - settings.speedStep);
    setTargetSpeed(next);
    lastCmdTimeRef.current = Date.now();
    updateSettings({ lastSpeed: next });
    void setSpeed(next);
  };

  const handleSpeedUp = () => {
    const next = Math.min(settings.maxSpeed, targetSpeed + settings.speedStep);
    setTargetSpeed(next);
    lastCmdTimeRef.current = Date.now();
    updateSettings({ lastSpeed: next });
    void setSpeed(next);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Header */}
      <header className="flex w-full items-center justify-between p-6 lg:p-10">
        <div className="flex items-center gap-4">
          <div className="relative flex size-2.5">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                mode === "standby" ? "bg-orange-500" : "bg-primary",
              )}
            ></span>
            <span
              className={cn(
                "relative inline-flex size-full rounded-full",
                mode === "standby"
                  ? "bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,1)]"
                  : "bg-primary shadow-[0_0_15px_var(--color-primary)]",
              )}
            ></span>
          </div>
          <span className="pt-0.5 text-[11px] font-bold tracking-[0.25em] text-muted-foreground uppercase">
            WalkingPad
          </span>
        </div>
        <div className="flex items-center gap-6">
          <TreadmillSettingsMenu />
          <button
            onClick={resetSession}
            className="pt-0.5 text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase transition-colors duration-500 hover:text-foreground"
          >
            Reset Session
          </button>
          <button
            onClick={disconnect}
            className="pt-0.5 text-[11px] font-bold tracking-[0.2em] text-muted-foreground uppercase transition-colors duration-500 hover:text-foreground"
          >
            Disconnect
          </button>
        </div>
      </header>
```

- [ ] **Step 2: Update limits in UI**
      Ensure the disabled state on buttons uses `settings.minSpeed` and `settings.maxSpeed`.

```tsx
{
  /* Minus Button */
}
<div
  className={cn(
    "flex flex-1 justify-start transition-all duration-700 ease-expo",
    mode === "auto" || mode === "standby"
      ? "pointer-events-none -translate-x-8 opacity-0"
      : "translate-x-0 opacity-100",
  )}
>
  <button
    onClick={handleSpeedDown}
    disabled={
      targetSpeed <= settings.minSpeed || mode === "auto" || mode === "standby" || !isRunning
    }
    className="group flex size-16 items-center justify-center rounded-2xl border border-white/5 bg-secondary/50 backdrop-blur transition-all duration-500 ease-expo hover:border-white/10 hover:bg-secondary active:scale-95 disabled:scale-100 disabled:opacity-20 md:size-24 lg:size-32"
  >
    <span className="text-4xl font-light text-muted-foreground transition-colors duration-500 group-hover:text-primary lg:text-5xl">
      −
    </span>
  </button>
</div>;
```

```tsx
{
  /* Plus Button */
}
<div
  className={cn(
    "flex flex-1 justify-end transition-all duration-700 ease-expo",
    mode === "auto" || mode === "standby"
      ? "pointer-events-none translate-x-8 opacity-0"
      : "translate-x-0 opacity-100",
  )}
>
  <button
    onClick={handleSpeedUp}
    disabled={
      targetSpeed >= settings.maxSpeed || mode === "auto" || mode === "standby" || !isRunning
    }
    className="group flex size-16 items-center justify-center rounded-2xl border border-white/5 bg-secondary/50 backdrop-blur transition-all duration-500 ease-expo hover:border-white/10 hover:bg-secondary active:scale-95 disabled:scale-100 disabled:opacity-20 md:size-24 lg:size-32"
  >
    <span className="text-4xl font-light text-muted-foreground transition-colors duration-500 group-hover:text-primary lg:text-5xl">
      +
    </span>
  </button>
</div>;
```

- [ ] **Step 3: Test and format**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/treadmill.tsx
git commit -m "feat: integrate settings dropdown and speed restore logic"
```
