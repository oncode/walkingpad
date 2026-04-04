import { RiBluetoothLine, RiLoader4Line, RiScales3Line, RiWifiOffLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WalkingPadProvider, useWalkingPad } from "@/lib/walking-pad/context";
import { SENSITIVITY_LABELS, countdownLabel, isCountdown } from "@/lib/walking-pad/protocol";
import type { AutoSensitivity } from "@/lib/walking-pad/protocol";

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
        <p className="text-sm font-medium">WalkingPad</p>
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

// ---------------------------------------------------------------------------
// Calorie calculation — ported from ph4-walkingpad/profile.py
// Source: http://www.shapesense.com/fitness-exercise/calculators/walking-calorie-burn-calculator.shtml
// Valid for speeds in range 1–7.5 km/h, flat surface (deg = 0)
// ---------------------------------------------------------------------------
const CALORIE_SPEED_MATRIX = [
  [0.0251, -0.2157, 0.7888, 1.2957],
  [0.0244, -0.2079, 0.8053, 1.3281],
  [0.0237, -0.2, 0.8217, 1.3605],
  [0.023, -0.1922, 0.8382, 1.3929],
  [0.0222, -0.1844, 0.8546, 1.4253],
  [0.0215, -0.1765, 0.871, 1.4577],
  [0.0171, -0.1062, 0.608, 1.86],
  [0.0184, -0.1134, 0.6566, 1.92],
  [0.0196, -0.1205, 0.7053, 1.98],
  [0.0208, -0.1277, 0.7539, 2.04],
  [0.0221, -0.1349, 0.8025, 2.1],
];

/**
 * Gross kcal/min burned while walking at `speed` km/h for a person
 * weighing `weightKg` kg, on a flat surface.
 * Polynomial coefficients sourced from the ph4-walkingpad project (profile.py).
 */
function caloriesWalkPerMinute(speedKmh: number, weightKg: number): number {
  const s = Math.max(1, Math.min(7.5, speedKmh));
  // Matrix row: elevation deg=0 → index = clamp(round(0 + 5), 0, 10) = 5
  const row = CALORIE_SPEED_MATRIX[5];
  const raw = row[0] * s ** 3 + row[1] * s ** 2 + row[2] * s + row[3];
  return (raw / 60) * weightKg;
}

/**
 * Total gross kcal for a session using the ph4 formula.
 * Since we have distance + time but not a per-segment speed breakdown,
 * we use average speed (distance / time) as a reasonable single-MET estimate.
 */
function calculateCalories(timeSeconds: number, distanceKm: number, weightKg: number): number {
  if (timeSeconds <= 0 || distanceKm <= 0 || weightKg <= 0) return 0;
  const avgSpeedKmh = distanceKm / (timeSeconds / 3600);
  const kcalPerMin = caloriesWalkPerMinute(avgSpeedKmh, weightKg);
  return Math.round(kcalPerMin * (timeSeconds / 60));
}

const BODY_WEIGHT_KEY = "walkingpad.bodyweight";

function useBodyWeight() {
  const [bodyWeight, setBodyWeightState] = useState<number>(() => {
    const stored = localStorage.getItem(BODY_WEIGHT_KEY);
    const parsed = stored ? parseFloat(stored) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 75;
  });

  const setBodyWeight = useCallback((kg: number) => {
    if (Number.isFinite(kg) && kg > 0) {
      localStorage.setItem(BODY_WEIGHT_KEY, String(kg));
      setBodyWeightState(kg);
    }
  }, []);

  return [bodyWeight, setBodyWeight] as const;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
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
      className="h-full w-full"
      role="img"
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
      {fraction > 0 && (
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
      )}
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
  const { stats, mode, sensitivity, disconnect, start, stop, setSpeed, setMode, setSensitivity } =
    useWalkingPad();
  const { beltStatus } = stats;

  const [bodyWeight, setBodyWeight] = useBodyWeight();
  const [weightInput, setWeightInput] = useState(String(bodyWeight));

  const isRunning = beltStatus === "running";
  const calories = calculateCalories(stats.time, stats.distance, bodyWeight);

  // Optimistic speed: track the last-commanded speed locally so rapid
  // +/− clicks accumulate correctly without waiting for device confirmation.
  const [targetSpeed, setTargetSpeed] = useState(stats.speed);
  const lastCmdTimeRef = useRef(0);

  useEffect(() => {
    if (Date.now() - lastCmdTimeRef.current > 2000) {
      setTargetSpeed(stats.speed);
    }
  }, [stats.speed]);

  const handleSpeedDown = () => {
    const next = Math.max(0.5, targetSpeed - 0.5);
    setTargetSpeed(next);
    lastCmdTimeRef.current = Date.now();
    void setSpeed(next);
  };

  const handleSpeedUp = () => {
    const next = Math.min(6.0, targetSpeed + 0.5);
    setTargetSpeed(next);
    lastCmdTimeRef.current = Date.now();
    void setSpeed(next);
  };

  const [isPending, setIsPending] = useState(false);

  const handleStartStop = async () => {
    if (isCountdown(beltStatus)) return;
    setIsPending(true);
    try {
      await (isRunning ? stop() : start());
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium">WalkingPad</span>
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
          <StatCell label="distance" value={`${stats.distance.toFixed(2)} km`} />
          <StatCell label="calories" value={`${calories} kcal`} />
        </div>
      </div>

      {/* Body weight input */}
      <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
        <RiScales3Line className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs text-muted-foreground">Body weight</span>
        <input
          type="number"
          min={20}
          max={300}
          step={0.5}
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          onBlur={() => {
            const kg = parseFloat(weightInput);
            if (Number.isFinite(kg) && kg >= 20 && kg <= 300) {
              setBodyWeight(kg);
            } else {
              setWeightInput(String(bodyWeight));
            }
          }}
          className="w-16 bg-transparent text-right text-sm font-semibold tabular-nums outline-none"
        />
        <span className="text-xs text-muted-foreground">kg</span>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Mode
        </span>
        <div className="flex overflow-hidden rounded-md border">
          <button
            type="button"
            className={cn(
              "flex-1 py-1.5 text-xs font-medium transition-colors",
              mode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
          <button
            type="button"
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

      {/* Sensitivity — only active / visible in auto mode */}
      {mode === "auto" && (
        <div className="flex flex-col gap-1 transition-opacity">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Sensitivity
          </span>
          <div className="flex overflow-hidden rounded-md border">
            {([1, 2, 3] as AutoSensitivity[]).map((level) => (
              <button
                key={level}
                type="button"
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium transition-colors",
                  sensitivity === level ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
                onClick={() => setSensitivity(level)}
              >
                {SENSITIVITY_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Speed controls — disabled in auto mode */}
      {mode === "manual" && (
        <div className="flex flex-col gap-1 transition-opacity">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Speed
          </span>
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSpeedDown}
              disabled={targetSpeed <= 0.5}
              className="size-8 p-0 text-lg font-bold"
            >
              −
            </Button>
            <span className="min-w-14 text-center text-sm font-semibold tabular-nums">
              {targetSpeed.toFixed(1)} km/h
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSpeedUp}
              disabled={targetSpeed >= 6.0}
              className="size-8 p-0 text-lg font-bold"
            >
              +
            </Button>
          </div>
        </div>
      )}

      {/* Start / Stop */}
      <Button
        onClick={handleStartStop}
        disabled={isPending || isCountdown(beltStatus)}
        className={cn(
          "w-full gap-2 font-semibold",
          isRunning
            ? "text-destructive-foreground bg-destructive hover:bg-destructive/90"
            : isCountdown(beltStatus)
              ? "bg-muted text-muted-foreground"
              : "bg-green-600 text-white hover:bg-green-700",
        )}
      >
        {isCountdown(beltStatus) ? (
          <span className="text-2xl font-bold tabular-nums">{countdownLabel(beltStatus)}</span>
        ) : isRunning ? (
          "■  Stop"
        ) : (
          "▶  Start"
        )}
      </Button>
    </div>
  );
}
