# CascadeTrace

**Critical Infrastructure Cascade Simulator · CITY//01**

CascadeTrace is a deterministic critical-infrastructure incident simulator built as a **Java full-stack application** with a **Spring Boot backend**, **PostgreSQL persistence**, and a **React + TypeScript operational interface**.

> **Every decision changes what happens next.**

CITY//01 begins with Substation S14 losing **180 MW** during peak demand. The operator has a compressed 60-second response window to intervene across a dependency graph spanning Power, Telecom, Traffic, Water, Hospital, and Emergency Services.

> **Scope:** CascadeTrace is an engineering simulation and portfolio project. It is not intended to control or advise real critical infrastructure.

## What makes it different

CascadeTrace is not an LLM dashboard. The simulation is deterministic, replayable, and auditable:

- **Deterministic engine** — identical commands at identical times reproduce the same outcome.
- **Live dependency network** — system states and propagation paths update from authoritative simulation state.
- **Decision debt** — an intervention can solve the immediate problem while creating delayed consequences.
- **Causal X-Ray** — threshold crossings are explained using recorded provenance.
- **FORKLINE** — replay a decision branch and compare alternate outcomes.
- **After Action Review** — evidence-based deficit, cascades, recovery, completed decisions, verified intelligence, and debt.
- **Independent Java replay verification** — Spring Boot replays the exact client command ledger and verifies the final deterministic summary.
- **Persistent incident archive** — completed runs and command ledgers are stored in PostgreSQL through Spring Data JPA.
- **Replay fingerprints** — each replay receives a deterministic SHA-256 fingerprint derived from the command ledger and server outcome.
- **Server re-verification** — any archived run can be replayed again against the current deterministic Java engine.

## Tech stack

### Backend
- Java 17
- Spring Boot 3
- Spring Web / REST APIs
- Spring Data JPA / Hibernate
- PostgreSQL
- Flyway migrations
- Jakarta Validation
- Spring Boot Actuator
- Springdoc OpenAPI / Swagger UI
- JUnit 5 + H2 PostgreSQL-mode integration tests
- Maven

### Frontend
- React 18
- TypeScript
- Vite
- SVG dependency visualization
- Responsive CSS / reduced-motion support
- Persistent Run History interface

### Delivery
- Docker / Docker Compose
- Nginx
- GitHub Actions CI

## Architecture

```mermaid
flowchart LR
    U[Operator] --> R[React + TypeScript UI]
    R --> E[Deterministic Client Engine]
    E --> N[Live Dependency Network]
    E --> C[Causal X-Ray]
    E --> F[FORKLINE]
    E --> A[After Action Review]
    R -->|command ledger + local summary| API[Spring Boot REST API]
    API --> J[Java Deterministic Replay Engine]
    J --> V[Verification Service]
    V --> P[(PostgreSQL)]
    P --> H[Run History / Incident Archive]
```

The browser owns the interactive frame-by-frame simulation so the UI stays responsive. At scenario completion, the same command ledger is independently replayed by Java. The backend verifies the client's stress/degradation timing, recovery, and final deficit, then persists both the evidence and replay fingerprint.

## Scenario

**Initial incident:** Substation S14 loses 180 MW.

**Systems:** Power, Telecom, Traffic, Water, Hospital, Emergency Services.

**Interventions:**
1. Reroute Grid Capacity
2. Shed Non-Critical Load
3. Deploy a Mobile Generator
4. Prioritize Emergency Telecom Traffic
5. Verify an Uncertain Field Report
6. Dispatch a Repair Team

## Deterministic reference trajectories

| Strategy | First STRESSED | First DEGRADED | Recovery | Final deficit |
|---|---:|---:|---:|---:|
| No Action | 40s | 185s | — | 120 MW |
| Reroute | 76s | — | — | 40 MW |
| Reroute + Mobile | — | — | 40s | 0 MW |
| Shed Load | 180s | 198s | — | 30 MW |

Shed Load also creates a delayed Telecom backup-depletion condition at 180s.

## Run with Docker

The quickest full-stack path starts PostgreSQL, Spring Boot, and the React/Nginx frontend together:

```bash
docker compose up --build
```

Open:

- Simulator: `http://localhost:8081`
- Incident archive: `http://localhost:8081/history.html`
- API health: `http://localhost:8080/actuator/health`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

PostgreSQL data is retained in the `cascadetrace-postgres` Docker volume.

## Run locally

### 1. Start PostgreSQL

```bash
docker compose up -d db
```

Default development connection:

```text
jdbc:postgresql://localhost:5432/cascadetrace
username: cascadetrace
password: cascadetrace
```

You can override it with `DATABASE_URL`, `DATABASE_USERNAME`, and `DATABASE_PASSWORD`.

### 2. Backend

```bash
cd backend
mvn spring-boot:run
```

The API starts at `http://localhost:8080` and Flyway applies the schema automatically.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` or `http://localhost:5173/history.html`.

## Verification

Frontend deterministic suites:

```bash
cd frontend
npm run verify
npm run build
```

Expected:

- Engine: **39/39 PASS**
- Replay: **13/13 PASS**
- Causal: **14/14 PASS**
- FORKLINE: **11/11 PASS**

Backend:

```bash
cd backend
mvn test
```

Backend tests include deterministic replay tests and persistence/re-verification integration tests using H2 in PostgreSQL compatibility mode.

## REST API

### Existing runtime APIs

- `GET /api/v1/health`
- `GET /api/v1/scenario`
- `POST /api/v1/replay`

`POST /api/v1/replay` independently verifies the client result and automatically records the completed run. A short deduplication window protects the archive from duplicate React StrictMode submissions.

### Persistent run APIs

- `GET /api/v1/runs?page=0&size=20` — newest runs first
- `GET /api/v1/runs/{id}` — run evidence + command ledger
- `POST /api/v1/runs/{id}/verify` — replay and re-verify an archived run

### Replay request example

```json
{
  "commands": [
    { "second": 0, "commandId": "reroute", "insertionOrder": 0 },
    { "second": 0, "commandId": "mobile", "insertionOrder": 1 }
  ],
  "clientSummary": {
    "firstStressed": null,
    "firstDegraded": null,
    "recoveryTime": 40,
    "finalDeficit": 0
  }
}
```

## Persistence model

```text
simulation_runs
├── UUID id
├── scenario / timestamp
├── client summary
├── server replay outcome
├── verification state
├── SHA-256 replay fingerprint
└── optimistic-lock version

run_commands
├── run_id
├── simulation_second
├── command_id
├── optional report_id
└── deterministic insertion_order
```

Database changes are versioned with Flyway rather than generated automatically by Hibernate (`ddl-auto=validate`).

## Repository layout

```text
CascadeTrace/
├── backend/                 # Java + Spring Boot + JPA + PostgreSQL
├── frontend/                # React + TypeScript simulator + run archive
├── docs/                    # Architecture and API notes
├── .github/workflows/       # CI
├── docker-compose.yml
└── README.md
```

## Design principle

The simulator separates **presentation time** from **authoritative simulation time**: 420 deterministic engine seconds are played at 7× speed and displayed as a 60-second incident. This keeps the tested trajectories intact while making the interaction practical.

## Engineering decisions

See [`docs/architecture.md`](docs/architecture.md) for the runtime model and [`docs/adr/0001-deterministic-simulation.md`](docs/adr/0001-deterministic-simulation.md) for the deterministic-engine decision.

## Maintainer

**BackendArchitectX**

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
