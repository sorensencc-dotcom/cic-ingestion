export class DeterministicSeedInjector {
  private currentSeed: number | null = null;

  async inject(seed: number): Promise<void> {
    if (seed < 0 || !Number.isInteger(seed)) {
      throw new Error(`Invalid seed: ${seed}. Must be non-negative integer.`);
    }

    this.currentSeed = seed;

    // Set global Math.random seed via crypto
    this.seedMathRandom(seed);

    // Inject into Node.js process
    process.env.DETERMINISTIC_SEED = String(seed);
    process.env.NODE_ENV = "test";
  }

  private seedMathRandom(seed: number): void {
    // Linear congruential generator for deterministic pseudorandom
    let state = seed;
    const a = 1103515245;
    const c = 12345;
    const m = 2147483648;

    const original = Math.random;
    Math.random = () => {
      state = (a * state + c) % m;
      return state / m;
    };
  }

  getSeed(): number | null {
    return this.currentSeed;
  }

  reset(): void {
    this.currentSeed = null;
    delete process.env.DETERMINISTIC_SEED;
  }
}
