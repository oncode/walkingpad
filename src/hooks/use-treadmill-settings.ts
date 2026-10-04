import { useState, useCallback, useEffect } from "react";

const SETTINGS_KEY = "walkingpad.settings";
const SETTINGS_EVENT = "walkingpad.settings.updated";
export const MIN_START_SPEED = 0.1;

export interface TreadmillSettings {
  maxSpeed: number;
  minSpeed: number;
  speedStep: number;
  startSpeed: number;
  restoreSpeed: boolean;
  lastSpeed: number;
  bodyWeight: number;
}

export const DEFAULT_SETTINGS: TreadmillSettings = {
  maxSpeed: 6.0,
  minSpeed: 0.5,
  speedStep: 0.5,
  startSpeed: 3,
  restoreSpeed: false,
  lastSpeed: 0,
  bodyWeight: 75,
};

function getStoredSettings(): TreadmillSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed: TreadmillSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      // Older saves may still hold startSpeed 0, which made start a no-op.
      if (!(parsed.startSpeed >= MIN_START_SPEED)) parsed.startSpeed = DEFAULT_SETTINGS.startSpeed;
      return parsed;
    }
  } catch (e) {
    console.error("Failed to parse settings", e);
  }
  return DEFAULT_SETTINGS;
}

export function useTreadmillSettings() {
  const [settings, setSettingsState] = useState<TreadmillSettings>(getStoredSettings);

  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      if (e.type === SETTINGS_EVENT || (e as StorageEvent).key === SETTINGS_KEY) {
        setSettingsState(getStoredSettings());
      }
    };

    window.addEventListener(SETTINGS_EVENT, handleStorageChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(SETTINGS_EVENT, handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const updateSettings = useCallback((updates: Partial<TreadmillSettings>) => {
    const prev = getStoredSettings();
    const next = { ...prev, ...updates };
    // Enforce absolute limits
    if (next.maxSpeed < 0.1) next.maxSpeed = 0.1;
    if (next.minSpeed < 0) next.minSpeed = 0;
    if (next.speedStep < 0.1) next.speedStep = 0.1;
    if (next.startSpeed < MIN_START_SPEED) next.startSpeed = MIN_START_SPEED;

    // Ensure min is not greater than max
    if (next.minSpeed > next.maxSpeed) next.minSpeed = next.maxSpeed;

    if (next.bodyWeight < 20) next.bodyWeight = 20;
    if (next.bodyWeight > 300) next.bodyWeight = 300;

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(SETTINGS_EVENT));
  }, []);

  return [settings, updateSettings] as const;
}
