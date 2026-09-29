# ADR 0002: Scenario registry and evidence contracts

- Status: Accepted
- Date: 2026-09-29

## Context

CascadeTrace began with one authoritative scenario, CITY//01. As persistence, comparison, and replay verification were added, scenario identity risked becoming duplicated across UI labels, persistence records, controller code, and deterministic engines.

The incident archive also originally exported JSON in the browser. That was convenient, but the exported envelope itself was not produced by the system that owns persisted evidence.

## Decision

Introduce two explicit backend contracts.

### 1. Scenario registry

Spring Boot owns a registry of operational scenario manifests. A manifest exposes canonical identity, engine version, duration, incident parameters, systems, interventions, tags, operational status, and a SHA-256 manifest hash.

The legacy `GET /api/v1/scenario` endpoint remains for compatibility. New consumers use:

- `GET /api/v1/scenarios`
- `GET /api/v1/scenarios/{id}`

CITY//01 is the first operational registry entry. The registry is intentionally designed so additional deterministic scenarios can be added without changing archive and evidence response shapes.

### 2. Server evidence package

The backend produces an evidence package for a persisted run. The package contains:

- evidence schema version;
- export timestamp;
- scenario manifest;
- persisted run identity;
- exact ordered command ledger;
- client summary;
- independent Java replay evaluation;
- replay fingerprint;
- package-level SHA-256 evidence hash.

The evidence hash excludes the export timestamp. Therefore repeated exports of unchanged stored evidence produce the same evidence hash.

## Consequences

### Positive

- Scenario identity is centralized and versionable.
- Archived evidence is bound to a specific scenario manifest.
- Evidence export no longer depends on browser-generated envelope semantics.
- Repeated exports can be compared by package hash.
- Additional scenario implementations have a stable API boundary.
- The archive and comparison APIs remain scenario-agnostic.

### Trade-offs

- The scenario registry currently contains only CITY//01; the abstraction exists before the second executable scenario.
- The evidence hash provides integrity and stable identity, not cryptographic authorship. It is not a digital signature or third-party attestation.
- Client and Java replay engines remain intentionally separate, so deterministic behavior still requires parity tests when scenario logic changes.

## Guardrails

- Do not claim an unimplemented scenario is operational.
- Do not change a scenario's authoritative behavior without changing its engine version or manifest inputs.
- Keep evidence-schema changes backward compatible or increment the evidence schema version.
- Preserve the command ledger ordering contract: simulation second, then insertion order.
