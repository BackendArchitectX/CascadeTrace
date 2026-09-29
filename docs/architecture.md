# Architecture

## Runtime boundaries

### React / TypeScript
The browser runs the interactive CITY//01 simulation. It owns the live state required for graph rendering, intervention controls, event history, Causal X-Ray, FORKLINE, and the AAR.

### Spring Boot
The Java service is an independent deterministic verifier. It does not invent or mutate browser state. At the end of a run it receives the recorded command ledger plus a compact local summary, performs its own replay, and returns a parity result.

This gives the project two useful properties:

1. **Fast interaction** — no network round-trip is required for every simulation tick.
2. **Independent verification** — the final command history can be checked by a separately implemented Java engine.

## Determinism

Simulation transitions depend only on:
- initial CITY//01 seed/state;
- command ID;
- command issue second;
- insertion order for simultaneous commands;
- selected report where relevant.

There is no random number source in the simulation engine.

## Causal provenance

Threshold events record:
- source system;
- target system;
- affected metric;
- previous/new value;
- cause ID;
- authoritative simulation time.

Causal X-Ray renders these fields rather than generating an explanation from an LLM.
