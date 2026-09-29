# Changelog

All notable CascadeTrace changes are documented here.

## 1.2.0 — Incident Intelligence

- Added archive-level statistics backed by PostgreSQL aggregate queries.
- Added deterministic comparison between two archived runs.
- Added command-ledger difference reporting and outcome deltas.
- Added JSON evidence export and replay-fingerprint copy controls.
- Added request correlation IDs and correlation-aware backend logging.
- Added Micrometer counters for recorded, verified, mismatched, and re-verified runs.
- Hardened the Windows one-click launcher with fast reopen, readiness checks, failure diagnostics, no-build mode, archive launch mode, and explicit data reset support.
- Added integration coverage for archive statistics and comparison behavior.

## 1.1.0 — Persistent Scenario Runs

- Added PostgreSQL persistence with Spring Data JPA and Hibernate.
- Added Flyway-managed schema migrations.
- Added persistent run history and command-ledger storage.
- Added archived-run re-verification.
- Added OpenAPI / Swagger UI and Actuator health endpoints.
- Added Docker Compose database orchestration and H2 PostgreSQL-mode integration tests.

## 1.0.0 — Full-Stack Baseline

- Added Java 17 + Spring Boot verification backend.
- Added React + TypeScript incident simulator.
- Preserved deterministic engine, replay, Causal X-Ray, and FORKLINE behavior.
- Added Docker, Nginx, GitHub Actions CI, and Apache-2.0 licensing.
