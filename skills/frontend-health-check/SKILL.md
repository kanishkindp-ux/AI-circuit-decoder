---
name: frontend-health-check
description: >-
  Runs ESLint and a dry-run Vite production build against the React frontend
  to catch lint violations and build errors early.
  Use this skill when the user asks to check frontend health, lint the React
  code, verify the frontend builds, or diagnose React compilation errors.
---

# Frontend Health Check

Lint the React codebase and perform a dry-run production build to surface
errors before deployment.

## Prerequisites

- Node.js 18+ and npm available on `PATH`.
- Dependencies installed (`cd frontend && npm install`).

## Usage

Run the check script
[check_frontend.ps1](./scripts/check_frontend.ps1) from the **repository root**:

```powershell
# Full check (lint + build)
powershell -ExecutionPolicy Bypass -File skills/frontend-health-check/scripts/check_frontend.ps1

# Lint only
powershell -ExecutionPolicy Bypass -File skills/frontend-health-check/scripts/check_frontend.ps1 -LintOnly

# Build only
powershell -ExecutionPolicy Bypass -File skills/frontend-health-check/scripts/check_frontend.ps1 -BuildOnly
```

### Arguments Reference

| Argument     | Type   | Default | Description                                    |
| ------------ | ------ | ------- | ---------------------------------------------- |
| `-LintOnly`  | switch | off     | Skip the build step, run only ESLint.          |
| `-BuildOnly` | switch | off     | Skip lint, run only the Vite production build. |

*(If neither flag is set, both lint and build run.)*

## What the Script Does

1. `cd frontend`
2. **Lint**: `npm run lint` — runs ESLint with the project config.
3. **Build**: `npm run build` — runs `vite build` to compile the production
   bundle. This catches JSX errors, missing imports, and TypeScript issues.
4. Reports a clear pass/fail summary for each step.

## Cross-Platform Note

On macOS/Linux, use the bash equivalent:

```bash
bash skills/frontend-health-check/scripts/check_frontend.sh
bash skills/frontend-health-check/scripts/check_frontend.sh --lint-only
bash skills/frontend-health-check/scripts/check_frontend.sh --build-only
```

## Interpreting Results

| Step  | Exit Code | Meaning                                                  |
| ----- | --------- | -------------------------------------------------------- |
| Lint  | 0         | No ESLint errors or warnings.                            |
| Lint  | 1         | Lint violations found — review the detailed output.      |
| Build | 0         | Production bundle compiled successfully.                 |
| Build | 1         | Build failed — typically missing imports or JSX errors.  |
