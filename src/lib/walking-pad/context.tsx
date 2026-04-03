import { createContext, use, useCallback, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  BLE_NOTIFY_UUID,
  BLE_SERVICE_UUID,
  BLE_WRITE_UUID,
  DEFAULT_STATS,
  type WalkingPadStats,
  buildStatsRequest,
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
  const [mode, setModeState] = useState<PadMode>("manual");
  const [stats, setStats] = useState<WalkingPadStats>(DEFAULT_STATS);

  const writeCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const notifyListenerRef = useRef<((e: Event) => void) | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    writeCharRef.current = null;
    deviceRef.current = null;
    setStatus("disconnected");
    setModeState("manual");
    setStats(DEFAULT_STATS);
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
        setStats((prev) =>
          prev.beltStatus === decoded.beltStatus &&
          prev.speed === decoded.speed &&
          prev.time === decoded.time &&
          prev.distance === decoded.distance &&
          prev.steps === decoded.steps
            ? prev
            : decoded,
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

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    deviceRef.current?.gatt?.disconnect();
  }, []);

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

  return (
    <WalkingPadContext.Provider
      value={{
        status,
        isRunning: stats.beltStatus === "running",
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
