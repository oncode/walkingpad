import { RiSettings3Line } from "@remixicon/react";

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
            <div className="grid grid-cols-2 items-center gap-2">
              <Label htmlFor="max-speed" className="text-xs font-semibold text-muted-foreground">
                Max Speed
              </Label>
              <Input
                id="max-speed"
                type="number"
                min={0.1}
                step={0.1}
                className="h-8 border-white/10 bg-black/20 text-xs"
                value={settings.maxSpeed}
                onChange={(e) =>
                  updateSettings({
                    maxSpeed: parseFloat(e.target.value) || DEFAULT_SETTINGS.maxSpeed,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <Label htmlFor="min-speed" className="text-xs font-semibold text-muted-foreground">
                Min Speed
              </Label>
              <Input
                id="min-speed"
                type="number"
                min={0}
                step={0.1}
                className="h-8 border-white/10 bg-black/20 text-xs"
                value={settings.minSpeed}
                onChange={(e) =>
                  updateSettings({
                    minSpeed: parseFloat(e.target.value) || DEFAULT_SETTINGS.minSpeed,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <Label htmlFor="step-speed" className="text-xs font-semibold text-muted-foreground">
                Step Speed
              </Label>
              <Input
                id="step-speed"
                type="number"
                min={0.1}
                step={0.1}
                className="h-8 border-white/10 bg-black/20 text-xs"
                value={settings.speedStep}
                onChange={(e) =>
                  updateSettings({
                    speedStep: parseFloat(e.target.value) || DEFAULT_SETTINGS.speedStep,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <Label htmlFor="body-weight" className="text-xs font-semibold text-muted-foreground">
                Body Weight (kg)
              </Label>
              <Input
                id="body-weight"
                type="number"
                min={20}
                max={300}
                step={0.5}
                className="h-8 border-white/10 bg-black/20 text-xs"
                value={settings.bodyWeight}
                onChange={(e) =>
                  updateSettings({
                    bodyWeight: parseFloat(e.target.value) || DEFAULT_SETTINGS.bodyWeight,
                  })
                }
              />
            </div>

            <DropdownMenuSeparator className="my-2 bg-white/5" />

            <Input type="text" />

            <div className="grid grid-cols-2 items-center gap-2">
              <Label htmlFor="start-speed" className="text-xs font-semibold text-muted-foreground">
                Start Speed
              </Label>
              <Input
                id="start-speed"
                type="number"
                min={0}
                step={0.1}
                className="h-8 border-white/10 bg-black/20 text-xs"
                value={settings.startSpeed}
                disabled={settings.restoreSpeed}
                onChange={(e) =>
                  updateSettings({
                    startSpeed: parseFloat(e.target.value) || DEFAULT_SETTINGS.startSpeed,
                  })
                }
              />
            </div>
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
