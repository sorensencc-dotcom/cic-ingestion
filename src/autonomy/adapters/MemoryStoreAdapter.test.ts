import { MemoryStoreAdapter } from './MemoryStoreAdapter';

describe('MemoryStoreAdapter', () => {
  describe('generateSessionId', () => {
    it('should generate a valid session ID with expected prefix', () => {
      const sessionId = MemoryStoreAdapter.generateSessionId();
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it('should generate unique session IDs on subsequent calls', () => {
      const id1 = MemoryStoreAdapter.generateSessionId();
      const id2 = MemoryStoreAdapter.generateSessionId();
      expect(id1).not.toEqual(id2);
    });
  });

  describe('signalToMemoryEvent', () => {
    it('should format signal into memory event object', () => {
      const signalPayload = { name: 'testSignal', data: 42 };
      const sessionId = 'session-123-abc';

      const event = MemoryStoreAdapter.signalToMemoryEvent(signalPayload, sessionId);

      expect(event).toEqual({
        type: 'signal',
        payload: signalPayload,
        sessionId: 'session-123-abc',
        timestamp: expect.any(String),
      });

      expect(new Date(event.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('proposalToMemoryEvent', () => {
    it('should format proposal into memory event object', () => {
      const proposalPayload = { action: 'scale', target: 'nodes' };
      const sessionId = 'session-456-def';

      const event = MemoryStoreAdapter.proposalToMemoryEvent(proposalPayload, sessionId);

      expect(event).toEqual({
        type: 'proposal',
        payload: proposalPayload,
        sessionId: 'session-456-def',
        timestamp: expect.any(String),
      });

      expect(new Date(event.timestamp).getTime()).not.toBeNaN();
    });
  });
});
