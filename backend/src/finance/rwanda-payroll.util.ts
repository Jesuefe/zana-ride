export interface RwandaPayrollInput {
  baseSalary: number;
  taxableAllowances?: number;
  nonTaxableAllowances?: number;
  bonus?: number;
  pensionableAllowances?: number;
  month: string;
}

export interface RwandaPayrollResult {
  taxableGross: number;
  pensionableGross: number;
  paye: number;
  employeePension: number;
  employerPension: number;
  employerOccupationalHazards: number;
  employeeMaternity: number;
  employerMaternity: number;
  cbhi: number;
  employeeDeductions: number;
  netPay: number;
  employerStatutoryCost: number;
  totalEmployerCost: number;
  rates: {
    employeePensionPercent: number;
    employerPensionPercent: number;
    occupationalHazardsPercent: number;
    employeeMaternityPercent: number;
    employerMaternityPercent: number;
    cbhiPercent: number;
  };
}

function validRwf(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative whole RWF amount`);
  return value;
}

export function calculateRwandaPaye(monthlyTaxableGross: number): number {
  const gross = validRwf(monthlyTaxableGross, 'Taxable gross');
  const bands = [
    { ceiling: 60_000, rate: 0 },
    { ceiling: 100_000, rate: 0.10 },
    { ceiling: 200_000, rate: 0.20 },
    { ceiling: Number.POSITIVE_INFINITY, rate: 0.30 },
  ];
  let lower = 0;
  let tax = 0;
  for (const band of bands) {
    const taxableInBand = Math.max(0, Math.min(gross, band.ceiling) - lower);
    tax += taxableInBand * band.rate;
    if (gross <= band.ceiling) break;
    lower = band.ceiling;
  }
  return Math.round(tax);
}

/**
 * Rwanda monthly payroll estimate. Rates are effective-dated so future statutory
 * changes do not silently rewrite historic payroll. Validate the tax treatment
 * and contribution bases with Zana's Rwanda accountant before filing.
 */
export function calculateRwandaPayroll(input: RwandaPayrollInput): RwandaPayrollResult {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) throw new Error('Month must use YYYY-MM format');
  const baseSalary = validRwf(input.baseSalary, 'Base salary');
  const taxableAllowances = validRwf(input.taxableAllowances ?? 0, 'Taxable allowances');
  const nonTaxableAllowances = validRwf(input.nonTaxableAllowances ?? 0, 'Non-taxable allowances');
  const bonus = validRwf(input.bonus ?? 0, 'Bonus');
  const pensionableAllowances = validRwf(input.pensionableAllowances ?? 0, 'Pensionable allowances');

  const taxableGross = baseSalary + taxableAllowances + bonus;
  const pensionableGross = baseSalary + pensionableAllowances + bonus;
  const paye = calculateRwandaPaye(taxableGross);
  const futurePensionRate = input.month >= '2027-01' ? 0.07 : 0.06;
  const employeePension = Math.round(pensionableGross * futurePensionRate);
  const employerPension = Math.round(pensionableGross * futurePensionRate);
  const employerOccupationalHazards = Math.round(pensionableGross * 0.02);
  const employeeMaternity = Math.round(pensionableGross * 0.003);
  const employerMaternity = Math.round(pensionableGross * 0.003);
  const cbhi = Math.round(Math.max(0, taxableGross - paye - employeePension - employeeMaternity) * 0.005);
  const employeeDeductions = paye + employeePension + employeeMaternity + cbhi;
  const netPay = taxableGross + nonTaxableAllowances - employeeDeductions;
  const employerStatutoryCost = employerPension + employerOccupationalHazards + employerMaternity;
  return {
    taxableGross, pensionableGross, paye, employeePension, employerPension,
    employerOccupationalHazards, employeeMaternity, employerMaternity, cbhi,
    employeeDeductions, netPay, employerStatutoryCost,
    totalEmployerCost: taxableGross + nonTaxableAllowances + employerStatutoryCost,
    rates: {
      employeePensionPercent: futurePensionRate * 100,
      employerPensionPercent: futurePensionRate * 100,
      occupationalHazardsPercent: 2,
      employeeMaternityPercent: 0.3,
      employerMaternityPercent: 0.3,
      cbhiPercent: 0.5,
    },
  };
}