/**
 * Phase 27: Aperture — Unified Export
 */
// Types
export * from './types';
// Registry
import { AdapterRegistry, createV1Registry } from './registry/AdapterRegistry';
export { AdapterRegistry, createV1Registry };
// Policy
import { PolicyEngine, createDefaultPolicyEngine } from './policy/PolicyEngine';
export { PolicyEngine, createDefaultPolicyEngine };
// Orchestrator
import { ExecutionOrchestrator } from './orchestrator/ExecutionOrchestrator';
export { ExecutionOrchestrator };
// Sandbox
import { SandboxRuntime, createSandboxRuntime } from './sandbox/SandboxRuntime';
export { SandboxRuntime, createSandboxRuntime };
// Adapters
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
export async function createApertureRuntime() {
    const registry = createV1Registry();
    const policyEngine = createDefaultPolicyEngine();
    const sandboxRuntime = createSandboxRuntime();
    const orchestrator = new ExecutionOrchestrator(registry, policyEngine, sandboxRuntime);
    // Register v1 adapters
    orchestrator.registerAdapter(createShellExecAdapter());
    orchestrator.registerAdapter(createFileReadAdapter());
    orchestrator.registerAdapter(createFileWriteAdapter());
    orchestrator.registerAdapter(createHttpGetAdapter());
    orchestrator.registerAdapter(createHttpPostAdapter());
    orchestrator.registerAdapter(createBrowserScreenshotAdapter());
    orchestrator.registerAdapter(createBrowserNavigateAdapter());
    orchestrator.registerAdapter(createModelGenerateAdapter());
    return {
        registry,
        policyEngine,
        sandboxRuntime,
        orchestrator
    };
}
//# sourceMappingURL=index.js.map