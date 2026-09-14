---
name: workos-auth-setup
description: Add WorkOS AuthKit authentication to an existing TanStack Start monorepo configured with Convex and Coss UI. Use for the initial authentication wiring, route protection, callback, and server-function auth middleware, not for organizations, billing, or application features.
---

# WorkOS Auth Setup

Reference: [Convex AuthKit add-to-app guide](https://docs.convex.dev/auth/authkit/add-to-app).

## Verify the project

Confirm that `$project-setup`, `$convex-setup`, and `$coss-ui-setup` are complete. If one is missing, stop and ask the user to run it first.

Find the TanStack Start frontend under `apps/*` and read its actual package name from `package.json`. Use that name in pnpm filters.

Do not create or update `packages/backend/convex.json` in this skill.

## Install AuthKit

```powershell
pnpm --filter <frontend-package-name> add @workos/authkit-tanstack-react-start
```

## Configure environment variables

Help the user create a WorkOS account if needed and obtain the Client ID and API key. Configure the frontend application's `.env.local`:

```env
WORKOS_CLIENT_ID=client_your_client_id
WORKOS_API_KEY=sk_test_your_api_key
WORKOS_COOKIE_PASSWORD=your_secure_password_at_least_32_characters
WORKOS_REDIRECT_URI=http://localhost:3000/callback
VITE_CONVEX_URL=https://your-convex-url.convex.cloud
```

Use the detected frontend port instead of `3000` when it differs. Configure the same callback URL in WorkOS. Keep `WORKOS_API_KEY` server-only, require at least 32 characters for `WORKOS_COOKIE_PASSWORD`, never commit `.env.local`, and never print environment values.

## Configure request middleware

Update the existing frontend `src/start.ts`, preserving other middleware:

```ts
import { createStart, createCsrfMiddleware } from "@tanstack/react-start"
import { authkitMiddleware } from "@workos/authkit-tanstack-react-start"

// Reject cross-site requests to server-function RPC endpoints.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, authkitMiddleware()],
}))
```

Keep `csrfMiddleware` before `authkitMiddleware()`.

## Connect AuthKit to Convex

Update the existing frontend `src/router.tsx`. Preserve its route tree, React Query setup, Coss providers, and unrelated router options.

Add these imports:

```tsx
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react"
import {
  AuthKitProvider,
  useAccessToken,
  useAuth,
} from "@workos/authkit-tanstack-react-start/client"
import { useCallback, useMemo } from "react"
import { RouteError } from "./components/route-error"
import { RouteNotFound } from "./components/route-not-found"
```

Create the clients and pass them through the router context:

```tsx
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
const convexQueryClient = new ConvexQueryClient(convex)

const queryClient = new QueryClient({
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
  scrollRestoration: true,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteNotFound,
  context: { queryClient, convexClient: convex, convexQueryClient },
  Wrap: ({ children }) => (
    <AuthKitProvider>
      <ConvexProviderWithAuth
        client={convexQueryClient.convexClient}
        useAuth={useAuthFromAuthKit}
      >
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  ),
})

setupRouterSsrQueryIntegration({ router, queryClient })
```

Add the authentication bridge:

```tsx
function useAuthFromAuthKit() {
  const { loading, user } = useAuth()
  const { getAccessToken, refresh } = useAccessToken()

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null

      if (forceRefreshToken) {
        return (await refresh()) ?? null
      }

      return (await getAccessToken()) ?? null
    },
    [user, refresh, getAccessToken],
  )

  return useMemo(
    () => ({
      isLoading: loading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [loading, user, fetchAccessToken],
  )
}
```

## Add custom route states

Create `src/components/route-error.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { AlertTriangle } from "lucide-react"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { cn } from "@workspace/ui/lib/utils"
import type { ErrorComponentProps } from "@tanstack/react-router"

export function RouteError(_props: ErrorComponentProps) {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><AlertTriangle /></EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>Return to the home page to continue.</EmptyDescription>
        </EmptyHeader>
        <Link to="/" className={cn(buttonVariants({ size: "lg" }))}>
          Go home
        </Link>
      </Empty>
    </div>
  )
}
```

Create `src/components/route-not-found.tsx` with the same Coss structure, `SearchX`, the title `Page not found`, and a TanStack `<Link to="/">`. Do not use a raw anchor.

## Add SSR authentication

In `src/routes/__root.tsx`, add these imports and context fields:

```tsx
import { createServerFn } from "@tanstack/react-start"
import { getAuth } from "@workos/authkit-tanstack-react-start"
import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { ConvexReactClient } from "convex/react"
```

```tsx
const fetchWorkosAuth = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuth()

  return {
    userId: auth.user?.id ?? null,
    token: auth.user ? auth.accessToken : null,
  }
})
```

```tsx
export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  // Preserve the existing route configuration.
  beforeLoad: async (ctx) => {
    const { userId, token } = await fetchWorkosAuth()

    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return { userId, token }
  },
})
```

Do not call `getAuth()` directly from `beforeLoad`; use the server function. Preserve the existing root document and Coss layout.

## Add the callback route

Create `src/routes/_auth/callback/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start"

export const Route = createFileRoute("/_auth/callback/")({
  server: {
    handlers: {
      GET: handleCallbackRoute({ errorRedirectUrl: "/" }),
    },
  },
})
```

The `_auth` group is pathless, so the public callback remains `/callback` and must match `WORKOS_REDIRECT_URI`.

Do not create sign-in or sign-up route files.

## Organize public and authenticated routes

Move `src/routes/index.tsx` to `src/routes/_public/index.tsx` and change its declaration to:

```tsx
export const Route = createFileRoute("/_public/")({
```

Place marketing pages and all other public routes under `_public`.

Create `src/routes/_authenticated/route.tsx` and place every private application route under `_authenticated`:

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start"
import { Button } from "@workspace/ui/components/button"
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react"
import { Loader } from "lucide-react"

export const Route = createFileRoute("/_authenticated")({
  component: RouteComponent,
  loader: async () => {
    const { user } = await getAuth()
    const signInUrl = await getSignInUrl()

    if (!user) {
      throw redirect({ href: signInUrl })
    }
  },
})

function RouteComponent() {
  return (
    <>
      <Authenticated>
        <Outlet />
      </Authenticated>
      <Unauthenticated>
        <div className="flex size-full min-h-screen items-center justify-center">
          <Button type="button" size="lg" onClick={() => window.location.reload()}>
            Sign in
          </Button>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex size-full min-h-screen items-center justify-center">
          <Loader className="size-3.5 animate-spin" />
        </div>
      </AuthLoading>
    </>
  )
}
```

## Add server-function auth middleware

Create `src/server/middlewares.ts`:

```ts
import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start"

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { user } = await getAuth()

    if (!user) {
      const signInUrl = await getSignInUrl()
      throw redirect({ href: signInUrl })
    }

    return next({ context: { user } })
  },
)
```

Use it on protected TanStack server functions with `.middleware([authMiddleware])`. Keep it separate from the request middleware in `src/start.ts`.

## Validate

Regenerate the TanStack route tree, then confirm that:

- AuthKit and CSRF request middleware are active;
- `/callback` matches `WORKOS_REDIRECT_URI`;
- public routes load while signed out;
- private routes redirect signed-out users to WorkOS;
- authenticated Convex SSR receives the access token;
- `authMiddleware` exposes `context.user`;
- custom error and not-found components render; and
- frontend lint, typecheck, and build plus backend typecheck pass.

Report commands and files changed without exposing environment values.
