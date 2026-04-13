/**
 * Returns estimated cost in USD based on provider, model, and token counts.
 * Uses substring matching on model name (e.g. "haiku", "sonnet") for flexibility.
 */
export function calculateCostUSD(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  let inputRate: number; // per million tokens
  let outputRate: number;

  switch (provider) {
    case 'claude': {
      const m = model.toLowerCase();
      if (m.includes('haiku')) {
        inputRate = 0.80;
        outputRate = 4.00;
      } else if (m.includes('opus')) {
        inputRate = 15.00;
        outputRate = 75.00;
      } else if (m.includes('sonnet')) {
        inputRate = 3.00;
        outputRate = 15.00;
      } else {
        // default sonnet pricing
        inputRate = 3.00;
        outputRate = 15.00;
      }
      break;
    }
    case 'gemini': {
      const m = model.toLowerCase();
      if (m.includes('pro')) {
        inputRate = 1.25;
        outputRate = 10.00;
      } else if (m.includes('flash')) {
        inputRate = 0.075;
        outputRate = 0.30;
      } else {
        // default flash pricing
        inputRate = 0.075;
        outputRate = 0.30;
      }
      break;
    }
    default:
      return 0;
  }

  return (inputTokens * inputRate) / 1_000_000 +
         (outputTokens * outputRate) / 1_000_000;
}
