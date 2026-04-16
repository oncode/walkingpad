import { useState, useCallback } from "react";

const SETTINGS_KEY = "walkingpad.settings";

export interface TreadmillSettings {
  maxSpeed: number;
  minSpeed: number;
  speedStep: number;
  restoreSpeed: boolean;
  lastSpeed: number;
}

export const DEFAULT_SETTINGS: TreadmillSettings = {
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
