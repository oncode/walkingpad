# Shadcn UI Skill (Minimal & Opinionated)

## Purpose

Use shadcn/ui components correctly, consistently, and idiomatically in modern React/Next.js apps.

---

## Core Rules

- Always prefer **shadcn/ui components** over custom HTML
- Never recreate components that exist in shadcn
- Use MCP to install missing components instead of mocking them
- Keep components composable and simple

---

## Imports

- Import from "@/components/ui/\*"
- Do not import from internal shadcn paths
- Example:
  import { Button } from "@/components/ui/button"

---

## Styling

- Use Tailwind only
- Do NOT write custom CSS files
- Use `cn()` for class merging when needed
- Prefer utility classes over inline styles

---

## Component Patterns

### Layout

- Use semantic structure (section, header, etc.)
- Avoid unnecessary div nesting

### Forms

- Use:
  - Form
  - FormField
  - FormItem
  - FormLabel
  - FormControl
  - FormMessage

- Do NOT build forms manually

### Buttons

- Use variants: default, outline, ghost, destructive
- Avoid custom button styles unless necessary

### Cards

- Use Card, CardHeader, CardContent, CardFooter
- Do not recreate card layouts manually

---

## State & Logic

- Keep logic outside UI components when possible
- Prefer hooks for state
- Avoid large monolithic components

---

## Accessibility

- Always include labels for inputs
- Use proper button types (type="button"/"submit")
- Avoid divs acting as buttons

---

## Anti-Patterns (Never Do)

- ❌ Rebuilding shadcn components manually
- ❌ Copy-pasting raw HTML templates
- ❌ Mixing multiple UI libraries
- ❌ Deep prop drilling instead of composition
- ❌ Overusing useEffect

---

## When Unsure

- Prefer existing shadcn patterns
- Keep code minimal and readable
- Default to consistency over creativity

---

## Priority Order

1. Correct shadcn usage
2. Simplicity
3. Readability
4. Flexibility

---
