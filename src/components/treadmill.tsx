import { RiBluetoothLine, RiLoader4Line, RiWifiOffLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WalkingPadProvider, useWalkingPad } from "@/lib/walking-pad/context";
import { countdownLabel, isCountdown } from "@/lib/walking-pad/protocol";

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
  const { stats, mode, disconnect, start, stop, setSpeed, setMode } = useWalkingPad();
  const { beltStatus } = stats;

  const isRunning = beltStatus === "running";
  const calories = Math.round(stats.distance * 60);

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
          <StatCell label="distance" value={`${stats.distance.toFixed(2)} km`} />
          <StatCell label="calories" value={`${calories} kcal`} />
        </div>
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

      {/* Speed controls — disabled in auto mode */}
      <div
        className={cn(
          "flex flex-col gap-1 transition-opacity",
          mode === "auto" && "pointer-events-none opacity-50",
        )}
      >
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
