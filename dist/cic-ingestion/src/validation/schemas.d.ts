import { z } from 'zod';
export declare const NavigateResultSchema: z.ZodObject<{
    url: z.ZodString;
    status: z.ZodNullable<z.ZodNumber>;
    redirected: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: number | null;
    url: string;
    redirected: boolean;
}, {
    status: number | null;
    url: string;
    redirected: boolean;
}>;
export declare const ScreenshotResultSchema: z.ZodObject<{
    base64: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    base64: string;
    width: number;
    height: number;
}, {
    base64: string;
    width: number;
    height: number;
}>;
export declare const ModelGenerateResultSchema: z.ZodObject<{
    text: z.ZodString;
    tokens: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    text: string;
    tokens: number;
}, {
    text: string;
    tokens: number;
}>;
export declare const PuppeteerResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    logs: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    logs: string[];
}, {
    success: boolean;
    logs: string[];
}>;
export declare const AnthropicResultSchema: z.ZodObject<{
    text: z.ZodString;
    inputTokens: z.ZodNullable<z.ZodNumber>;
    outputTokens: z.ZodNullable<z.ZodNumber>;
    stopReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    inputTokens: number | null;
    outputTokens: number | null;
    stopReason: string | null;
}, {
    text: string;
    inputTokens: number | null;
    outputTokens: number | null;
    stopReason: string | null;
}>;
export type NavigateResult = z.infer<typeof NavigateResultSchema>;
export type ScreenshotResult = z.infer<typeof ScreenshotResultSchema>;
export type ModelGenerateResult = z.infer<typeof ModelGenerateResultSchema>;
export type PuppeteerResult = z.infer<typeof PuppeteerResultSchema>;
export type AnthropicResult = z.infer<typeof AnthropicResultSchema>;
//# sourceMappingURL=schemas.d.ts.map