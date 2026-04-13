import { calculateCostUSD } from './cost';

describe('calculateCostUSD', () => {
  it('should calculate claude sonnet cost correctly', () => {
    const cost = calculateCostUSD('claude', 'claude-sonnet-4-6', 1000, 500);
    // input: 1000 * 3.00 / 1_000_000 = 0.003
    // output: 500 * 15.00 / 1_000_000 = 0.0075
    // total = 0.0105
    expect(cost).toBeGreaterThanOrEqual(0.01);
    expect(cost).toBeLessThanOrEqual(0.02);
  });

  it('should calculate claude haiku cost correctly', () => {
    const cost = calculateCostUSD('claude', 'claude-haiku-4-5', 1000, 500);
    // input: 1000 * 0.80 / 1_000_000 = 0.0008
    // output: 500 * 4.00 / 1_000_000 = 0.002
    // total = 0.0028
    expect(cost).toBeGreaterThanOrEqual(0.001);
    expect(cost).toBeLessThanOrEqual(0.005);
  });

  it('should calculate claude opus cost correctly', () => {
    const cost = calculateCostUSD('claude', 'claude-opus-4', 1000, 500);
    // input: 1000 * 15.00 / 1_000_000 = 0.015
    // output: 500 * 75.00 / 1_000_000 = 0.0375
    // total = 0.0525
    expect(cost).toBeGreaterThanOrEqual(0.05);
    expect(cost).toBeLessThanOrEqual(0.06);
  });

  it('should calculate gemini flash cost correctly', () => {
    const cost = calculateCostUSD('gemini', 'gemini-2.0-flash', 1000, 500);
    // input: 1000 * 0.075 / 1_000_000 = 0.000075
    // output: 500 * 0.30 / 1_000_000 = 0.00015
    // total = 0.000225
    expect(cost).toBeGreaterThanOrEqual(0.0001);
    expect(cost).toBeLessThanOrEqual(0.001);
  });

  it('should calculate gemini pro cost correctly', () => {
    const cost = calculateCostUSD('gemini', 'gemini-2.5-pro', 1000, 500);
    // input: 1000 * 1.25 / 1_000_000 = 0.00125
    // output: 500 * 10.00 / 1_000_000 = 0.005
    // total = 0.00625
    expect(cost).toBeGreaterThanOrEqual(0.005);
    expect(cost).toBeLessThanOrEqual(0.01);
  });

  it('should return 0 for zero tokens', () => {
    const cost = calculateCostUSD('claude', 'claude-sonnet-4-6', 0, 0);
    expect(cost).toBe(0);
  });

  it('should return 0 for unknown provider', () => {
    const cost = calculateCostUSD('openai', 'gpt-4', 1000, 500);
    expect(cost).toBe(0);
  });

  it('should use default sonnet pricing for unknown claude model', () => {
    const cost = calculateCostUSD('claude', 'claude-unknown-model', 1000, 500);
    const sonnetCost = calculateCostUSD('claude', 'claude-sonnet-4-6', 1000, 500);
    expect(cost).toBe(sonnetCost);
  });

  it('should use default flash pricing for unknown gemini model', () => {
    const cost = calculateCostUSD('gemini', 'gemini-unknown-model', 1000, 500);
    const flashCost = calculateCostUSD('gemini', 'gemini-2.0-flash', 1000, 500);
    expect(cost).toBe(flashCost);
  });

  it('should match Go test: claude haiku with haiku-3-5 substring', () => {
    // The Go test uses "claude-haiku-3-5" which contains "haiku"
    const cost = calculateCostUSD('claude', 'claude-haiku-3-5', 1000, 500);
    expect(cost).toBeGreaterThanOrEqual(0.001);
    expect(cost).toBeLessThanOrEqual(0.005);
  });
});
