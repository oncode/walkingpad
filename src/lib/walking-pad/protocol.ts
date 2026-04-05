// BLE service and characteristic UUIDs for the Kingsmith WalkingPad (A1 Pro)
export const BLE_SERVICE_UUID = "0000fe00-0000-1000-8000-00805f9b34fb";
export const BLE_WRITE_UUID = "0000fe02-0000-1000-8000-00805f9b34fb";
export const BLE_NOTIFY_UUID = "0000fe01-0000-1000-8000-00805f9b34fb";

export type BeltStatus = "running" | "stopped" | "countdown-3" | "countdown-2" | "countdown-1";

export type PadMode = "manual" | "auto" | "standby";

export type WalkingPadStats = {
  speed: number; // km/h
  time: number; // seconds elapsed
  steps: number;
  distance: number; // km
  beltStatus: BeltStatus;
  mode?: PadMode;
};

export const DEFAULT_STATS: WalkingPadStats = {
  speed: 0,
  time: 0,
  steps: 0,
  distance: 0,
  beltStatus: "stopped",
};

// Command format: [0xf7, 0xa2, param, value, checksum, 0xfd]
// checksum = (0xa2 + param + value) % 256
function buildCmd(param: number, value: number): Uint8Array {
  const checksum = (0xa2 + (param & 0xff) + (value & 0xff)) % 256;
  return new Uint8Array([0xf7, 0xa2, param, value, checksum, 0xfd]);
}

export function buildStatsRequest(): Uint8Array {
  return buildCmd(0x00, 0x00);
}

export function encodeStart(): Uint8Array {
  return buildCmd(0x04, 0x01);
}

// Stop by setting speed to 0 (param 0x01, value 0)
export function encodeStop(): Uint8Array {
  return buildCmd(0x01, 0x00);
}

/** Speed clamped to [0.5, 6.0] km/h. Device unit = 0.1 km/h. */
export function encodeSetSpeed(kmh: number): Uint8Array {
  const clamped = Math.max(0.5, Math.min(6.0, kmh));
  const raw = Math.round(clamped * 10);
  return buildCmd(0x01, raw);
}

// manual=1, auto(automatic)=0, standby=2
export function encodeSetMode(mode: PadMode): Uint8Array {
  const modeValues = {
    auto: 0x00,
    manual: 0x01,
    standby: 0x02,
  };
  return buildCmd(0x02, modeValues[mode] ?? 0x01);
}

/**
 * Auto-mode sensitivity: how quickly the belt reacts to walking speed changes.
 * 1 = high (most reactive), 2 = medium, 3 = low (least reactive)
 */
export type AutoSensitivity = 1 | 2 | 3;

export const SENSITIVITY_LABELS: Record<AutoSensitivity, string> = {
  1: "High",
  2: "Medium",
  3: "Low",
};

/**
 * Preference packet format (distinct from the regular 6-byte command packet):
 *   [0xf7, 0xa6, key, stype=0x00, val_hi, val_mid, val_lo, checksum, 0xfd]
 *   checksum = sum(bytes[1..-2]) % 256
 * PREFS_SENSITIVITY key = 0x06
 */
function buildPrefCmd(key: number, value: number): Uint8Array {
  const bytes = [0xa6, key & 0xff, 0x00, 0x00, 0x00, value & 0xff];
  const checksum = bytes.reduce((acc, b) => (acc + b) & 0xff, 0);
  return new Uint8Array([0xf7, ...bytes, checksum, 0xfd]);
}

/** Set auto-mode sensitivity. Only has effect when in auto mode. */
export function encodeSetSensitivity(level: AutoSensitivity): Uint8Array {
  return buildPrefCmd(0x06, level);
}

/**
 * Decode a BLE notification packet from the WalkingPad.
 *
 * Packet layout:
 *   [0]     0xf8  header
 *   [1]     0xa2  type
 *   [2]     beltState   0/5=stopped, 1=running, 7/8/9=countdown
 *   [3]     speed       uint8, unit = 0.1 km/h
 *   [4]     manualMode
 *   [5-7]   time        3 bytes big-endian, seconds
 *   [8-10]  distance    3 bytes big-endian, unit = 0.01 km
 *   [11-13] steps       3 bytes big-endian
 *   [14]    appSpeed
 *   [16]    controllerButton
 */
export function decodeNotification(data: DataView): WalkingPadStats | null {
  if (data.byteLength < 17) return null;
  if (data.getUint8(0) !== 0xf8 || data.getUint8(1) !== 0xa2) return null;

  const beltState = data.getUint8(2);
  const speedRaw = data.getUint8(3);
  const manualModeRaw = data.getUint8(4);

  const time = (data.getUint8(5) << 16) | (data.getUint8(6) << 8) | data.getUint8(7);
  const distance = (data.getUint8(8) << 16) | (data.getUint8(9) << 8) | data.getUint8(10);
  const steps = (data.getUint8(11) << 16) | (data.getUint8(12) << 8) | data.getUint8(13);

  const beltStatus = beltStateToStatus(beltState);

  let mode: PadMode = "manual";
  if (manualModeRaw === 0) mode = "auto";
  else if (manualModeRaw === 2) mode = "standby";

  return {
    beltStatus,
    speed: speedRaw * 0.1,
    steps,
    time,
    distance: distance / 100,
    mode,
  };
}

export function isCountdown(status: BeltStatus): boolean {
  return status === "countdown-3" || status === "countdown-2" || status === "countdown-1";
}

export function countdownLabel(status: BeltStatus): string | null {
  if (status === "countdown-3") return "3";
  if (status === "countdown-2") return "2";
  if (status === "countdown-1") return "1";
  return null;
}

function beltStateToStatus(beltState: number): BeltStatus {
  switch (beltState) {
    case 9:
      return "countdown-3";
    case 8:
      return "countdown-2";
    case 7:
      return "countdown-1";
    case 1:
      return "running";
    default:
      return "stopped";
  }
}
