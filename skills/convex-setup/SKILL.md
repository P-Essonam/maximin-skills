---
name: convex-setup
description: Add a Convex backend package and connect it to the TanStack Start frontend in an existing project-setup monorepo. Use before authentication or application feature work, not to initialize a missing monorepo.
---

# Convex Setup

## Verify the project

Confirm the monorepo was created with `$project-setup`. If it was not, stop and ask the user to run that skill first.

Find the TanStack Start frontend under `apps/*` by inspecting package dependencies, then read its actual package name from `package.json`. The generated name is usually `web`, but never assume it. If multiple frontend applications match, ask the user which one to connect.

## Create the backend package

Create `packages/backend/package.json`:

```json
{
  "name": "@workspace/backend",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "convex dev",
    "setup": "convex dev --until-success",
    "typecheck": "tsc --noEmit -p convex"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^6"
  }
}
```

Install the latest Convex version so pnpm records the resolved version:

```powershell
pnpm --filter @workspace/backend add convex@latest
```

## Configure Convex once

Run this command once during initial setup:

```powershell
pnpm --filter @workspace/backend run setup
```

Help the user log in. If they do not have an account, guide them through creating one. Use the repository folder name as the default Convex project name and the default US region unless the user specifies different values.

Let Convex create `packages/backend/.env.local` and `packages/backend/convex`. After setup succeeds, do not run `setup` again.

## Declare Convex environment variables

Create `packages/backend/convex/convex.config.ts` with an empty environment declaration. Do not add variables until the backend actually requires them:

```ts
import { defineApp } from "convex/server"

const app = defineApp({
  env: {},
})

export default app
```

If the Convex process is no longer running, start it from `packages/backend` and keep it running during development:

```powershell
pnpm run dev
```

## Connect the frontend

Replace `<frontend-package-name>` below with the package name discovered earlier.

Add the backend workspace dependency:

```powershell
pnpm --filter <frontend-package-name> add "@workspace/backend@workspace:*"
```

Install the frontend libraries:

```powershell
pnpm --filter <frontend-package-name> add convex@latest @convex-dev/react-query @tanstack/react-query @tanstack/react-router-ssr-query
```

## Update the root route

In the frontend's `src/routes/__root.tsx`, add the query client type:

```tsx
import type { QueryClient } from "@tanstack/react-query"
```

Replace `createRootRoute` with `createRootRouteWithContext` and add the context type to the existing route:

```tsx
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // Keep the existing route configuration.
})
```

Preserve all existing metadata, stylesheet imports, components, body classes, and application wrapper.

## Update the router

Adapt the frontend's existing `src/router.tsx` to this Convex and React Query wiring. Preserve unrelated router options:

```tsx
import { createRouter } from "@tanstack/react-router"
import { QueryClient } from "@tanstack/react-query"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { ConvexQueryClient } from "@convex-dev/react-query"
import { ConvexProvider } from "convex/react"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
  if (!CONVEX_URL) {
    console.error("missing envar VITE_CONVEX_URL")
  }
  const convexQueryClient = new ConvexQueryClient(CONVEX_URL)

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    context: { queryClient },
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        {children}
      </ConvexProvider>
    ),
  })
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}
```

## Configure the frontend environment

Read `CONVEX_URL` from `packages/backend/.env.local` and write the same value as `VITE_CONVEX_URL` in the frontend application's `.env.local`. Do not print environment values and do not copy `CONVEX_DEPLOYMENT` into the frontend.

## Validate

Confirm that:

- the Convex development server is running;
- `packages/backend/convex/convex.config.ts` declares `env: {}`;
- `packages/backend/convex/_generated` exists;
- the frontend resolves `@workspace/backend`;
- the frontend has `VITE_CONVEX_URL`;
- the backend typecheck passes; and
- the frontend lint, typecheck, and build commands pass.

Report the commands run and files changed without exposing environment values.
