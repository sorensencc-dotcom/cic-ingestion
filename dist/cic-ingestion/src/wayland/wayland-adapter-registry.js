// Stub adapters for Orchestrator
export class WaylandAdapterRegistry {
    async execute() {
        return { status: 'ok' };
    }
}
export function createDefaultRegistry() {
    return new WaylandAdapterRegistry();
}
//# sourceMappingURL=wayland-adapter-registry.js.map
