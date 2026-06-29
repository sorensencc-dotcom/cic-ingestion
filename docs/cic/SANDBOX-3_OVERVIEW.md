# Sandbox-3: Verifiable Compute Substrate

**Status:** Phase Complete (Batches 1-7)  
**Date:** 2026-06-28  
**Version:** v0.1.0

## Executive Summary

Sandbox-3 delivers deterministic microVM execution via Firecracker with comprehensive observability, reproducibility guarantees, and real-time operator control.

### Core Features

- **Deterministic Execution:** Firecracker VMs with kernel/rootfs/environment/config pinning
- **Reproducibility:** 4-part hash (VM config, environment, filesystem, memory snapshot)
- **ONNX Drift Detection:** Deterministic embeddings + cosine distance scoring
- **Network Tracing:** eBPF-based packet capture and analysis
- **Syscall Tracing:** strace-based system call capture with file access derivation
- **SLO Enforcement:** Hard timeout kill-switch + soft violation tracking
- **Operator Dashboard:** Real-time UI for latency, reproducibility, stability, telemetry
- **PostgreSQL Integration:** Audit logs, dedicated trace tables, 24h rolling aggregations

## Architecture Tiers

| Tier | Component | Purpose |
|------|-----------|---------|
| **1** | Firecracker Runtime | VM lifecycle, process isolation |
| **2** | ONNX Embeddings | Deterministic text encoding |
| **3** | Infrastructure | Kernel/config/environment pinning |
| **4** | Tracing | Network + syscall capture |
| **5** | Latency SLO | Hard timeout + manifest generation |
| **6** | UI Dashboard | Operator observability |
| **7** | Backend APIs | Data retrieval + aggregation |

## Delivered Artifacts

- **35 files** across 7 batches
- **~1344 lines** of production code
- **29 bugs fixed** during validation
- **Zero architectural rework** required
- **Ready for Batch 8** (Validation Suite)

## Next Phase

**Batch 8 (Validation Suite):** Integration tests, E2E harness, reproducibility verification, stress tests.

---

See detailed docs:
- [Architecture](SANDBOX-3_ARCHITECTURE.md)
- [Runtime](SANDBOX-3_RUNTIME.md)
- [Harness v3](SANDBOX-3_HARNESS_V3.md)
