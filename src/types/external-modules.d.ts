declare module 'pg' {
  export class Pool {
    constructor(config?: unknown);
    query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, any>> }>;
  }
}

declare module '@anthropic-ai/sdk' {
  export class Anthropic {
    constructor(options: { apiKey: string });
    messages: { create(input: unknown): Promise<any> };
  }
}

declare module 'puppeteer' {
  export interface Browser { close(): Promise<void>; pages(): Promise<Page[]>; newPage(): Promise<Page>; version(): Promise<string> }
  export interface Page {
    close(): Promise<void>;
    goto(url: string, options?: unknown): Promise<{ status(): number | null } | null>;
    screenshot(options?: unknown): Promise<Buffer>;
    title(): Promise<string>;
    url(): string;
    setViewport(options: unknown): Promise<void>;
  }
  const puppeteer: any;
  export = puppeteer;
}

declare module 'cloakbrowser' {
  const cloakbrowser: any;
  export = cloakbrowser;
}
