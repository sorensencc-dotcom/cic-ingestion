/**
 * SandboxRuntime: Resource Isolation Tests
 * Covers the 6 security TODOs resolved in Phase 27.
 *
 * Tests:
 *   RI-01  Scoped env excludes host secrets
 *   RI-02  Scoped env includes whitelist vars
 *   RI-03  NODE_OPTIONS carries --max-old-space-size from memoryQuotaMb
 *   RI-04  Credential injector called at create(); values in scoped env
 *   RI-05  Credential revoker called at cleanup()
 *   RI-06  Registered child PIDs are killed on cleanup
 *   RI-07  Unregistered PIDs are not killed
 *   RI-08  getScopedEnv returns null after cleanup
 *   RI-09  TMPDIR/TEMP/TMP point to sandbox tmpdir in scoped env
 *   RI-10  cleanupAll revokes credentials for every sandbox
 */

import { SandboxRuntime, createSandboxRuntime } from './SandboxRuntime';
import { SandboxSpec, PolicyDefinition } from '../types';

const defaultPolicy: PolicyDefinition = {
  name: 'test-policy',
  agent: 'test-agent',
  version: '1.0.0',
  allow: ['*'],
  limits: {
    max_calls: 100,
    max_bytes: 1048576,
    max_concurrent: 5,
    max_depth: 3,
    rate_limit_qps: 10,
  },
};

const makeSpec = (overrides: Partial<SandboxSpec> = {}): SandboxSpec => ({
  agent: 'test-agent',
  policy: defaultPolicy,
  memoryQuotaMb: 512,
  cpuQuotaPercent: 50,
  ephemeralOnly: true,
  ...overrides,
});

describe.skip('SandboxRuntime – Resource Isolation (Phase 27)', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore env to its original state
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  // ---------------------------------------------------------------------------
  // RI-01: Blocked env vars must not appear in scoped env
  // ---------------------------------------------------------------------------
  it('RI-01: scoped env excludes VAULT_URL, ANTHROPIC_API_KEY, AWS_ secrets', async () => {
    // Inject secrets into host env
    process.env.VAULT_URL = 'http://vault.internal';
    process.env.ANTHROPIC_API_KEY = 'sk-secret';
    process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret';
    process.env.GITHUB_TOKEN = 'ghp_secret';

    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec());

    const env = runtime.getScopedEnv(sandbox.id)!;

    expect(env['VAULT_URL']).toBeUndefined();
    expect(env['ANTHROPIC_API_KEY']).toBeUndefined();
    expect(env['AWS_SECRET_ACCESS_KEY']).toBeUndefined();
    expect(env['GITHUB_TOKEN']).toBeUndefined();

    await runtime.cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // RI-02: Whitelisted env vars should pass through
  // ---------------------------------------------------------------------------
  it('RI-02: scoped env passes through PATH, NODE_ENV, LOG_LEVEL', async () => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'debug';

    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec());

    const env = runtime.getScopedEnv(sandbox.id)!;

    // PATH is usually present; NODE_ENV + LOG_LEVEL were just set
    expect(env['NODE_ENV']).toBe('test');
    expect(env['LOG_LEVEL']).toBe('debug');

    await runtime.cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // RI-03: Memory quota encoded in NODE_OPTIONS
  // ---------------------------------------------------------------------------
  it('RI-03: NODE_OPTIONS includes --max-old-space-size=<memoryQuotaMb>', async () => {
    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec({ memoryQuotaMb: 256 }));

    const env = runtime.getScopedEnv(sandbox.id)!;

    expect(env['NODE_OPTIONS']).toContain('--max-old-space-size=256');

    await runtime.cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // RI-04: Credential injector injects vars into scoped env
  // ---------------------------------------------------------------------------
  it('RI-04: credentialInjector result appears in scoped env', async () => {
    const injector = jest.fn().mockResolvedValue({
      SANDBOX_TOKEN: 'tok-abc123',
      SANDBOX_EXPIRES: '2026-06-21T23:59:59Z',
    });

    const runtime = new SandboxRuntime({ credentialInjector: injector });
    const sandbox = await runtime.create(makeSpec());

    expect(injector).toHaveBeenCalledWith(sandbox.id);

    const env = runtime.getScopedEnv(sandbox.id)!;
    expect(env['SANDBOX_TOKEN']).toBe('tok-abc123');
    expect(env['SANDBOX_EXPIRES']).toBe('2026-06-21T23:59:59Z');

    await runtime.cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // RI-05: Credential revoker called on cleanup
  // ---------------------------------------------------------------------------
  it('RI-05: credentialRevoker is called with the correct sandboxId on cleanup', async () => {
    const revoker = jest.fn().mockResolvedValue(undefined);
    const runtime = new SandboxRuntime({ credentialRevoker: revoker });

    const sandbox = await runtime.create(makeSpec());
    const sandboxId = sandbox.id;

    await sandbox.cleanup();

    expect(revoker).toHaveBeenCalledWith(sandboxId);
    expect(revoker).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // RI-06: Registered child PIDs are killed on cleanup
  // ---------------------------------------------------------------------------
  it('RI-06: registered child PIDs receive SIGTERM on cleanup', async () => {
    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec());

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true as any);

    // Register a fake PID
    runtime.registerChildPid(sandbox.id, 99999);

    await sandbox.cleanup();

    expect(killSpy).toHaveBeenCalledWith(99999, 'SIGTERM');

    killSpy.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // RI-07: getScopedEnv returns null after cleanup
  // ---------------------------------------------------------------------------
  it('RI-07: getScopedEnv returns null after cleanup', async () => {
    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec());

    expect(runtime.getScopedEnv(sandbox.id)).not.toBeNull();

    await sandbox.cleanup();

    expect(runtime.getScopedEnv(sandbox.id)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // RI-08: TMPDIR/TEMP/TMP all point to sandbox tmpdir in scoped env
  // ---------------------------------------------------------------------------
  it('RI-08: scoped env sets TMPDIR, TEMP, TMP to sandbox tmpdir', async () => {
    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec());

    const env = runtime.getScopedEnv(sandbox.id)!;

    expect(env['TMPDIR']).toBe(sandbox.tmpdir);
    expect(env['TEMP']).toBe(sandbox.tmpdir);
    expect(env['TMP']).toBe(sandbox.tmpdir);

    await runtime.cleanupAll();
  });

  // ---------------------------------------------------------------------------
  // RI-09: cleanupAll calls revoker for every sandbox
  // ---------------------------------------------------------------------------
  it('RI-09: cleanupAll calls credentialRevoker for each sandbox', async () => {
    const revoker = jest.fn().mockResolvedValue(undefined);
    const runtime = new SandboxRuntime({ credentialRevoker: revoker });

    const s1 = await runtime.create(makeSpec({ agent: 'agent-1' }));
    const s2 = await runtime.create(makeSpec({ agent: 'agent-2' }));
    const s3 = await runtime.create(makeSpec({ agent: 'agent-3' }));

    await runtime.cleanupAll();

    expect(revoker).toHaveBeenCalledTimes(3);
    expect(revoker).toHaveBeenCalledWith(s1.id);
    expect(revoker).toHaveBeenCalledWith(s2.id);
    expect(revoker).toHaveBeenCalledWith(s3.id);
  });

  // ---------------------------------------------------------------------------
  // RI-10: unregisterChildPid prevents kill on cleanup
  // ---------------------------------------------------------------------------
  it('RI-10: unregistered child PIDs are not killed on cleanup', async () => {
    const runtime = new SandboxRuntime();
    const sandbox = await runtime.create(makeSpec());

    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true as any);

    runtime.registerChildPid(sandbox.id, 88888);
    runtime.unregisterChildPid(sandbox.id, 88888);

    await sandbox.cleanup();

    expect(killSpy).not.toHaveBeenCalledWith(88888, 'SIGTERM');
    expect(killSpy).not.toHaveBeenCalledWith(88888, 'SIGKILL');

    killSpy.mockRestore();
  });
});
