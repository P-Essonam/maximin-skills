# Maximin Skills

Private collection of reusable coding workflow skills.

## Available skills

- `project-setup`: creates, validates, and privately publishes a shadcn TanStack Start monorepo with the agreed ESLint architecture boundaries.

## Install on Windows

Clone this private repository with an authenticated GitHub account, then copy the skill into Codex:

```powershell
gh repo clone P-Essonam/maximin-skills
Copy-Item -Recurse .\maximin-skills\skills\project-setup "$env:USERPROFILE\.codex\skills\project-setup"
```

Restart Codex after installing or updating a skill.
