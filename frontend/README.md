# PayFlow frontend

The frontend is a React 19 and TypeScript SPA using TanStack Router for file-based
browser routing, Tailwind CSS and shadcn/ui for styling, and Vite+ for development,
formatting (Oxfmt), linting (Oxlint), TypeScript checks, tests (Vitest), and builds.
The current scaffold contains a landing page and theme support.

Spring Boot provides the REST API and owns authentication, authorization,
validation, balances, transactions, and persistence. Wallet workflows, a shared
API client, and refresh-session integration are still planned. The
[PRD](../docs/PRD.md) specifies TanStack Query for remote state, TanStack Form and
Zod for forms, and Axios for HTTP transport; these are not installed yet.

## Local development

Use Node.js 24 and Vite+ (`vp`). The project pins pnpm 12.8.1 in `package.json` and
toolchain versions in `pnpm-workspace.yaml` and `pnpm-lock.yaml`.

Run all frontend commands from `frontend/`:

```bash
vp install --frozen-lockfile
vp run dev
```

Open <http://localhost:3000>. Backend setup is documented in the
[root README](../README.md). The scaffold currently has no API proxy configured.
The planned development proxy forwards `/api` to <http://localhost:8080>, retaining
the complete path; the planned client API base URL is `/api/v1`.

## Route generation

Routes live in `src/routes/`; `__root.tsx` renders the shared layout with `Outlet`.
TanStack Router generates `src/routeTree.gen.ts` during development and builds.
Generate it explicitly before standalone checks:

```bash
vp run generate-routes
```

Do not hand-edit the generated tree. `tsr.config.json` is shared by the router CLI
and Vite plugin and configures single quotes and no semicolons. The generated tree
is excluded from formatting and linting in `vite.config.ts`, so regeneration does
not conflict with source formatting. The router plugin runs before the React
plugin and enables automatic route code splitting.

## Checks, tests, and builds

Run the same sequence as frontend CI:

```bash
vp install --frozen-lockfile
vp run generate-routes
vp check
vp test run
vp build
```

`vp check` is the built-in formatting, lint, and TypeScript check. `vp run check`
invokes the package script, which only checks formatting. Use `vp run format` to
apply formatting and lint fixes to source files.

There are no frontend tests yet. `test.passWithNoTests` in `vite.config.ts` allows
the empty scaffold suite to pass; actual test failures will still fail CI. Remove
this allowance when the frontend test suite is added.

## Static build and hosting

`vp build` writes static assets to `dist/`. Inspect the build locally with:

```bash
vp preview
```

Production hosting must serve `dist/`, provide SPA fallback to `index.html` for
application routes, and proxy `/api/*` to Spring Boot. API requests and missing
assets must not receive SPA HTML. The production static-server configuration and
deep-link/API browser checks are still planned. `vp preview` is for local
inspection; production uses a static web server.
