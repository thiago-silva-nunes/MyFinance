---
name: Progress indicatorClassName
description: The shadcn Progress component was patched to accept indicatorClassName for dynamic bar colors
---

## Rule
`src/components/ui/progress.tsx` accepts an extra `indicatorClassName?: string` prop that is forwarded to the `ProgressPrimitive.Indicator` element via `cn()`.

## Why
The default Progress only applies `bg-primary` to the fill. Budget progress bars need green/amber/red based on utilization percentage, so a dynamic class (`bg-emerald-500`, `bg-amber-500`, `bg-destructive`) must be injected.

## How to apply
Pass `indicatorClassName="bg-destructive"` (or any Tailwind color class) alongside `value` and `className` whenever a non-primary bar color is needed.
