# WalkingPad A1 Pro Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live BLE control dashboard for the WalkingPad A1 Pro inside `src/components/treadmill.tsx`, backed by a React Context provider for all BLE state and lifecycle.

**Architecture:** Pure protocol encode/decode in `src/lib/walking-pad/protocol.ts`. `WalkingPadProvider` in `src/lib/walking-pad/context.tsx` owns BLE connection, state, and commands, exposed via `useWalkingPad()`. `Treadmill` in `src/components/treadmill.tsx` wraps itself in the provider and renders the dashboard UI.

**Tech Stack:** React 19, Web Bluetooth API (`navigator.bluetooth`), Tailwind CSS v4, shadcn/ui (`Button`), Sonner (toast), `@remixicon/react`

---

## File Map

| File                              | Action | Responsibility                                                            |
| --------------------------------- | ------ | ------------------------------------------------------------------------- |
| `src/lib/walking-pad/protocol.ts` | Create | BLE UUIDs, `WalkingPadStats` type, encode commands, decode notifications  |
| `src/lib/walking-pad/context.tsx` | Create | `WalkingPadProvider`, `useWalkingPad()` hook, BLE connection lifecycle    |
| `src/components/treadmill.tsx`    | Modify | Dashboard UI: disconnected view + connected view (gauge, stats, controls) |

---

### Task 1: Protocol types, constants, and encode functions

**Files:**

- Create: `src/lib/walking-pad/protocol.ts`

- [ ] **Step 1: Create `src/lib/walking-pad/protocol.ts`**

```ts
// BLE service and characteristic UUIDs for the WalkingPad A1 Pro
export const BLE_SERVICE_UUID = "0000fe00-0000-1000-8000-00805f9b34fb";
export const BLE_WRITE_UUID = "0000fe01-0000-1000-8000-00805f9b34fb";
export const BLE_NOTIFY_UUID = "0000fe02-0000-1000-8000-00805f9b34fb";

export type WalkingPadStats = {
  speed: number; // km/h
  time: number; // seconds elapsed
  steps: number;
  distance: number; // km
  calories: number; // kcal
  isRunning: boolean;
};

export const DEFAULT_STATS: WalkingPadStats = {
  speed: 0,
  time: 0,
  steps: 0,
  distance: 0,
  calories: 0,
  isRunning: false,
};

// Command format: [0xf7, 0xa2, param, value, checksum, 0xfd]
// checksum = (~(0xa2 + param + value)) & 0xff
function buildCmd(param: number, value: number): Uint8Array {
  const checksum = ~(0xa2 + param + value) & 0xff;
  return new Uint8Array([0xf7, 0xa2, param, value, checksum, 0xfd]);
}

export function encodeStart(): Uint8Array {
  return buildCmd(0x04, 0x01);
}

export function encodeStop(): Uint8Array {
  return buildCmd(0x04, 0x00);
}

/** Speed clamped to [0.5, 6.0] and rounded to nearest 0.5 km/h step. */
export function encodeSetSpeed(kmh: number): Uint8Array {
  const clamped = Math.max(0.5, Math.min(6.0, kmh));
  const snapped = Math.round(clamped * 2) / 2;
  const raw = Math.round(snapped * 10); // device unit = 0.1 km/h
  return buildCmd(0x02, raw);
}

export function encodeSetMode(mode: "manual" | "auto"): Uint8Array {
  return buildCmd(0x08, mode === "auto" ? 0x01 : 0x00);
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/walking-pad/protocol.ts
git commit -m "feat: add WalkingPad BLE protocol encode functions"
```

---

### Task 2: Protocol notification decoder

**Files:**

- Modify: `src/lib/walking-pad/protocol.ts`

- [ ] **Step 1: Append `decodeNotification` to `protocol.ts`**

Add this to the bottom of `src/lib/walking-pad/protocol.ts`:

```ts
/**
 * Decode a BLE notification packet from the WalkingPad A1 Pro.
 *
 * Packet layout (20 bytes):
 *   [0]     0xf8  header
 *   [1]     0xa2  type
 *   [2]     state       0=stopped, 1=running
 *   [3-4]   speed       uint16 big-endian, unit = 0.1 km/h
 *   [5-8]   steps       uint32 big-endian
 *   [9-12]  time        uint32 big-endian, seconds
 *   [13-16] distance    uint32 big-endian, unit = 0.01 km
 *   [17]    calories    uint8, kcal
 *
 * Note: byte offsets for steps/time/distance are based on reverse-engineering
 * and may need calibration against the actual device.
 */
export function decodeNotification(data: DataView): WalkingPadStats | null {
  if (data.byteLength < 18) return null;
  if (data.getUint8(0) !== 0xf8) return null;

  const state = data.getUint8(2);
  const speedRaw = data.getUint16(3, false); // big-endian
  const steps = data.getUint32(5, false);
  const time = data.getUint32(9, false);
  const distRaw = data.getUint32(13, false);
  const calories = data.getUint8(17);

  return {
    isRunning: state === 1,
    speed: speedRaw / 10,
    steps,
    time,
    distance: distRaw / 100,
    calories,
  };
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/walking-pad/protocol.ts
git commit -m "feat: add WalkingPad BLE notification decoder"
```

---

### Task 3: WalkingPad context provider

**Files:**

- Create: `src/lib/walking-pad/context.tsx`

- [ ] **Step 1: Create `src/lib/walking-pad/context.tsx`**

```tsx
import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  BLE_NOTIFY_UUID,
  BLE_SERVICE_UUID,
  BLE_WRITE_UUID,
  DEFAULT_STATS,
  type WalkingPadStats,
  decodeNotification,
  encodeSetMode,
  encodeSetSpeed,
  encodeStart,
  encodeStop,
} from "./protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";
export type PadMode = "manual" | "auto";

type WalkingPadContextValue = {
  status: ConnectionStatus;
  isRunning: boolean;
  mode: PadMode;
  stats: WalkingPadStats;
  connect: () => Promise<void>;
  disconnect: () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setSpeed: (kmh: number) => Promise<void>;
  setMode: (mode: PadMode) => Promise<void>;
};

const WalkingPadContext = createContext<WalkingPadContextValue | null>(null);

export function WalkingPadProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setModeState] = useState<PadMode>("manual");
  const [stats, setStats] = useState<WalkingPadStats>(DEFAULT_STATS);

  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);

  const writeCmd = useCallback(async (data: Uint8Array) => {
    if (!writeCharRef.current) return;
    try {
      await writeCharRef.current.writeValueWithResponse(data);
    } catch (err) {
      console.error("BLE write failed:", err);
      toast.error("Command failed");
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    writeCharRef.current = null;
    deviceRef.current = null;
    setStatus("disconnected");
    setIsRunning(false);
    setStats(DEFAULT_STATS);
    toast.error("Device disconnected");
  }, []);

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      toast.error("Web Bluetooth is not supported in this browser");
      return;
    }
    try {
      setStatus("connecting");

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
      });

      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", handleDisconnect);

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const writeChar = await service.getCharacteristic(BLE_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(BLE_NOTIFY_UUID);

      writeCharRef.current = writeChar;

      notifyChar.addEventListener("characteristicvaluechanged", (e) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        if (!char.value) return;
        const decoded = decodeNotification(char.value);
        if (!decoded) return;
        setStats(decoded);
        setIsRunning(decoded.isRunning);
      });

      await notifyChar.startNotifications();
      setStatus("connected");
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") {
        // User cancelled the device picker — no error shown
        setStatus("disconnected");
        return;
      }
      console.error("BLE connect failed:", err);
      toast.error("Failed to connect to device");
      setStatus("disconnected");
    }
  }, [handleDisconnect]);

  const disconnect = useCallback(() => {
    // handleDisconnect fires automatically via gattserverdisconnected event
    deviceRef.current?.gatt?.disconnect();
  }, []);

  const start = useCallback(async () => {
    await writeCmd(encodeStart());
    setIsRunning(true);
  }, [writeCmd]);

  const stop = useCallback(async () => {
    await writeCmd(encodeStop());
    setIsRunning(false);
  }, [writeCmd]);

  const setSpeed = useCallback(
    async (kmh: number) => {
      if (mode === "auto") return;
      await writeCmd(encodeSetSpeed(kmh));
    },
    [mode, writeCmd],
  );

  const setMode = useCallback(
    async (newMode: PadMode) => {
      await writeCmd(encodeSetMode(newMode));
      setModeState(newMode);
    },
    [writeCmd],
  );

  return (
    <WalkingPadContext.Provider
      value={{
        status,
        isRunning,
        mode,
        stats,
        connect,
        disconnect,
        start,
        stop,
        setSpeed,
        setMode,
      }}
    >
      {children}
    </WalkingPadContext.Provider>
  );
}

export function useWalkingPad(): WalkingPadContextValue {
  const ctx = use(WalkingPadContext);
  if (!ctx) throw new Error("useWalkingPad must be used inside WalkingPadProvider");
  return ctx;
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors. If TypeScript reports unknown types for `BluetoothRemoteGATTCharacteristic` or `BluetoothDevice`, the `tsconfig.json` `lib` already includes `"DOM"` which should cover them. If not, run `npm install -D @types/web-bluetooth` and add `"web-bluetooth"` to the `types` array in `tsconfig.json`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/walking-pad/context.tsx
git commit -m "feat: add WalkingPad context provider and useWalkingPad hook"
```

---

### Task 4: Treadmill — wrapper and disconnected view

**Files:**

- Modify: `src/components/treadmill.tsx`

- [ ] **Step 1: Replace `src/components/treadmill.tsx`**

```tsx
import { RiBluetoothLine, RiLoader4Line } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { WalkingPadProvider, useWalkingPad } from "@/lib/walking-pad/context";

export function Treadmill() {
  return (
    <WalkingPadProvider>
      <TreadmillDashboard />
    </WalkingPadProvider>
  );
}

function TreadmillDashboard() {
  const { status } = useWalkingPad();
  if (status !== "connected") return <DisconnectedView />;
  return <ConnectedView />;
}

function DisconnectedView() {
  const { status, connect } = useWalkingPad();
  const isConnecting = status === "connecting";

  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <RiBluetoothLine className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">WalkingPad A1 Pro</p>
        <p className="text-xs text-muted-foreground">Not connected</p>
      </div>
      <Button onClick={connect} disabled={isConnecting} className="gap-2">
        {isConnecting ? (
          <>
            <RiLoader4Line className="size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <RiBluetoothLine className="size-4" />
            Connect
          </>
        )}
      </Button>
    </div>
  );
}

// Filled in Task 5
function ConnectedView() {
  return <div className="p-4" />;
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/treadmill.tsx
git commit -m "feat: add Treadmill wrapper and disconnected view"
```

---

### Task 5: Connected view — header, speed gauge, stats grid

**Files:**

- Modify: `src/components/treadmill.tsx`

- [ ] **Step 1: Replace `src/components/treadmill.tsx` with header + gauge + stats**

```tsx
import { RiBluetoothLine, RiLoader4Line, RiWifiOffLine } from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WalkingPadProvider, useWalkingPad } from "@/lib/walking-pad/context";

export function Treadmill() {
  return (
    <WalkingPadProvider>
      <TreadmillDashboard />
    </WalkingPadProvider>
  );
}

function TreadmillDashboard() {
  const { status } = useWalkingPad();
  if (status !== "connected") return <DisconnectedView />;
  return <ConnectedView />;
}

function DisconnectedView() {
  const { status, connect } = useWalkingPad();
  const isConnecting = status === "connecting";

  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <RiBluetoothLine className="size-10 text-muted-foreground" />
        <p className="text-sm font-medium">WalkingPad A1 Pro</p>
        <p className="text-xs text-muted-foreground">Not connected</p>
      </div>
      <Button onClick={connect} disabled={isConnecting} className="gap-2">
        {isConnecting ? (
          <>
            <RiLoader4Line className="size-4 animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <RiBluetoothLine className="size-4" />
            Connect
          </>
        )}
      </Button>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function SpeedGauge({ speed }: { speed: number }) {
  const r = 40;
  const cx = 50;
  const cy = 52;
  const circumference = 2 * Math.PI * r; // ≈ 251.3
  const arcLength = circumference * 0.75; // 270° arc ≈ 188.5
  const fraction = Math.max(0, Math.min(1, (speed - 0.5) / (6.0 - 0.5)));
  const fillLength = arcLength * fraction;

  // rotate(135) moves the stroke start to ~7:30 o'clock (bottom-left),
  // producing a symmetric 270° arc with a 90° gap at the bottom.
  return (
    <svg
      viewBox="0 0 100 110"
      className="w-full h-full"
      aria-label={`Speed: ${speed.toFixed(1)} km/h`}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth="8"
        className="stroke-muted"
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        strokeWidth="8"
        className="stroke-primary transition-all duration-300"
        strokeDasharray={`${fillLength} ${circumference - fillLength}`}
        strokeLinecap="round"
        transform={`rotate(135 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-foreground"
        fontSize="18"
        fontWeight="700"
      >
        {speed.toFixed(1)}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
        km/h
      </text>
    </svg>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md bg-muted/50 px-2 py-2">
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ConnectedView() {
  const { stats, disconnect } = useWalkingPad();

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">WalkingPad A1 Pro</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect} className="gap-1.5 text-xs">
          <RiWifiOffLine className="size-3.5" />
          Disconnect
        </Button>
      </div>

      {/* Gauge + Stats */}
      <div className="flex items-center gap-3">
        <div className="w-28 shrink-0">
          <SpeedGauge speed={stats.speed} />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <StatCell label="time" value={formatTime(stats.time)} />
          <StatCell label="steps" value={stats.steps.toLocaleString()} />
          <StatCell label="distance" value={`${stats.distance.toFixed(1)} km`} />
          <StatCell label="calories" value={`${stats.calories} kcal`} />
        </div>
      </div>

      {/* Controls — added in Task 6 */}
    </div>
  );
}
```

- [ ] **Step 2: Lint**

Remove the `cn` import from this task's file (it is not used until Task 6):

```tsx
// Remove this line for now — it will be re-added in Task 6:
// import { cn } from "@/lib/utils"
```

Then lint:

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/treadmill.tsx
git commit -m "feat: add connected view with speed gauge and stats grid"
```

---

### Task 6: Connected view — mode toggle, speed controls, start/stop

**Files:**

- Modify: `src/components/treadmill.tsx`

- [ ] **Step 1: Replace `ConnectedView` with the full controls version**

Replace only the `ConnectedView` function in `src/components/treadmill.tsx` (keep everything else unchanged):

```tsx
function ConnectedView() {
  const { stats, isRunning, mode, disconnect, start, stop, setSpeed, setMode } = useWalkingPad();

  const handleSpeedDown = () => setSpeed(stats.speed - 0.5);
  const handleSpeedUp = () => setSpeed(stats.speed + 0.5);

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">WalkingPad A1 Pro</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect} className="gap-1.5 text-xs">
          <RiWifiOffLine className="size-3.5" />
          Disconnect
        </Button>
      </div>

      {/* Gauge + Stats */}
      <div className="flex items-center gap-3">
        <div className="w-28 shrink-0">
          <SpeedGauge speed={stats.speed} />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <StatCell label="time" value={formatTime(stats.time)} />
          <StatCell label="steps" value={stats.steps.toLocaleString()} />
          <StatCell label="distance" value={`${stats.distance.toFixed(1)} km`} />
          <StatCell label="calories" value={`${stats.calories} kcal`} />
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Mode
        </span>
        <div className="flex overflow-hidden rounded-md border">
          <button
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              mode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
          <button
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              mode === "auto" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            onClick={() => setMode("auto")}
          >
            Auto
          </button>
        </div>
      </div>

      {/* Speed controls — disabled in auto mode */}
      <div
        className={cn(
          "flex flex-col gap-1 transition-opacity",
          mode === "auto" && "pointer-events-none opacity-50",
        )}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Speed
        </span>
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeedDown}
            disabled={stats.speed <= 0.5}
            className="size-8 p-0 text-lg font-bold"
          >
            −
          </Button>
          <span className="min-w-14 text-center text-sm font-semibold tabular-nums">
            {stats.speed.toFixed(1)} km/h
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSpeedUp}
            disabled={stats.speed >= 6.0}
            className="size-8 p-0 text-lg font-bold"
          >
            +
          </Button>
        </div>
      </div>

      {/* Start / Stop */}
      <Button
        onClick={isRunning ? stop : start}
        className={cn(
          "w-full gap-2 font-semibold",
          isRunning
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-green-600 text-white hover:bg-green-700",
        )}
      >
        {isRunning ? "■  Stop" : "▶  Start"}
      </Button>
    </div>
  );
}
```

Also ensure `cn` is imported at the top of the file (it should already be from Task 5, but confirm it's there):

```tsx
import { cn } from "@/lib/utils";
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/treadmill.tsx
git commit -m "feat: add mode toggle, speed controls, and start/stop to dashboard"
```

---

## Notes

- **BLE protocol calibration:** The `decodeNotification` byte offsets in `protocol.ts` are based on reverse-engineering of the A1 Pro. If live stats appear wrong (e.g. steps and time swapped), adjust the `getUint32` offsets at bytes 5, 9, and 13.
- **Browser compatibility:** Web Bluetooth requires Chrome/Edge on desktop, or Chrome on Android. It will not work in Firefox, Safari, or non-HTTPS contexts (except localhost).
- **Speed when stopped:** When the belt is not running, `stats.speed` reports 0. The speed controls still send commands — the device stores the target speed and applies it on start.
