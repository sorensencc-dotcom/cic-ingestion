# CIC Security & Hardening

## 1. Kernel + Rootfs Integrity
- Kernel version pinned.
- Rootfs immutable.
- Hashes stored in snapshotHash + fsHash.
- Any mismatch = immediate rollback.

## 2. Snapshot Integrity
- snapshotHash validated on every VM restore.
- fsHash validated on every inference.
- envHash validated on every routing regime execution.

## 3. Supply Chain Controls
- ONNX runtime version pinned.
- Node.js version pinned.
- No dynamic dependency updates.
- All builds reproducible.

## 4. Firecracker Hardening
- KVM isolation.
- Jail mode enabled.
- vsock restricted.
- No network inside VM except explicit routes.

## 5. Routing Regime Safety
- ConstraintEngine prevents unsafe regimes.
- FallbackGraph validated at startup.
- RegimeSelector deterministic.

## 6. API Security
- Strict JSON schema validation.
- No dynamic code execution.
- No unbounded input.

## 7. Secrets
- No secrets in repo.
- All secrets injected via environment or K8s.

## 8. Monitoring for Security
- Drift spikes.
- Snapshot mismatches.
- fsHash mismatches.
- Node health failures.

## 9. Incident Response
- Drain node.
- Quarantine node.
- Rollback.
- Postmortem.
