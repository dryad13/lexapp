# Security scanners (G10)

## OWASP ZAP baseline

Prereqs: Docker, API listening on `http://127.0.0.1:8080` (or set `ZAP_TARGET`).

```bash
cd LexAssist-3
# start API + SPA as usual, then:
pnpm test:security:zap
# or:
bash scripts/zap-baseline.sh
```

This runs the ZAP baseline scan in Docker and fails on **High** alerts. Not merge-blocking until a baseline is established (see QA matrix G10 — weekly/manual).

## Mutation testing (G11)

Scaffold: [`stryker.config.json`](../../stryker.config.json)

```bash
# install once:
npx pnpm@10 add -Dw @stryker-mutator/core @stryker-mutator/typescript-checker @stryker-mutator/vitest-runner
pnpm test:mutate
```

Target files: `sessions.ts`, `stripe-billing.ts`. Pass criterion: mutation score ≥ 60%. Monthly / manual until baseline exists.
