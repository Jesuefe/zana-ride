/** ZIF is accrued from positive monthly net profit, never gross customer payments. */
export function calculateMonthlyZifContribution(netProfit: number, ratePercent = 3): number {
  if (!Number.isFinite(netProfit)) throw new Error('Net profit must be a finite RWF amount');
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) throw new Error('Contribution rate must be between 0 and 100');
  return netProfit > 0 ? Math.round(netProfit * ratePercent / 100) : 0;
}