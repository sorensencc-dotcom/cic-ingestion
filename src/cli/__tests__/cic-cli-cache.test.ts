import { createCacheCommand } from '../cic-cli-cache';
import { CICPromptCacheRouter } from '../../prompt-cache/router';
import { Command } from 'commander';

jest.mock('../../prompt-cache/router');
jest.mock('readline');

describe('Cache CLI Commands', () => {
  beforeEach(() => {
    const mockRouter = new CICPromptCacheRouter() as jest.Mocked<CICPromptCacheRouter>;

    (CICPromptCacheRouter as jest.MockedClass<typeof CICPromptCacheRouter>).mockImplementation(() => mockRouter);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Command creation', () => {
    it('should create cache command', () => {
      const command = createCacheCommand();
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('cache');
    });

    it('should have all 4 subcommands', () => {
      const command = createCacheCommand();
      const subcommandNames = command.commands.map((c: Command) => c.name());

      expect(subcommandNames).toContain('status');
      expect(subcommandNames).toContain('clear');
      expect(subcommandNames).toContain('metrics');
      expect(subcommandNames).toContain('watch');
    });

    it('should have proper descriptions', () => {
      const command = createCacheCommand();
      expect(command.description()).toBe('Cache management and monitoring');

      const statusCmd = command.commands.find((c: Command) => c.name() === 'status');
      expect(statusCmd?.description()).toContain('status');
    });
  });

  describe('status command', () => {
    it('should have status command available', () => {
      const command = createCacheCommand();
      const statusCmd = command.commands.find((c: Command) => c.name() === 'status');
      expect(statusCmd).toBeDefined();
      expect(statusCmd?.description()).toContain('status');
    });
  });

  describe('clear command', () => {
    it('should have clear command available', () => {
      const command = createCacheCommand();
      const clearCmd = command.commands.find((c: Command) => c.name() === 'clear');
      expect(clearCmd).toBeDefined();
      expect(clearCmd?.description()).toContain('Clear');
    });

    it('should have force flag option', () => {
      const command = createCacheCommand();
      const clearCmd = command.commands.find((c: Command) => c.name() === 'clear');
      const hasForceOption = clearCmd?.options.some((opt) => opt.flags.includes('-f'));
      expect(hasForceOption).toBe(true);
    });
  });

  describe('metrics command', () => {
    it('should have metrics command available', () => {
      const command = createCacheCommand();
      const metricsCmd = command.commands.find((c: Command) => c.name() === 'metrics');
      expect(metricsCmd).toBeDefined();
      expect(metricsCmd?.description()).toContain('metrics');
    });

    it('should have format option', () => {
      const command = createCacheCommand();
      const metricsCmd = command.commands.find((c: Command) => c.name() === 'metrics');
      const hasFormatOption = metricsCmd?.options.some((opt) =>
        opt.flags.includes('--format')
      );
      expect(hasFormatOption).toBe(true);
    });
  });

  describe('watch command', () => {
    it('should have watch command available', () => {
      const command = createCacheCommand();
      const watchCmd = command.commands.find((c: Command) => c.name() === 'watch');
      expect(watchCmd).toBeDefined();
      expect(watchCmd?.description()).toContain('monitoring');
    });

    it('should have interval option', () => {
      const command = createCacheCommand();
      const watchCmd = command.commands.find((c: Command) => c.name() === 'watch');
      const hasIntervalOption = watchCmd?.options.some((opt) =>
        opt.flags.includes('--interval')
      );
      expect(hasIntervalOption).toBe(true);
    });

    it('should have default interval of 5000ms', () => {
      const command = createCacheCommand();
      const watchCmd = command.commands.find((c: Command) => c.name() === 'watch');
      const intervalOpt = watchCmd?.options.find((opt) =>
        opt.flags.includes('--interval')
      );
      expect(intervalOpt?.defaultValue).toBe('5000');
    });
  });

  describe('integration', () => {
    it('should have all required subcommands', () => {
      const command = createCacheCommand();
      const subcommands = [
        'status',
        'clear',
        'metrics',
        'watch',
      ];

      const availableCommands = command.commands.map((c: Command) => c.name());

      subcommands.forEach((cmd) => {
        expect(availableCommands).toContain(cmd);
      });
    });

    it('should export cache command factory', () => {
      const command = createCacheCommand();
      expect(command).toBeInstanceOf(Command);
      expect(typeof createCacheCommand).toBe('function');
    });
  });
});
