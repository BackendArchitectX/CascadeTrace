# API

Base path: `/api/v1`

## GET `/health`
Returns service/version/deterministic status.

## GET `/scenario`
Returns CITY//01 metadata, systems and intervention names.

## POST `/replay`
Replays a command ledger in Java and compares the resulting deterministic summary with the optional client summary.

### Command fields
- `second`: authoritative simulation second
- `commandId`: intervention ID
- `reportId`: optional report target
- `insertionOrder`: deterministic ordering for same-second commands

### Verification fields
- `firstStressed`
- `firstDegraded`
- `recoveryTime`
- `finalDeficit`
- `cascadeEvents`
- `decisionDebt`
- `verified`

## Deterministic replay fingerprint

Successful replay responses contain `fingerprint`, a SHA-256 digest over the canonical command ledger and deterministic server outcome. It is designed for replay identity and debugging; it is not an authentication signature.
