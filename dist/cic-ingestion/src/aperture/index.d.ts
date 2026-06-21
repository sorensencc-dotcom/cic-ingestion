/**
 * Phase 27: Aperture — Unified Export
 */
export * from './types';
import { AdapterRegistry, createV1Registry } from './registry/AdapterRegistry';
export { AdapterRegistry, createV1Registry };
import { PolicyEngine, createDefaultPolicyEngine } from './policy/PolicyEngine';
export { PolicyEngine, createDefaultPolicyEngine };
import { ExecutionOrchestrator } from './orchestrator/ExecutionOrchestrator';
export { ExecutionOrchestrator };
import { SandboxRuntime, createSandboxRuntime } from './sandbox/SandboxRuntime';
export { SandboxRuntime, createSandboxRuntime };
import { BaseAdapter } from './adapters/BaseAdapter';
import { ValidationUtils } from './adapters/ValidationUtils';
import { ShellExecAdapter, createShellExecAdapter } from './adapters/shell/ShellExecAdapter';
import { FileReadAdapter, createFileReadAdapter } from './adapters/file/FileReadAdapter';
import { FileWriteAdapter, createFileWriteAdapter } from './adapters/file/FileWriteAdapter';
import { HttpGetAdapter, createHttpGetAdapter } from './adapters/http/HttpGetAdapter';
import { HttpPostAdapter, createHttpPostAdapter } from './adapters/http/HttpPostAdapter';
import { BrowserScreenshotAdapter, createBrowserScreenshotAdapter } from './adapters/browser/BrowserScreenshotAdapter';
import { BrowserNavigateAdapter, createBrowserNavigateAdapter } from './adapters/browser/BrowserNavigateAdapter';
import { ModelGenerateAdapter, createModelGenerateAdapter } from './adapters/model/ModelGenerateAdapter';
export { BaseAdapter, ValidationUtils, ShellExecAdapter, createShellExecAdapter, FileReadAdapter, createFileReadAdapter, FileWriteAdapter, createFileWriteAdapter, HttpGetAdapter, createHttpGetAdapter, HttpPostAdapter, createHttpPostAdapter, BrowserScreenshotAdapter, createBrowserScreenshotAdapter, BrowserNavigateAdapter, createBrowserNavigateAdapter, ModelGenerateAdapter, createModelGenerateAdapter };
/**
 * Factory: Create fully configured Aperture runtime
 */
export declare function createApertureRuntime(): Promise<{
    registry: AdapterRegistry;
    policyEngine: PolicyEngine;
    sandboxRuntime: SandboxRuntime;
    orchestrator: ExecutionOrchestrator;
}>;
//# sourceMappingURL=index.d.ts.map