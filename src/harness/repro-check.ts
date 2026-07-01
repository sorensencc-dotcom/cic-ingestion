import { DeterministicSeedInjector } from "./seed-injector";
import { SnapshotHashVerifier } from "./snapshot-hash-verifier";
import { RoutingDeterminismValidator } from "./routing-determinism-validator";
import { OnnxDeterminismValidator } from "./onnx-determinism-validator";
import { FirecrackerStabilityValidator } from "./firecracker-stability-validator";

export interface ReproCheckResult {
  passed: boolean;
  checks: {
    seedInjection: boolean;
    snapshotHash: boolean;
    fsHash: boolean;
    envHash: boolean;
    routingDeterminism: boolean;
    onnxDeterminism: boolean;
    firecrackerStability: boolean;
  };
  errors: string[];
  duration: number;
}

export class ReproducibilityTestHarness {
  private seedInjector: DeterministicSeedInjector;
  private snapshotVerifier: SnapshotHashVerifier;
  private routingValidator: RoutingDeterminismValidator;
  private onnxValidator: OnnxDeterminismValidator;
  private firecrackerValidator: FirecrackerStabilityValidator;

  constructor() {
    this.seedInjector = new DeterministicSeedInjector();
    this.snapshotVerifier = new SnapshotHashVerifier();
    this.routingValidator = new RoutingDeterminismValidator();
    this.onnxValidator = new OnnxDeterminismValidator();
    this.firecrackerValidator = new FirecrackerStabilityValidator();
  }

  async run(seed: number): Promise<ReproCheckResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const checks = {
      seedInjection: false,
      snapshotHash: false,
      fsHash: false,
      envHash: false,
      routingDeterminism: false,
      onnxDeterminism: false,
      firecrackerStability: false
    };

    try {
      // 1. Seed injection
      try {
        await this.seedInjector.inject(seed);
        checks.seedInjection = true;
      } catch (e) {
        errors.push(`Seed injection failed: ${e}`);
      }

      // 2. Snapshot hash verification
      try {
        const snapshotOk = await this.snapshotVerifier.verifySnapshotHash();
        checks.snapshotHash = snapshotOk;
        if (!snapshotOk) errors.push("Snapshot hash mismatch");
      } catch (e) {
        errors.push(`Snapshot hash check failed: ${e}`);
      }

      // 3. Filesystem hash verification
      try {
        const fsHashOk = await this.snapshotVerifier.verifyFsHash();
        checks.fsHash = fsHashOk;
        if (!fsHashOk) errors.push("Filesystem hash mismatch");
      } catch (e) {
        errors.push(`Filesystem hash check failed: ${e}`);
      }

      // 4. Environment hash verification
      try {
        const envHashOk = await this.snapshotVerifier.verifyEnvHash();
        checks.envHash = envHashOk;
        if (!envHashOk) errors.push("Environment hash mismatch");
      } catch (e) {
        errors.push(`Environment hash check failed: ${e}`);
      }

      // 5. Routing determinism validation
      try {
        const routingOk = await this.routingValidator.validateDeterminism();
        checks.routingDeterminism = routingOk;
        if (!routingOk) errors.push("Routing non-deterministic");
      } catch (e) {
        errors.push(`Routing determinism check failed: ${e}`);
      }

      // 6. ONNX determinism validation
      try {
        const onnxOk = await this.onnxValidator.validateDeterminism();
        checks.onnxDeterminism = onnxOk;
        if (!onnxOk) errors.push("ONNX non-deterministic");
      } catch (e) {
        errors.push(`ONNX determinism check failed: ${e}`);
      }

      // 7. Firecracker stability validation
      try {
        const fcOk = await this.firecrackerValidator.validateStability();
        checks.firecrackerStability = fcOk;
        if (!fcOk) errors.push("Firecracker stability degraded");
      } catch (e) {
        errors.push(`Firecracker stability check failed: ${e}`);
      }
    } catch (e) {
      errors.push(`Harness error: ${e}`);
    }

    const duration = Date.now() - startTime;
    const passed = Object.values(checks).every(c => c === true) && errors.length === 0;

    return {
      passed,
      checks,
      errors,
      duration
    };
  }
}
