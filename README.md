# Stellar SCF Analytics POC

A dark-mode web and API analytics demo for Stellar ecosystem projects, built on [Umami](https://github.com/umami-software/umami) 3.5.0.

**[Open the live demo](https://scf-umami-poc-production.up.railway.app/scf)** · [Technical guide](docs/SCF-POC.md) · [Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md)

![SCF analytics dashboard in dark mode](docs/images/scf-dashboard.png)

This proof of concept explores the [SCF Web and API Analytics RFP](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/rfp-track#web-and-api-analytics-for-stellar-ecosystem-projects). It demonstrates the dashboard experience and data contracts using fictional projects and synthetic traffic. It does not collect real analytics.

## What you can try

- **SCF overview:** ecosystem totals, project search, sorting and side-by-side comparison.
- **SCF administration:** project oversight with standardized web/API metrics, project search/sorting, traffic distribution and per-project data actions.
- **Data & privacy:** erase web, API or both streams for the selected period or all available history; delete a project and its data with exact-name confirmation and a session activity log.
- **Tenant perspective:** switch to one project to preview its web and API dashboards.
- **Web analytics:** visitors, page views, bounce rate, visit duration, referrers, countries, browsers and devices, using Umami's native chart component.
- **API analytics:** request volumes, HTTP status distribution, normalized routes and histogram-based p50/p95 estimates.
- **Time ranges:** consistent datasets for the last 7, 30 or 90 days.
- **Free enrollment:** add a project for €0 and preview its integration identifiers. New projects start with zero activity. Additions reset on refresh.
- **Exports:** download the selected scope and time range as synthetic JSON data.
- **Dark mode:** all demo screens, forms, charts and modal dialogs, including on mobile.

`tenant.id` maps to an existing **Umami `Team.id`**. A team's web properties use `Website.teamId`; API fixtures carry the same tenant attribution. No new database model is required for the POC.

## Run locally without a database

Prerequisites: Node.js **22.23.4** and pnpm **12.3.4** (the versions used by the POC container).

```sh
git clone https://github.com/farau/scf-umami-poc.git
cd scf-umami-poc
pnpm install --frozen-lockfile
DATABASE_URL=postgresql://demo:demo@127.0.0.1:5432/scf_demo pnpm run generate:db:client
pnpm run dev:scf
```

Open **http://localhost:3000/scf**. The placeholder URL above is used to generate the Prisma client; no PostgreSQL server is required. The launch script enables demo mode, disables Umami telemetry and generates an ephemeral application secret when none is configured.

The demo is public and requires no login. Its perspective selector is an experience preview, **not an authorization boundary**. When `SCF_DEMO_MODE` is disabled, the application uses the original Umami entry flow.

## Deploy the demo

Use **`Dockerfile.poc`**, which builds the application and starts `/scf` without running migrations or requiring a database.

```sh
docker build -f Dockerfile.poc -t scf-umami-poc .
docker run --rm -p 3000:3000 scf-umami-poc
```

For Railway, configure the service with:

| Setting | Value |
| --- | --- |
| Dockerfile | `Dockerfile.poc` |
| Dockerfile environment override | `RAILWAY_DOCKERFILE_PATH=Dockerfile.poc` |
| Demo mode | `SCF_DEMO_MODE=true` |
| Umami telemetry | `DISABLE_TELEMETRY=1` |
| Healthcheck | `/api/scf/health` |
| Healthcheck timeout | 120 seconds |
| Replicas | 1 |
| Public domain target port | Match the injected `PORT` (8080 on the live deployment) |

The container listens on `0.0.0.0` and respects Railway's `PORT`. Do not choose the upstream `Dockerfile` for this database-free demo: its startup checks require PostgreSQL.

The live service was deployed from the local checkout using `railway up`. **Publishing this repository does not configure GitHub autodeploys.** See the [technical guide](docs/SCF-POC.md#railway) for deployment details.

## Optional: native Umami dashboard

To demonstrate the original Umami screens with generated web events, use one dedicated PostgreSQL database, run Umami's migrations, and execute `pnpm run seed:scf` with `SCF_DEMO_MODE=true` and an explicit `SCF_SEED_PASSWORD` of at least 12 characters.

The repeatable seed creates three teams, three websites, tenant accounts, an SCF operator and 90 days of synthetic web traffic. It preserves existing accounts and skips duplicate sessions/events. Set `SCF_NATIVE_ENABLED=true` to show native dashboard links in the integration screen.

Follow the [complete setup and account instructions](docs/SCF-POC.md#dashboard-umami-natif-avec-un-postgresql-simple-facultatif), including changing Umami's initial default administrator password before exposing native login.

## SCF administration and data erasure

Open **SCF administration** in the global perspective to compare projects and review their visitors, views, bounce rate, session duration, API volume, server error rate and p50/p95 latency. Each project has shortcuts to its dashboard and data controls.

In **Data & privacy**, choose a project (administrators) or use the current project (tenant perspective), then:

1. Choose analytics erasure or project deletion.
2. For analytics, choose web/API/both and the current dashboard period or all available history.
3. Review affected visitor, pageview and request counts, and provide a reason.
4. Review the confirmation dialog and type the exact project name to apply the action.

Erasure updates the charts, breakdowns, comparisons, admin totals and subsequent JSON exports. Analytics erasure keeps enrollment and integration IDs. Project deletion also removes enrollment. A session activity log records the actor perspective, project, reason, period and affected counts; its export is filtered to the current tenant perspective.

**These controls operate on synthetic browser-session data only.** Refreshing restores the original dataset. They never call Umami's native deletion APIs, touch PostgreSQL records, revoke production credentials or purge backups. They are a UX demonstration of the intended erasure workflow, not a production right-to-erasure service. The perspective restrictions are client-side demo guards, not authenticated access control.

![SCF operator administration dashboard](docs/images/scf-admin.png)

## Scope and limitations

| Included in this POC | Production work still required |
| --- | --- |
| Synthetic web/API dashboards, SCF administration and tenant perspectives | Persistent enrollment and SCF-specific authorization |
| `tenant.id` mapped to Umami teams | Strict database isolation / row-level security |
| €0 tenant enrollment UX | Actual self-service onboarding and ecosystem verification |
| API fixtures and route normalization | Authenticated OpenTelemetry ingestion and metrics storage |
| Session-only erasure, project removal and activity log | Durable audit trail and authenticated deletion from live systems |
| Single-instance Railway deployment | High availability, failover, monitoring and SLA validation |
| Indicative Umami integration snippet | Immutable versioned tracker, SRI and collection hardening |

**High availability is planned for production and is not implemented in this demo.** No SLA, GDPR certification or production isolation is claimed. Tenant fees are €0; infrastructure still has operating costs. There is no AWS/EC2 dependency in this POC.

## Development checks

```sh
pnpm run build:db
pnpm run build:packages
pnpm exec tsc --noEmit
pnpm exec vitest run src/lib/scf/demo.test.ts
pnpm exec biome check src/app/scf src/lib/scf scripts/seed-scf-demo.ts scripts/dev-scf.mjs scripts/start-scf.mjs src/app/api/scf src/app/page.tsx src/app/UmamiRootPage.tsx src/app/Providers.tsx src/app/layout.tsx
```

`build:db` needs `DATABASE_URL` to be set, but it generates clients without connecting. See [CONTRIBUTING.md](CONTRIBUTING.md) for a database-free check environment and the dedicated POC CI workflow.

The POC has been checked with TypeScript, Biome, 15 analytics and data-management tests, production builds, desktop/mobile browser flows and a temporary PostgreSQL instance for native Umami access checks. The public Railway deployment and its healthcheck were also verified.

## Documentation and attribution

- [Technical guide and demo walkthrough](docs/SCF-POC.md) (French)
- [Architecture and data boundaries](docs/ARCHITECTURE.md)
- [Changelog](CHANGELOG.md)
- [Contribution guide](CONTRIBUTING.md)
- [Original Umami README](docs/UPSTREAM-README.md)
- [Upstream Umami documentation](https://umami.is/docs/)

Based on Umami Software, Inc.'s open-source application. The upstream copyright and **[MIT license](LICENSE)** are preserved. This is a proof of concept responding to an SCF RFP; it is not an official Stellar or SCF service.
