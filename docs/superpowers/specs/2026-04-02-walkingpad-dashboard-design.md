# WalkingPad A1 Pro Dashboard

**Date:** 2026-04-02
**Status:** Approved

## Overview

A live control dashboard for the KingSmith WalkingPad A1 Pro, embedded in `src/components/treadmill.tsx`. Connects via Web Bluetooth (browser-native BLE), displays real-time stats, and exposes controls for on/off, speed, and mode. No data persistence — live UI only.

## Architecture

Three new files:

### `src/lib/walking-pad/protocol.ts`

Pure functions only — no React, no side effects.

- `encodeStart()` → `Uint8Array`
- `encodeStop()` → `Uint8Array`
- `encodeSetSpeed(kmh: number)` → `Uint8Array` (input clamped to 0.5–6.0, stepped at 0.5)
- `encodeSetMode(mode: 'manual' | 'auto')` → `Uint8Array`
- `decodeNotification(data: DataView)` → `WalkingPadStats | null`

```ts
type WalkingPadStats = {
  speed: number; // km/h
  time: number; // seconds elapsed
  steps: number;
  distance: number; // km
  calories: number; // kcal
};
```

### `src/lib/walking-pad/context.tsx`

`WalkingPadProvider` + `useWalkingPad()` hook.

**State:**

```ts
type ConnectionStatus = "disconnected" | "connecting" | "connected";

type WalkingPadState = {
  status: ConnectionStatus;
  isRunning: boolean;
  mode: "manual" | "auto";
  stats: WalkingPadStats;
};
```

**Actions exposed via context:**

- `connect()` — calls `navigator.bluetooth.requestDevice()` with the A1 Pro service filter, then connects to GATT, subscribes to the notify characteristic, and starts listening for stat notifications
- `disconnect()` — gracefully closes the GATT connection, resets state
- `start()` — writes start command to write characteristic
- `stop()` — writes stop command, sets `isRunning: false`
- `setSpeed(kmh: number)` — writes speed command (no-op in auto mode)
- `setMode(mode: 'manual' | 'auto')` — writes mode command

BLE UUIDs:

- Service: `0000fe00-0000-1000-8000-00805f9b34fb`
- Write characteristic: `0000fe01-0000-1000-8000-00805f9b34fb`
- Notify characteristic: `0000fe02-0000-1000-8000-00805f9b34fb`

On `characteristicvaluechanged`, the context calls `decodeNotification()` and merges the result into stats state.

### `src/components/treadmill.tsx`

Wraps its tree in `WalkingPadProvider`. Renders one of two views based on connection status.

## UI

### Disconnected view

Centered card with:

- Device name "WalkingPad A1 Pro"
- "Connect" button — calls `connect()`
- Shows spinner while `status === 'connecting'`

### Connected view (Layout C — Gauge + Grid)

**Header bar**

- Device name
- Green dot + "Connected" label
- "Disconnect" button

**Gauge + stats panel**

- SVG arc gauge: hero display of current speed, range 0.5–6.0 km/h
- 2×2 stats grid beside gauge: time elapsed (mm:ss), steps, distance (km, 1 decimal), calories (kcal)

**Mode toggle**

- Pill toggle: Manual | Auto
- In Auto mode, speed controls are visually disabled (opacity-50, pointer-events-none)

**Speed controls**

- − button / current speed display / + button
- Step: 0.5 km/h, min 0.5, max 6.0
- Calls `setSpeed()` on each press

**Start / Stop button**

- Full-width, large
- Green "▶ Start" when `isRunning === false`
- Red "■ Stop" when `isRunning === true`

## Error Handling

| Scenario                    | Behavior                                                |
| --------------------------- | ------------------------------------------------------- |
| Web Bluetooth unavailable   | Toast: "Web Bluetooth is not supported in this browser" |
| User cancels pairing dialog | Silently ignore, status returns to `disconnected`       |
| Unexpected disconnection    | Toast: "Device disconnected", reset stats to zero       |
| Command write fails         | Console log + brief toast, UI stays functional          |

## Constraints

- Web Bluetooth requires a secure context (HTTPS or localhost) and a Chromium-based browser
- Speed step is fixed at 0.5 km/h to match the A1 Pro hardware minimum increment
- In Auto mode, the belt adjusts speed based on footsteps — `setSpeed()` writes are skipped
