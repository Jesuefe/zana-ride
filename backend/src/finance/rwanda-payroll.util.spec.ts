import { calculateRwandaPaye, calculateRwandaPayroll } from './rwanda-payroll.util';

describe('Rwanda PAYE monthly bands', () => {
  it('applies progressive monthly bands', () => {
    expect(calculateRwandaPaye(60_000)).toBe(0);
    expect(calculateRwandaPaye(100_000)).toBe(4_000);
    expect(calculateRwandaPaye(200_000)).toBe(24_000);
    expect(calculateRwandaPaye(300_000)).toBe(54_000);
  });
  it('rejects invalid gross pay', () => {
    expect(() => calculateRwandaPaye(-1)).toThrow();
    expect(() => calculateRwandaPaye(1.5)).toThrow();
  });
});

describe('Rwanda payroll calculation', () => {
  it('calculates current statutory estimates for November 2026', () => {
    const result = calculateRwandaPayroll({ month: '2026-11', baseSalary: 300_000 });
    expect(result.paye).toBe(54_000);
    expect(result.employeePension).toBe(18_000);
    expect(result.employerPension).toBe(18_000);
    expect(result.employerOccupationalHazards).toBe(6_000);
    expect(result.employeeMaternity).toBe(900);
    expect(result.employerMaternity).toBe(900);
    expect(result.cbhi).toBe(1_136);
    expect(result.netPay).toBe(225_964);
  });
  it('uses the scheduled pension rate from January 2027', () => {
    const result = calculateRwandaPayroll({ month: '2027-01', baseSalary: 300_000 });
    expect(result.employeePension).toBe(21_000);
    expect(result.employerPension).toBe(21_000);
  });
  it('includes taxable allowances and bonus, and rejects malformed months', () => {
    const result = calculateRwandaPayroll({ month: '2026-11', baseSalary: 100_000, taxableAllowances: 20_000, bonus: 10_000, nonTaxableAllowances: 5_000 });
    expect(result.taxableGross).toBe(130_000);
    expect(result.netPay).toBeGreaterThan(0);
    expect(() => calculateRwandaPayroll({ month: 'Nov-26', baseSalary: 100_000 })).toThrow();
  });
});