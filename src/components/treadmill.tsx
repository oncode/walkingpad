import { RiBluetoothLine, RiLoader4Line } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { WalkingPadProvider, useWalkingPad } from "@/lib/walking-pad/context";
import { SENSITIVITY_LABELS, countdownLabel, isCountdown } from "@/lib/walking-pad/protocol";
import type { AutoSensitivity } from "@/lib/walking-pad/protocol";

export function Treadmill() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
      <WalkingPadProvider>
        <TreadmillDashboard />
      </WalkingPadProvider>
    </div>
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
    <div className="flex min-h-screen w-full flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-white/5 bg-secondary/20 p-12 shadow-2xl backdrop-blur-3xl">
        <div className="relative">
          <div className="absolute inset-0 size-24 rounded-full bg-primary/20 blur-2xl"></div>
          <div className="relative flex size-24 items-center justify-center rounded-full border border-white/10 bg-background shadow-inner">
            {isConnecting ? (
              <RiLoader4Line className="size-10 animate-spin text-primary" />
            ) : (
              <RiBluetoothLine className="size-10 text-primary" />
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-3xl font-bold tracking-tighter text-foreground">WalkingPad</h1>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase opacity-80">
            Dashboard
          </p>
        </div>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="group relative mt-4 inline-flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-primary px-8 font-bold tracking-widest text-primary-foreground uppercase transition-all duration-700 ease-expo hover:scale-[1.02] hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background active:scale-95 disabled:pointer-events-none disabled:scale-100 disabled:opacity-50"
        >
          <span className="relative flex items-center gap-2">
            {isConnecting ? "Establishing Link..." : "Connect"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calorie calculation — ported from ph4-walkingpad/profile.py
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

function caloriesWalkPerMinute(speedKmh: number, weightKg: number): number {
  const s = Math.max(1, Math.min(7.5, speedKmh));
  const row = CALORIE_SPEED_MATRIX[5];
  const raw = row[0] * s ** 3 + row[1] * s ** 2 + row[2] * s + row[3];
  return (raw / 60) * weightKg;
}

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

function ConnectedView() {
  const {
    stats,
    mode,
    sensitivity,
    disconnect,
    start,
    stop,
    setSpeed,
    setMode,
    setSensitivity,
    resetSession,
  } = useWalkingPad();
  const { beltStatus } = stats;

  const [bodyWeight, setBodyWeight] = useBodyWeight();
  const [weightInput, setWeightInput] = useState(String(bodyWeight));

  const isRunning = beltStatus === "running";
  const calories = calculateCalories(stats.time, stats.distance, bodyWeight);

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
      if (mode === "standby") {
        await setMode("manual");
        await new Promise((r) => setTimeout(r, 1000));
      }
      await (isRunning ? stop() : start());
    } finally {
      setIsPending(false);
    }
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

      {/* Main Display: Typographic Hero */}
      <main className="relative flex flex-1 flex-col justify-center overflow-hidden px-4 py-8 lg:px-12 lg:py-12">
        {/* Subtle background glow attached to the speed to ground it */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 h-[50vh] w-[50vw] -translate-x-1/2 -translate-y-1/2 rounded-[100%] blur-[120px] transition-opacity duration-1000",
            isRunning ? "pointer-events-none bg-primary opacity-15" : "opacity-0",
          )}
        ></div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between">
          {/* Minus Button */}
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
              disabled={targetSpeed <= 0.5 || mode === "auto" || mode === "standby" || !isRunning}
              className="group flex size-16 items-center justify-center rounded-2xl border border-white/5 bg-secondary/50 backdrop-blur transition-all duration-500 ease-expo hover:border-white/10 hover:bg-secondary active:scale-95 disabled:scale-100 disabled:opacity-20 md:size-24 lg:size-32"
            >
              <span className="text-4xl font-light text-muted-foreground transition-colors duration-500 group-hover:text-primary lg:text-5xl">
                −
              </span>
            </button>
          </div>

          {/* Speed Number */}
          <div className="flex shrink-0 flex-col items-center">
            <div className="relative flex flex-col items-center">
              <span className="text-[25vw] leading-[0.8] font-medium tracking-tighter text-foreground tabular-nums sm:text-[22vw] md:text-[20vw]">
                {targetSpeed.toFixed(1)}
              </span>
              <span className="absolute -bottom-8 inline-block text-sm font-bold tracking-[0.25em] text-muted-foreground uppercase opacity-80 lg:text-base">
                km/h
              </span>
            </div>

            {/* Start/Stop primary action */}
            <div className="mt-14 flex w-full justify-center lg:mt-24">
              <button
                onClick={handleStartStop}
                disabled={isPending || isCountdown(beltStatus)}
                className={cn(
                  "relative flex h-14 w-auto min-w-[200px] transform items-center justify-center overflow-hidden rounded-xl px-8 font-bold tracking-[0.2em] uppercase transition-all duration-700 ease-quart hover:scale-[1.02] focus:ring-2 focus:ring-primary focus:ring-offset-4 focus:ring-offset-background focus:outline-none active:scale-95 lg:h-16 lg:px-12",
                  isRunning
                    ? "border border-border bg-secondary text-foreground hover:border-white/10 hover:bg-secondary/80"
                    : isCountdown(beltStatus)
                      ? "scale-100 cursor-not-allowed bg-secondary/50 text-muted-foreground hover:scale-100"
                      : mode === "standby"
                        ? "bg-orange-500 text-white shadow-[0_0_50px_-15px_rgba(249,115,22,1)] hover:shadow-[0_0_70px_-10px_rgba(249,115,22,1)]"
                        : "bg-primary text-primary-foreground shadow-[0_0_50px_-15px_var(--color-primary)] hover:shadow-[0_0_70px_-10px_var(--color-primary)]",
                )}
              >
                <div className="relative flex items-center gap-3">
                  {isCountdown(beltStatus) ? (
                    <span className="text-2xl tracking-normal tabular-nums">
                      {countdownLabel(beltStatus)}
                    </span>
                  ) : isRunning ? (
                    <>
                      <span className="block size-2 rounded-sm bg-foreground"></span>
                      Stop Belt
                    </>
                  ) : (
                    <>
                      <span className="block h-0 w-0 border-y-4 border-l-[6px] border-y-transparent border-l-primary-foreground"></span>
                      Start Belt
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Plus Button */}
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
              disabled={targetSpeed >= 6.0 || mode === "auto" || mode === "standby" || !isRunning}
              className="group flex size-16 items-center justify-center rounded-2xl border border-white/5 bg-secondary/50 backdrop-blur transition-all duration-500 ease-expo hover:border-white/10 hover:bg-secondary active:scale-95 disabled:scale-100 disabled:opacity-20 md:size-24 lg:size-32"
            >
              <span className="text-4xl font-light text-muted-foreground transition-colors duration-500 group-hover:text-primary lg:text-5xl">
                +
              </span>
            </button>
          </div>
        </div>
      </main>

      {/* Auxiliary Stats Layer */}
      <footer className="flex w-full flex-col gap-12 border-t border-white/3 px-6 py-8 md:gap-16 lg:px-12 lg:py-12">
        {/* Modals & Settings Row */}
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between lg:gap-10">
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">
              Control Mode
            </span>
            <div className="flex gap-6">
              <button
                className={cn(
                  "text-xs font-bold tracking-[0.15em] uppercase transition-colors duration-500",
                  mode === "standby"
                    ? "text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("standby")}
              >
                Standby
              </button>
              <button
                className={cn(
                  "text-xs font-bold tracking-[0.15em] uppercase transition-colors duration-500",
                  mode === "manual"
                    ? "text-primary drop-shadow-[0_0_8px_var(--color-primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("manual")}
              >
                Manual
              </button>
              <button
                className={cn(
                  "flex items-center gap-2 text-xs font-bold tracking-[0.15em] uppercase transition-colors duration-500",
                  mode === "auto"
                    ? "text-primary drop-shadow-[0_0_8px_var(--color-primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("auto")}
              >
                Auto{" "}
                {mode === "auto" && (
                  <span className="inline-flex rounded-sm border border-primary/30 px-1.5 py-0.5 text-[9px] leading-none tracking-widest text-primary">
                    {SENSITIVITY_LABELS[sensitivity]}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">
              Operator Weight
            </span>
            <div className="group flex items-center gap-2">
              <input
                type="number"
                min={20}
                max={300}
                step={0.5}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onBlur={() => {
                  const kg = parseFloat(weightInput);
                  if (Number.isFinite(kg) && kg >= 20 && kg <= 300) setBodyWeight(kg);
                  else setWeightInput(String(bodyWeight));
                }}
                className="w-16 border-b border-border bg-transparent pb-1 text-sm font-bold text-foreground tabular-nums transition-colors duration-300 outline-none focus:border-primary"
              />
              <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                kg
              </span>
            </div>
          </div>
        </div>

        {/* Metrics Grid Row */}
        <div className="grid w-full grid-cols-2 gap-y-8 md:grid-cols-4 md:gap-y-0">
          {/* Metric 1 */}
          <div className="flex flex-col justify-end gap-3 md:pr-6 lg:pr-10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">
              Steps
            </span>
            <span className="text-4xl font-light tracking-tighter tabular-nums lg:text-5xl">
              {stats.steps}
            </span>
          </div>

          {/* Metric 2 */}
          <div className="flex flex-col justify-end gap-3 md:border-l md:border-white/3 md:pl-6 lg:pl-10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">
              Distance
            </span>
            <span className="text-4xl font-light tracking-tighter tabular-nums lg:text-5xl">
              {stats.distance.toFixed(2)}
              <span className="ml-2 text-xl tracking-normal text-muted-foreground">km</span>
            </span>
          </div>

          {/* Metric 3 */}
          <div className="flex flex-col justify-end gap-3 md:border-l md:border-white/3 md:pl-6 lg:pl-10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">
              Time Elapsed
            </span>
            <span className="text-4xl font-light tracking-tighter tabular-nums lg:text-5xl">
              {formatTime(stats.time)}
            </span>
          </div>

          {/* Metric 4 */}
          <div className="flex flex-col justify-end gap-3 md:border-l md:border-white/3 md:pl-6 lg:pl-10">
            <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase opacity-60">
              Energy Exerted
            </span>
            <span className="text-4xl font-light tracking-tighter tabular-nums lg:text-5xl">
              {calories}
              <span className="ml-2 text-xl tracking-normal text-muted-foreground">kcal</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Dynamic Auto Sensitivity Toggles */}
      <div
        className={cn(
          "fixed top-24 left-1/2 z-50 flex -translate-x-1/2 gap-4 rounded-2xl border border-white/10 bg-secondary/80 p-2.5 shadow-2xl backdrop-blur-md transition-all duration-700 ease-expo",
          mode === "auto"
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-8 opacity-0",
        )}
      >
        {([1, 2, 3] as AutoSensitivity[]).map((level) => (
          <button
            key={level}
            className={cn(
              "rounded-xl px-6 py-2.5 text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-500 ease-quart",
              sensitivity === level
                ? "bg-primary text-primary-foreground shadow-[0_0_15px_var(--color-primary)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
            onClick={() => setSensitivity(level)}
          >
            {SENSITIVITY_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  );
}
