import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  BLE_NOTIFY_UUID,
  BLE_SERVICE_UUID,
  BLE_WRITE_UUID,
  DEFAULT_STATS,
  type AutoSensitivity,
  type PadMode,
  type WalkingPadStats,
  buildStatsRequest,
  decodeNotification,
  encodeSetMode,
  encodeSetSensitivity,
  encodeSetSpeed,
  encodeStart,
  encodeStop,
} from "./protocol";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

type WalkingPadContextValue = {
  status: ConnectionStatus;
  isRunning: boolean;
  mode: PadMode;
  sensitivity: AutoSensitivity;
  stats: WalkingPadStats;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setSpeed: (kmh: number) => Promise<void>;
  setMode: (mode: PadMode) => Promise<void>;
  setSensitivity: (level: AutoSensitivity) => Promise<void>;
  resetSession: () => void;
};

const WalkingPadContext = createContext<WalkingPadContextValue | null>(null);

export function WalkingPadProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [mode, setModeState] = useState<PadMode>("standby");
  const [sensitivity, setSensitivityState] = useState<AutoSensitivity>(2);
  const [stats, setStats] = useState<WalkingPadStats>(DEFAULT_STATS);

  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const notifyListenerRef = useRef<((e: Event) => void) | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rawStatsRef = useRef({ time: 0, distance: 0, steps: 0 });
  const sessionOffsetRef = useRef({ time: 0, distance: 0, steps: 0 });

  const writeCmd = useCallback(async (data: Uint8Array): Promise<boolean> => {
    if (!writeCharRef.current) return false;
    try {
      console.log(
        "write cmd:",
        Array.from(data)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      );
      await writeCharRef.current.writeValueWithoutResponse(data as BufferSource);
      return true;
    } catch (err) {
      console.error("BLE write failed:", err);
      toast.error("Command failed");
      return false;
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    if (!deviceRef.current) return;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (notifyCharRef.current && notifyListenerRef.current) {
      notifyCharRef.current.removeEventListener(
        "characteristicvaluechanged",
        notifyListenerRef.current,
      );
      notifyCharRef.current = null;
      notifyListenerRef.current = null;
    }
    if (deviceRef.current) {
      deviceRef.current.removeEventListener("gattserverdisconnected", handleDisconnect);
      deviceRef.current = null;
    }
    writeCharRef.current = null;
    setStatus("disconnected");
    setModeState("standby");
    setSensitivityState(2);
    setStats(DEFAULT_STATS);
    rawStatsRef.current = { time: 0, distance: 0, steps: 0 };
    sessionOffsetRef.current = { time: 0, distance: 0, steps: 0 };
    if (!intentionalDisconnectRef.current) {
      toast.error("Device disconnected");
    }
    intentionalDisconnectRef.current = false;
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
        optionalServices: ["00010203-0405-0607-0809-0a0b0c0d1912"],
      });

      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", handleDisconnect);

      if (!device.gatt) throw new Error("Device does not support GATT");
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const writeChar = await service.getCharacteristic(BLE_WRITE_UUID);
      const notifyChar = await service.getCharacteristic(BLE_NOTIFY_UUID);

      writeCharRef.current = writeChar;

      const notifyHandler = (e: Event) => {
        const char = e.target as BluetoothRemoteGATTCharacteristic;
        if (!char.value) return;
        const decoded = decodeNotification(char.value);
        if (!decoded) return;

        if (decoded.mode) {
          setModeState((prev) => (prev !== decoded.mode ? decoded.mode! : prev));
        }

        const prevRaw = rawStatsRef.current;
        if (decoded.time < prevRaw.time) sessionOffsetRef.current.time += prevRaw.time;
        if (decoded.distance < prevRaw.distance)
          sessionOffsetRef.current.distance += prevRaw.distance;
        if (decoded.steps < prevRaw.steps) sessionOffsetRef.current.steps += prevRaw.steps;

        rawStatsRef.current = {
          time: decoded.time,
          distance: decoded.distance,
          steps: decoded.steps,
        };

        const effectiveDecoded = {
          ...decoded,
          time: decoded.time + sessionOffsetRef.current.time,
          distance: decoded.distance + sessionOffsetRef.current.distance,
          steps: decoded.steps + sessionOffsetRef.current.steps,
        };

        setStats((prev) =>
          prev.beltStatus === effectiveDecoded.beltStatus &&
          prev.speed === effectiveDecoded.speed &&
          prev.time === effectiveDecoded.time &&
          prev.distance === effectiveDecoded.distance &&
          prev.steps === effectiveDecoded.steps
            ? prev
            : effectiveDecoded,
        );
      };
      notifyListenerRef.current = notifyHandler;
      notifyCharRef.current = notifyChar;
      notifyChar.addEventListener("characteristicvaluechanged", notifyHandler);

      await notifyChar.startNotifications();

      // Periodically request stats — device responds via characteristicvaluechanged
      pollIntervalRef.current = setInterval(async () => {
        if (!writeCharRef.current) return;
        try {
          await writeCharRef.current.writeValueWithoutResponse(buildStatsRequest() as BufferSource);
        } catch (err) {
          console.warn("poll error:", err);
        }
      }, 1000);

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

  const start = useCallback(async () => {
    await writeCmd(encodeStart());
  }, [writeCmd]);

  const stop = useCallback(async () => {
    await writeCmd(encodeStop());
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
      const ok = await writeCmd(encodeSetMode(newMode));
      if (ok) setModeState(newMode);
    },
    [writeCmd],
  );

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    if (mode !== "standby") {
      await setMode("standby");
      await new Promise((r) => setTimeout(r, 100));
    }
    deviceRef.current?.gatt?.disconnect();
  }, [mode, setMode]);

  const setSensitivity = useCallback(
    async (level: AutoSensitivity) => {
      const ok = await writeCmd(encodeSetSensitivity(level));
      if (ok) setSensitivityState(level);
    },
    [writeCmd],
  );

  const resetSession = useCallback(() => {
    sessionOffsetRef.current = { time: 0, distance: 0, steps: 0 };
    setStats((prev) => ({
      ...prev,
      time: rawStatsRef.current.time,
      distance: rawStatsRef.current.distance,
      steps: rawStatsRef.current.steps,
    }));
  }, []);

  return (
    <WalkingPadContext.Provider
      value={{
        status,
        isRunning: stats.beltStatus === "running",
        mode,
        sensitivity,
        stats,
        connect,
        disconnect,
        start,
        stop,
        setSpeed,
        setMode,
        setSensitivity,
        resetSession,
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
