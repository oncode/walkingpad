# Agent Guidelines

## Project Overview

Web UI for managing a KingSmith treadmill. Built on a full-stack React 19 + TanStack Start scaffold, with Drizzle ORM, shadcn/ui, and Better Auth.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Lint with Oxlint (also type-checks)
npm run lint:fix     # Auto-fix lint issues
npm run format       # Format with Oxfmt
npm run check        # Run format + lint together
npm run db generate  # Generate Drizzle migrations
npm run db migrate   # Apply migrations
npm run db studio    # Open Drizzle Studio
npm run ui add <component>  # Add a shadcn/ui component
npm run auth:generate       # Regenerate Better Auth schema
npm run auth:migrate        # Apply auth schema migrations
npm tanstack doc <path> --json  # Look up TanStack documentation
```

**Workflow:** Use `npm run lint` for type-checking — do not rebuild after small changes. No testing framework right now; rely on lint. Formatting runs automatically on commit via Husky.

## Topic-specific Guidelines

- [TanStack patterns](.agents/tanstack-patterns.md) - Routing, data fetching, loaders, server functions, environment shaking
- [Auth patterns](.agents/auth.md) - Route guards, middleware, auth utilities
- [TypeScript conventions](.agents/typescript.md) - Casting rules, prefer type inference
- [Workflow](.agents/workflow.md) - Workflow commands, validation approach
