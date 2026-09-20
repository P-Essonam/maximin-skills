---
name: workos-workspace-setup
description: Add WorkOS organization-backed workspace onboarding, switching, and Convex workspace guards to an existing TanStack Start monorepo using Coss UI. Use after workos-auth-setup when users need workspace creation or switching.
---

# WorkOS Workspace Setup

Follow this skill strictly.

Use WorkOS Organizations as application workspaces. WorkOS remains the source of truth for organizations and memberships; Convex scopes application data with the active `org_id` claim.

## Verify the project

Require `$project-setup`, `$convex-setup`, `$coss-ui-setup`, and `$workos-auth-setup`. If one is missing, stop and ask the user to run it first.

Find the TanStack Start frontend under `apps/*` and read its package name from that workspace's `package.json`. Use the detected package name in every pnpm filter and path below.

## Install the WorkOS server SDK

Install the SDK in the detected frontend workspace:

```powershell
pnpm --filter <frontend-package-name> add @workos-inc/node
```

## Install form dependencies

Install the form libraries in the detected frontend workspace:

```powershell
pnpm --filter <frontend-package-name> add @hookform/resolvers react-hook-form zod
```

## Keep WorkOS credentials server-only

Create or update `apps/<frontend-app>/src/server/apis.ts`:

```ts
import { createServerOnlyFn } from "@tanstack/react-start"

export const workosApiKey = createServerOnlyFn(
  () => process.env.WORKOS_API_KEY,
)
```

Read the API key only through `workosApiKey()` from server functions. Do not read `process.env.WORKOS_API_KEY` in route components, hooks, or other client-importable files. Preserve existing accessors in `apis.ts`.

## Add organization server functions

Create `apps/<frontend-app>/src/server/organizations.ts`.

Use the existing `authMiddleware`, `workspaceMiddleware`, `zod`, `@workos-inc/node`, and `switchToOrganization` imports. Construct the WorkOS client with `workosApiKey()`.

Implement only these functions:

- `createWorkspace`: require the signed-in user, validate the workspace name, create a WorkOS organization, add the user as an `admin` member, and return `organizationId`;
- `listWorkspaces`: list the signed-in user's WorkOS organization memberships;
- `switchWorkspace`: validate the target ID and call `switchToOrganization`;
- `getWorkspace`: read the active organization through `workspaceMiddleware`.

Do not accept a client-supplied organization ID as proof of access. WorkOS membership and the active session determine access.

## Add workspace middleware

Extend the existing frontend `src/server/middlewares.ts` with `workspaceMiddleware`.

It must:

- require an authenticated user;
- use the existing sign-in redirect when no user exists;
- redirect to `/new-workspace` when `organizationId` is missing;
- expose `user`, `organizationId`, `role`, and `permissions` in the server-function context.

## Add the onboarding route

Create `apps/<frontend-app>/src/routes/_auth/new-workspace/index.tsx` with route ID `/_auth/new-workspace/`.

Keep onboarding inside the pathless `_auth` route group, alongside the callback route. Use `useAuth({ ensureSignedIn: true })` in the route component, following the Clics pattern. Do not put this route under `_authenticated`: users without an active organization must be able to reach it after the authenticated layout redirects them from a protected route.

Do not import or render `WorkspaceGuard` in the onboarding route or its form component; users without a workspace must be able to create one. The guard is applied by the authenticated layout below, not by this route.

Match the Clics onboarding layout positioning without copying its product-specific content. The route component must use:

- an outer `grid min-h-dvh grid-rows-[auto_1fr] overflow-hidden p-6` container;
- a header with `flex items-start justify-between gap-4`;
- the brand or app link on the left;
- a right-aligned `flex flex-col items-end gap-3` block containing the signed-in user text and the sign-out action;
- a main area with `flex flex-col items-center justify-center` so the workspace form stays centered in the remaining viewport;
- a form container with `flex w-full max-w-sm flex-col gap-6`.

Keep the header positioning and spacing consistent at mobile and desktop widths. Do not use absolute positioning for these layout items.

Create `apps/<frontend-app>/src/features/auth/lib/workspace-schema.ts` with the Zod schema and inferred form type:

```ts
import { z } from "zod"

export const workspaceSchema = z.object({
  workspaceName: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters"),
})

export type WorkspaceFormData = z.infer<typeof workspaceSchema>
```

Build the form with React Hook Form and Coss components, following the Clics pattern:

- import `Controller` and `useForm` from `react-hook-form`;
- pass `zodResolver(workspaceSchema)` to `useForm<WorkspaceFormData>`;
- set `defaultValues` for every field and use `mode: "onSubmit"`;
- render controlled fields with Coss `Field`, `FieldLabel`, `Input`, and `FieldError` components;
- submit with `form.handleSubmit`, disable fields while `form.formState.isSubmitting`, and show the submit loading state;
- trim the workspace name before sending it to the server function;
- keep Clics-specific project creation, domain fields, tracking, and multi-step screens out of this route.

Its submit flow is:

```text
createWorkspace
→ switchWorkspace
→ window.location.assign("/dashboard")
```

The full navigation reloads AuthKit and Convex with the new organization's session claims.

## Add the workspace guard

Create `apps/<frontend-app>/src/features/auth/components/workspace-guard.tsx`.

The guard must call `useAuth({ ensureSignedIn: true })`, read `organizationId`, and render:

```tsx
<Navigate to="/new-workspace" replace />
```

when no organization is active. Otherwise render its children.

Keep the existing auth guard in `src/routes/_authenticated/route.tsx`. Import `WorkspaceGuard` there and wrap the authenticated outlet directly inside `<Authenticated>`:

```tsx
<Authenticated>
  <WorkspaceGuard>
    <Outlet />
  </WorkspaceGuard>
</Authenticated>
```

This makes the authenticated layout redirect signed-in users without an active organization to `/new-workspace`, while the `_auth/new-workspace` route remains reachable because it is outside `_authenticated`. In `apps/<frontend-app>/src/routes/_authenticated/dashboard/index.tsx`, render the dashboard content normally and place `WorkspaceSwitcher` in the dashboard header.

Do not put `WorkspaceGuard` around the `_auth/new-workspace` route, add a `_workspace` route group, or add a second dashboard-only guard. The authenticated layout is the single place this skill renders `WorkspaceGuard`, nested under `<Authenticated>` and directly around `<Outlet />`.

## Add the workspace switcher

Create `apps/<frontend-app>/src/components/workspace-switcher.tsx` following the Clics implementation:

- use `useAuth({ ensureSignedIn: true })`;
- load memberships through `listWorkspaces` with `useInfiniteQuery`;
- use Coss `Popover`, `PopoverTrigger`, `PopoverContent`, and `Button`;
- call `switchWorkspace` when a workspace is selected;
- call `window.location.reload()` after switching.

## Add reusable Convex authorization

Extend or create `packages/backend/convex/utils.ts` with `requireOrganization(ctx)`.

The helper must call `ctx.auth.getUserIdentity()`, reject a missing identity, read `identity.org_id`, reject a missing organization, and return the identity with `organizationId`.

Use this helper in every organization-scoped Convex query and mutation. Never use a client-provided organization ID to authorize access. Do not create an organizations or memberships table unless the application needs additional organization metadata.

## Validate

Regenerate the TanStack route tree and confirm that:

- signed-in users without an organization are redirected from protected routes to `/new-workspace` by the authenticated layout;
- onboarding creates a WorkOS organization and admin membership;
- switching refreshes the session before `/dashboard` loads;
- the authenticated layout renders `WorkspaceGuard` under `<Authenticated>` around `<Outlet />`, and the dashboard renders `WorkspaceSwitcher`;
- the workspace switcher lists and switches memberships;
- Convex rejects calls without `org_id`;
- organization-scoped data uses `requireOrganization(ctx)`;
- frontend lint, typecheck, and build plus backend typecheck pass.

Report changed files and commands without exposing environment values.
