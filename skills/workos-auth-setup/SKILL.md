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

Do not require or prompt the user to configure a WorkOS Initiate Login URI. It is optional for this skill's core setup and must not block completion.

Configure the same WorkOS credentials in Convex. From the backend package directory, set both Convex environment variables:

```bash
npx convex env set WORKOS_CLIENT_ID $YOUR_CLIENT_ID_HERE
npx convex env set WORKOS_API_KEY $YOUR_API_KEY_HERE
```

Replace both placeholders with the values from the WorkOS dashboard. Confirm that both variable names are configured without printing their values.

Update the existing `packages/backend/convex/convex.config.ts` to declare both required variables:

```ts
import { defineApp } from "convex/server"
import { v } from "convex/values"

const app = defineApp({
  env: {
    WORKOS_CLIENT_ID: v.string(),
    WORKOS_API_KEY: v.string(),
  },
})

export default app
```

## Configure Convex token validation

Create `packages/backend/convex/auth.config.ts`. This server-side configuration uses the WorkOS Client ID to validate access tokens:

```ts
const clientId = process.env.WORKOS_CLIENT_ID

const authConfig = {
  providers: [
    {
      type: "customJwt",
      issuer: "https://api.workos.com/",
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt",
      issuer: `https://api.workos.com/user_management/${clientId}`,
      algorithm: "RS256",
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
}

export default authConfig
```

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
      refetchOnWindowFocus: "always",
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

The `_auth` group is pathless, so the public callback remains `/callback` and must match `WORKOS_REDIRECT_URI`. Callback errors return to `/`, where the public page can restart authentication.

## Organize public and authenticated routes

Move `src/routes/index.tsx` to `src/routes/_public/index.tsx` and change its declaration to:

```tsx
export const Route = createFileRoute("/_public/")({
```

Place marketing pages and all other public routes under `_public`.

Update the existing public index component to show a sign-in button while signed out, then Dashboard and Log out buttons while signed in. Preserve the rest of the page:

```tsx
import { Link } from "@tanstack/react-router"
import { useAuth } from "@workos/authkit-tanstack-react-start/client"
import { Button } from "@workspace/ui/components/button"

function HomePage() {
  const { user, signIn, signOut } = useAuth()

  return (
    <div className="flex gap-2">
      {user ? (
        <>
          <Button render={<Link to="/dashboard" />}>Dashboard</Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Log out
          </Button>
        </>
      ) : (
        <Button onClick={() => void signIn()}>Sign in</Button>
      )}
    </div>
  )
}
```

Adapt the component name and surrounding markup to the generated page instead of replacing its content.

Create `src/routes/_authenticated/route.tsx` and place every private application route under `_authenticated`. Keep this file at the root of the route group: it is the pathless authenticated layout and does not create an `/app` URL segment.

```tsx
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start"
import { Button } from "@workspace/ui/components/button"
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react"
import { Loader } from "lucide-react"

export const Route = createFileRoute("/_authenticated")({
  component: RouteComponent,
  loader: async ({ location }) => {
    const { user } = await getAuth()

    if (!user) {
      const signInUrl = await getSignInUrl({
        data: { returnPathname: location.pathname },
      })

      throw redirect({ href: signInUrl })
    }

    return { user }
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

Do not create `src/routes/_authenticated/index.tsx`: it would resolve to `/` and conflict with the public index route.

Create the first private page at `src/routes/_authenticated/dashboard/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
})

function DashboardPage() {
  return <h1>Dashboard</h1>
}
```

This gives the authenticated layout a concrete `/dashboard` child while `src/routes/_public/index.tsx` remains the only route for `/`.

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
- Convex validates `WORKOS_CLIENT_ID` and `WORKOS_API_KEY` through `convex.config.ts`;
- Convex loads both WorkOS JWT providers from `convex/auth.config.ts`;
- `/callback` matches `WORKOS_REDIRECT_URI`;
- `/` resolves to `src/routes/_public/index.tsx` without a duplicate-route error;
- the public index shows the correct authentication buttons;
- `/dashboard` resolves beneath the authenticated layout and redirects signed-out users to WorkOS;
- authenticated Convex SSR receives the access token;
- `authMiddleware` exposes `context.user`;
- custom error and not-found components render; and
- frontend lint, typecheck, and build plus backend typecheck pass.

Report commands and files changed without exposing environment values.
