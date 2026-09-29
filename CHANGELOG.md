# Changelog

All notable CascadeTrace changes are documented here.

## 1.3.0 — Scenario Registry & Evidence Contracts

- Added a versioned scenario registry with canonical IDs, operational status, tags, engine version, and deterministic scenario-manifest hashes.
- Added `GET /api/v1/scenarios` and `GET /api/v1/scenarios/{id}` while preserving the existing CITY//01 compatibility endpoint.
- Added server-generated evidence packages that bind scenario manifest, persisted run, command ledger, client summary, Java replay result, replay fingerprint, and a package-level SHA-256 integrity hash.
- Updated Incident Intelligence export to download the backend-generated evidence contract instead of constructing the package only in the browser.
- Added stable evidence-package integration coverage and scenario-registry unit coverage.
- Added macOS/Linux one-command startup, shutdown, and environment-check scripts.
- Added a Windows `CHECK-CASCADETRACE.bat` environment doctor.
- Added CI validation for Docker Compose, Unix launcher syntax, and whitespace errors.
- Expanded Makefile operational targets and aligned frontend/backend versions to 1.3.0.

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
