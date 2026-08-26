import { RiSettings3Line } from "@remixicon/react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTreadmillSettings, DEFAULT_SETTINGS } from "@/hooks/use-treadmill-settings";

interface SettingsNumberFieldProps {
  id: string;
  label: string;
  value: number;
  fallback: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}

function SettingsNumberField({
  id,
  label,
  value,
  fallback,
  min,
  max,
  step = 0.1,
  disabled,
  onCommit,
}: SettingsNumberFieldProps) {
  // While the field is focused we render what was typed, so partial input
  // ("", "3.", "0.") survives instead of being parsed away on every keystroke.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 items-center gap-2">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-8 border-white/10 bg-black/20 text-xs"
        value={draft ?? String(value)}
        // The menu popup runs typeahead/list navigation on keydown and calls
        // preventDefault() for every character key, which swallows typing in
        // nested inputs. Keep our keystrokes from reaching it.
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseFloat(e.target.value);
          if (!Number.isNaN(parsed)) onCommit(parsed);
        }}
        onBlur={() => {
          if (draft !== null && Number.isNaN(parseFloat(draft))) onCommit(fallback);
          setDraft(null);
        }}
      />
    </div>
  );
}

export function TreadmillSettingsMenu() {
  const [settings, updateSettings] = useTreadmillSettings();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 pt-0.5 text-muted-foreground transition-colors duration-500 hover:text-foreground focus:outline-none">
        <RiSettings3Line className="size-4" />
        <span className="sr-only">Settings</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 border-white/10 bg-secondary/90 backdrop-blur-md"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-bold tracking-widest uppercase opacity-80">
            Settings
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/5" />
          <div className="flex flex-col gap-4 p-2">
            <SettingsNumberField
              id="max-speed"
              label="Max Speed"
              min={0.1}
              value={settings.maxSpeed}
              fallback={DEFAULT_SETTINGS.maxSpeed}
              onCommit={(maxSpeed) => updateSettings({ maxSpeed })}
            />
            <SettingsNumberField
              id="min-speed"
              label="Min Speed"
              min={0}
              value={settings.minSpeed}
              fallback={DEFAULT_SETTINGS.minSpeed}
              onCommit={(minSpeed) => updateSettings({ minSpeed })}
            />
            <SettingsNumberField
              id="step-speed"
              label="Step Speed"
              min={0.1}
              value={settings.speedStep}
              fallback={DEFAULT_SETTINGS.speedStep}
              onCommit={(speedStep) => updateSettings({ speedStep })}
            />
            <SettingsNumberField
              id="body-weight"
              label="Body Weight (kg)"
              min={20}
              max={300}
              step={0.5}
              value={settings.bodyWeight}
              fallback={DEFAULT_SETTINGS.bodyWeight}
              onCommit={(bodyWeight) => updateSettings({ bodyWeight })}
            />

            <DropdownMenuSeparator className="my-2 bg-white/5" />

            <SettingsNumberField
              id="start-speed"
              label="Start Speed"
              min={0}
              value={settings.startSpeed}
              fallback={DEFAULT_SETTINGS.startSpeed}
              disabled={settings.restoreSpeed}
              onCommit={(startSpeed) => updateSettings({ startSpeed })}
            />
            <div className="flex items-center space-x-2 px-1">
              <Checkbox
                id="restore-speed"
                checked={settings.restoreSpeed}
                onCheckedChange={(checked) => updateSettings({ restoreSpeed: checked === true })}
                className="border-white/20 data-[state=checked]:bg-primary"
              />
              <Label
                htmlFor="restore-speed"
                className="text-xs leading-none font-medium text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                or restore last speed on start
              </Label>
            </div>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
