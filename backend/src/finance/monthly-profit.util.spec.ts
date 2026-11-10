import { calculateMonthlyZifContribution } from './monthly-profit.util';

describe('calculateMonthlyZifContribution', () => {
  it('allocates exactly 3% of positive monthly net profit', () => {
    expect(calculateMonthlyZifContribution(1_000_000)).toBe(30_000);
  });
  it('rounds to the nearest whole RWF', () => {
    expect(calculateMonthlyZifContribution(101)).toBe(3);
  });
  it('allocates zero when the month breaks even or makes a loss', () => {
    expect(calculateMonthlyZifContribution(0)).toBe(0);
    expect(calculateMonthlyZifContribution(-50_000)).toBe(0);
  });
  it('rejects invalid inputs', () => {
    expect(() => calculateMonthlyZifContribution(Number.NaN)).toThrow();
    expect(() => calculateMonthlyZifContribution(100, 101)).toThrow();
  });
});