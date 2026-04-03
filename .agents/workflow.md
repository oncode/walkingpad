# Workflow

## Build Commands

- `npm build`: Only for build/bundler issues or verifying production output
- `npm lint`: Type-checking & type-aware linting
- `npm dev` runs indefinitely in watch mode
- `npm db` for Drizzle Kit commands (e.g. `npm db generate` to generate a migration)

Don't build after every change. If lint & type checks pass; assume changes work.

## TanStack CLI

Use `npm tanstack` (which is aliased to `npx @tanstack/cli@latest` in `package.json`) to look up TanStack documentation. Always pass `--json` for machine-readable output.

```bash
# List TanStack libraries (optionally filter by --group state|headlessUI|performance|tooling)
npm tanstack libraries --json

# Fetch a specific doc page
npm tanstack doc router framework/react/guide/data-loading --json
npm tanstack doc query framework/react/overview --docs-version v5 --json

# Search docs (optionally filter by --library, --framework, --limit)
npm tanstack search-docs "server functions" --library start --json
npm tanstack search-docs "loaders" --library router --framework react --json
```

## Testing

No testing framework is currently set up. Prefer lint checks for now.

## Formatting

Oxfmt is configured for consistent code formatting via `npm format`. It runs automatically on commit via Husky pre-commit hooks, so manual formatting is not necessary.
