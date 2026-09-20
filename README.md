# Maximin Skills

Public collection of reusable coding workflow skills.

## Available skills

- `project-setup`: creates, validates, and privately publishes a shadcn TanStack Start monorepo with the agreed ESLint architecture boundaries.
- `convex-setup`: creates a Convex backend package and connects it to the TanStack Start frontend.
- `coss-ui-setup`: installs and configures Coss UI for the generated TanStack Start monorepo.
- `workos-auth-setup`: connects WorkOS AuthKit to Convex and protects TanStack Start application routes.
- `workos-workspace-setup`: adds WorkOS workspace onboarding, switching, and Convex workspace protection.

## Install with skills.sh

Install `project-setup` globally for OpenCode, Claude Code, and Antigravity:

```powershell
npx skills add https://github.com/P-Essonam/maximin-skills --skill project-setup --global --agent opencode claude-code antigravity
```

Install `convex-setup` globally for the same agents:

```powershell
npx skills add https://github.com/P-Essonam/maximin-skills --skill convex-setup --global --agent opencode claude-code antigravity
```

Install `coss-ui-setup` globally for the same agents:

```powershell
npx skills add https://github.com/P-Essonam/maximin-skills --skill coss-ui-setup --global --agent opencode claude-code antigravity
```

Install `workos-auth-setup` globally for the same agents:

```powershell
npx skills add https://github.com/P-Essonam/maximin-skills --skill workos-auth-setup --global --agent opencode claude-code antigravity
```

Install `workos-workspace-setup` globally for the same agents:

```powershell
npx skills add https://github.com/P-Essonam/maximin-skills --skill workos-workspace-setup --global --agent opencode claude-code antigravity
```

The command intentionally omits `--copy`, so skills.sh links the installed skill into each agent's skill directory.

Update installed global skills with:

```powershell
npx skills update --global
```
