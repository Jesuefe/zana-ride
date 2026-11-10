import { calculateImpactFundContribution } from './impact-funds.util';

describe('calculateImpactFundContribution', () => {
  it('accrues 3% from the commission, not the gross transaction', () => {
    expect(calculateImpactFundContribution(1500)).toBe(45);
    expect(calculateImpactFundContribution(1000)).toBe(30);
  });
  it('rounds to the nearest whole RWF', () => {
    expect(calculateImpactFundContribution(101, 3)).toBe(3);
  });
  it('rejects invalid commission and rates', () => {
    expect(() => calculateImpactFundContribution(-1)).toThrow();
    expect(() => calculateImpactFundContribution(100, 101)).toThrow();
  });
});
