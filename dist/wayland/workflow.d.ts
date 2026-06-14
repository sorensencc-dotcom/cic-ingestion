export interface WorkflowStep {
    id: string;
    adapter: string;
    payload: any;
    retries?: number;
    timeoutMs?: number;
    condition?: (ctx: WorkflowContext) => boolean;
}
export interface WorkflowDef {
    id: string;
    name: string;
    description: string;
    schedule?: string;
    steps: WorkflowStep[];
}
export interface WorkflowContext {
    workflowId: string;
    sessionId: string;
    stepResults: Map<string, any>;
    startTime: number;
    logger: any;
    registry: any;
    securityPolicy: any;
}
export declare class WorkflowRunner {
    run(workflow: WorkflowDef, ctx: WorkflowContext): Promise<Map<string, any>>;
}
export declare const dailyIngestReasoningWorkflow: WorkflowDef;
export declare function registerWorkflow(workflow: WorkflowDef): void;
export declare function getWorkflow(id: string): WorkflowDef | undefined;
export declare function listWorkflows(): WorkflowDef[];
//# sourceMappingURL=workflow.d.ts.map