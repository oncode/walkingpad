# WalkingPad

Web UI for managing a KingSmith walking pad.

Features:

- Speed control for manual mode
- Sensitivity control for auto mode
- Stats display (Steps, Distance, Time, Calories)
- Doesn't reset session stats when belt is stopped
- Weight input for more accurate calorie calculations
- Overwrite min/max/start speed and speed steps
- Auto restore last set speed on start if enabled
- Auto switching to manual mode when starting and no mode is set yet
- Auto switching to standby mode when disconnecting

## Development

Run the development server:

```bash
npm run dev
```

The development server should now be running at [http://localhost:3000](http://localhost:3000).

## License

GPL-3.0-or-later
