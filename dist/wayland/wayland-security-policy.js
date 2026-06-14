// Stub security policy for Orchestrator
export class WaylandSecurityPolicy {
    isToolAllowed() {
        return true;
    }
}
export function createDefaultSecurityPolicy() {
    return new WaylandSecurityPolicy();
}
//# sourceMappingURL=wayland-security-policy.js.map