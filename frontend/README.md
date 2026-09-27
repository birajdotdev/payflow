# Next.js template

This is a Next.js template with shadcn/ui.

Application code lives in `src/app`, `src/components`, `src/hooks`, and `src/lib`.
The `@/*` import alias resolves to `src/*`. Static assets remain in `public/`,
and project configuration files stay at the root.

## TypeScript

TypeScript 7 runs `pnpm typecheck` and the type-checking step in `pnpm build`.
Next.js 16.3 uses the local TypeScript CLI by default.

Install dependencies with `pnpm install`. Oxlint handles linting, Prettier handles
formatting, and TypeScript 7 handles type checking. No TypeScript 6 compatibility
package is needed.

`.oxlintrc.json` preserves the supported rules and severities from the previous
Next.js Core Web Vitals and TypeScript ESLint presets, including React Hooks and
accessibility checks. The migration includes the experimental
`react/require-render-return` rule. It does not retain the unsupported
`@next/next/no-location-assign-relative-destination` and `react/no-deprecated`
checks. JSX usage tracking is handled natively; React Compiler `config` and
`gating` checks do not apply to Oxlint's fixed compiler configuration.

Use the Oxc editor extension for lint diagnostics. Type-aware Oxlint rules are
not enabled; `pnpm typecheck` remains the separate type check.

Run `pnpm typecheck`, `pnpm lint`, and `pnpm build` to verify changes.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the UI components in the `src/components/ui` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
