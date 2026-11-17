# Changelog

This file tracks changes made by the Stellar SCF analytics POC. Upstream Umami release history is available in the [Umami releases](https://github.com/umami-software/umami/releases).

## POC 0.1.0 — 2026-11-17

The first published POC is based on Umami 3.5.0. The upstream application version remains unchanged; `0.1.0` identifies this POC milestone only.

### Added

- Public `/scf` dashboard with synthetic projects and traffic, global operator and tenant perspectives.
- Web analytics using Umami's native chart, with visitor/pageview counts, bounce rate, duration and audience breakdowns.
- API metrics with normalized paths, HTTP status distributions, request counts and histogram-based latency estimates.
- Seven-, thirty- and ninety-day ranges, project search/sorting, side-by-side comparison and JSON export.
- Free simulated project enrollment and an integration walkthrough exposing `tenant.id`, `website.id` and `service.name`.
- Mapping of `tenant.id` to existing Umami teams, with no additional database schema.
- Optional repeatable seed for native Umami teams, tenant accounts, websites and 90 days of synthetic events.
- Dedicated `Dockerfile.poc`, local demo startup, runtime bootstrap and `/api/scf/health` endpoint.
- POC-focused README, architecture guide, contribution instructions, original Umami README, dashboard screenshot and dedicated CI checks.
- Fork-compatible CI and secret scanning on GitHub-hosted runners, with upstream release and stale-issue automation scoped to the upstream repository.

### Changed

- Enabled dark mode throughout the POC, including charts, native Umami UI, enrollment dialogs and mobile layouts.
- Redirected `/` to `/scf` only while `SCF_DEMO_MODE=true`; retained the original Umami entry flow otherwise.
- Updated Next.js from 16.4.2 to 16.4.6 to resolve the security check blocking production builds.
- Configured Railway directly to use the dedicated POC Dockerfile and healthcheck. Removed the unused legacy `railway.toml` draft after Railway rejected Config as Code for new services.

### Deployment and validation

- Deployed the synthetic demo to [Railway](https://scf-umami-poc-production.up.railway.app/scf) as a single application without a database.
- Passed production compilation, TypeScript, Biome and six analytics contract tests.
- Verified desktop/mobile dashboard flows and the public deployment in Chrome.
- Validated the native seed on temporary PostgreSQL: 13,392 sessions and 39,446 events, unchanged after a second seed.
- Confirmed native tenant access to its own website, refusal of another tenant's website and operator access across projects.

### Explicitly outside this milestone

- Production high availability, failover and SLA guarantees.
- Persistent demo enrollment, SCF-specific authentication and PostgreSQL row-level security.
- Real OpenTelemetry ingestion, API metrics persistence and retention jobs.
- Tracker versioning/SRI hardening, production fraud controls and privacy/compliance implementation.
- SCF-scoped metrics API key management and GitHub-to-Railway autodeploys.
