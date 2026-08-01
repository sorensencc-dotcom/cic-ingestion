import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SLOViolationWebhook, SLOEvent } from './SLOViolationWebhook';

describe('SLOViolationWebhook', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  const event: SLOEvent = {
    type: 'TIMEOUT', adapter: 'adapter-a', severity: 'CRITICAL', timestamp: 1700000000000,
    details: { elapsedMs: 5000 },
  };

  it('sends the expected Slack payload for a critical violation', async () => {
    const webhook = new SLOViolationWebhook({ slackWebhookUrl: 'https://slack.test', retries: 1 });
    const post = jest.fn(async () => ({ status: 200 }));
    (webhook as any).client.post = post;

    await webhook.emit(event);
    await Promise.resolve();
    await Promise.resolve();

    expect(post).toHaveBeenCalledWith('https://slack.test', expect.objectContaining({
      text: 'SLO Violation: TIMEOUT on adapter adapter-a',
      attachments: [expect.objectContaining({ color: '#FF0000' })],
    }));
  });

  it('retries failed delivery with exponential backoff', async () => {
    const webhook = new SLOViolationWebhook({ slackWebhookUrl: 'https://slack.test', retries: 3 });
    const post = jest.fn<any>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('still offline'))
      .mockResolvedValue({ status: 200 });
    (webhook as any).client.post = post;

    const promise = webhook.emit(event);
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(200);
    await promise;
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('does not reject the caller when endpoint remains unreachable', async () => {
    const webhook = new SLOViolationWebhook({ slackWebhookUrl: 'https://unreachable.test', retries: 1 });
    (webhook as any).client.post = jest.fn<any>().mockRejectedValue(new Error('network unreachable'));
    await expect(webhook.emit(event)).resolves.toBeUndefined();
    await jest.runAllTimersAsync();
  });
});
