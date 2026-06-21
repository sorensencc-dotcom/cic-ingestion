import { z } from 'zod';
export const NavigateResultSchema = z.object({
    url: z.string().url(),
    status: z.number().int().min(100).max(599).nullable(),
    redirected: z.boolean(),
});
export const ScreenshotResultSchema = z.object({
    base64: z.string(),
    width: z.number().int().min(1).max(10000),
    height: z.number().int().min(1).max(10000),
});
export const ModelGenerateResultSchema = z.object({
    text: z.string(),
    tokens: z.number().int().min(1),
});
export const PuppeteerResultSchema = z.object({
    success: z.boolean(),
    logs: z.array(z.string()),
});
export const AnthropicResultSchema = z.object({
    text: z.string().min(1),
    inputTokens: z.number().int().nullable(),
    outputTokens: z.number().int().nullable(),
    stopReason: z.string().nullable(),
});
//# sourceMappingURL=schemas.js.map
