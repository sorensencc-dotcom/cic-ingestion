/**
 * Phase 27: Aperture — Unified Export
 */
// Types
export * from './types.js';
// Registry
import { AdapterRegistry, createV1Registry } from './registry/AdapterRegistry.js';
export { AdapterRegistry, createV1Registry };
// Policy
import { PolicyEngine, createDefaultPolicyEngine } from './policy/PolicyEngine.js';
export { PolicyEngine, createDefaultPolicyEngine };
// Orchestrator
import { ExecutionOrchestrator } from './orchestrator/ExecutionOrchestrator.js';
export { ExecutionOrchestrator };
// Sandbox
import { SandboxRuntime, createSandboxRuntime } from './sandbox/SandboxRuntime.js';
export { SandboxRuntime, createSandboxRuntime };
// Adapters
import { BaseAdapter } from './adapters/BaseAdapter.js';
import { ValidationUtils } from './adapters/ValidationUtils.js';
import { ShellExecAdapter, createShellExecAdapter } from './adapters/shell/ShellExecAdapter.js';
import { FileReadAdapter, createFileReadAdapter } from './adapters/file/FileReadAdapter.js';
import { FileWriteAdapter, createFileWriteAdapter } from './adapters/file/FileWriteAdapter.js';
import { HttpGetAdapter, createHttpGetAdapter } from './adapters/http/HttpGetAdapter.js';
import { HttpPostAdapter, createHttpPostAdapter } from './adapters/http/HttpPostAdapter.js';
import { BrowserScreenshotAdapter, createBrowserScreenshotAdapter } from './adapters/browser/BrowserScreenshotAdapter.js';
import { BrowserNavigateAdapter, createBrowserNavigateAdapter } from './adapters/browser/BrowserNavigateAdapter.js';
import { ModelGenerateAdapter, createModelGenerateAdapter } from './adapters/model/ModelGenerateAdapter.js';
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
