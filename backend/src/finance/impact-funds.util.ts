export function calculateImpactFundContribution(platformCommission: number, ratePercent = 3): number {
  if (!Number.isSafeInteger(platformCommission) || platformCommission < 0) {
    throw new Error('Platform commission must be a non-negative integer.');
  }
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new Error('Impact Funds rate must be between 0 and 100.');
  }
  return Math.round(platformCommission * ratePercent / 100);
}
