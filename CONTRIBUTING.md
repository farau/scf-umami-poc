# Contributing to the SCF analytics POC

This repository contains a proof of concept built on Umami. Use this guide for changes to the SCF demo; follow the [upstream guide](https://github.com/umami-software/umami/blob/master/CONTRIBUTING.md) for contributions intended for Umami itself.

## Local setup

Use Node.js 22.23.4 and pnpm 12.3.4. Follow the [README](README.md#run-locally-without-a-database) to install dependencies, generate the Prisma client and start the demo. No database is needed for `/scf`.

Create a focused branch from this repository's `master` branch and open a pull request against `master`. Do not push changes to the upstream `umami-software/umami` repository.

## Checks

The following placeholder is for build-time client generation. It is not a live database connection or a credential for an existing service.

```sh
export DATABASE_URL=postgresql://demo:demo@127.0.0.1:5432/scf_demo
export DISABLE_TELEMETRY=1
pnpm run build:db
pnpm run build:packages
pnpm exec tsc --noEmit
pnpm exec biome check src/app/scf src/lib/scf scripts/seed-scf-demo.ts scripts/dev-scf.mjs scripts/start-scf.mjs src/app/api/scf src/app/page.tsx src/app/UmamiRootPage.tsx src/app/Providers.tsx src/app/layout.tsx
pnpm exec vitest run src/lib/scf/demo.test.ts
pnpm run build:tracker:script
pnpm run build:app
```

The dedicated `SCF POC CI` workflow runs these checks on pushes and pull requests. The upstream CI/release workflows remain in the fork for provenance; their upstream-specific jobs do not release this POC.

For UI changes, check desktop and mobile layouts, keyboard focus, chart readability and the enrollment dialog in dark mode. Reuse the existing Umami components where practical.

## Scope and documentation

- Keep fixtures synthetic and identify them as such in the interface.
- Preserve the `tenant.id` / Umami team mapping and the consistency of aggregate totals.
- Do not present the perspective selector as real authentication or HA as already implemented.
- Keep database schema changes and infrastructure additions separate from this lightweight demo.
- Update `CHANGELOG.md` and the relevant docs when behavior or configuration changes.
- Never commit `.env` files, seed passwords, tokens or real tenant telemetry.

The native seed is for a dedicated POC PostgreSQL database only. See the [technical guide](docs/SCF-POC.md) for its required flags and account behavior.

## Reporting issues

Include the affected screen or command, reproduction steps, expected behavior, Node/pnpm versions and relevant error messages. Use synthetic examples and redact credentials and personal data.

## License

The upstream Umami copyright and [MIT license](LICENSE) are retained. Contributions to this fork use the same license.
