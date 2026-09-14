# Maximin Skills

Public collection of reusable coding workflow skills.

## Available skills

- `project-setup`: creates, validates, and privately publishes a shadcn TanStack Start monorepo with the agreed ESLint architecture boundaries.

## Install with skills.sh

Install `project-setup` globally for OpenCode, Claude Code, and Antigravity:

```powershell
npx skills add https://github.com/P-Essonam/maximin-skills --skill project-setup --global --agent opencode claude-code antigravity
```

The command intentionally omits `--copy`, so skills.sh links the installed skill into each agent's skill directory.

Update installed global skills with:

```powershell
npx skills update --global
```
