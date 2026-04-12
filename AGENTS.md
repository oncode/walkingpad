# Agent Guidelines

## Project Overview

Web UI for managing a KingSmith walking pad. Built on a full-stack React 19 + TanStack Start scaffold, with Drizzle ORM, shadcn/ui, and Better Auth.

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

If you are unsure how to do something, use the grep mcp server to search code examples from GitHub.

<!-- code-review-graph MCP tools -->

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes — gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review — token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
