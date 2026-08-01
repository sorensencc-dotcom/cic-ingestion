import { FireDrillManager, FireDrillConfig } from './FireDrillManager';

describe('FireDrillManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should initialize with default config and state', () => {
    const manager = new FireDrillManager();
    expect(manager.getLastReport()).toBeNull();
    expect(manager.isHealthy()).toBe(true);
  });

  it('should execute drills and generate a report', async () => {
    jest.useRealTimers();
    const manager = new FireDrillManager({ enabled: true, reportToSLO: true });

    const report = await manager.runDrills();

    expect(report).toBeDefined();
    expect(report.timestamp).toBeInstanceOf(Date);
    expect(typeof report.totalDrills).toBe('number');
    expect(typeof report.passedDrills).toBe('number');
    expect(typeof report.failedDrills).toBe('number');
    expect(typeof report.passRate).toBe('string');
    expect(Array.isArray(report.violations)).toBe(true);
    expect(typeof report.healthy).toBe('boolean');

    expect(manager.getLastReport()).toEqual(report);
    expect(manager.isHealthy()).toBe(report.healthy);
  }, 30000);

  it('should manage scheduling interval correctly', async () => {
    const manager = new FireDrillManager({ enabled: true, runOnInterval: 5000 });
    const runSpy = jest.spyOn(manager, 'runDrills').mockResolvedValue({
      timestamp: new Date(),
      totalDrills: 1,
      passedDrills: 1,
      failedDrills: 0,
      passRate: '100%',
      violations: [],
      healthy: true,
    });

    manager.startSchedule(5000);

    expect(runSpy).not.toHaveBeenCalled();

    // Advance timer by 5000ms
    jest.advanceTimersByTime(5000);
    expect(runSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    expect(runSpy).toHaveBeenCalledTimes(2);

    // Stop schedule
    manager.stopSchedule();

    jest.advanceTimersByTime(5000);
    expect(runSpy).toHaveBeenCalledTimes(2);
  });

  it('should overwrite existing interval when starting a new schedule', () => {
    const manager = new FireDrillManager();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    manager.startSchedule(10000);
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    manager.startSchedule(20000);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    manager.stopSchedule();
  });
});
