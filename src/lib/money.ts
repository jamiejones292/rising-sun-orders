// All money is stored and calculated as whole pence (integers) so totals never
// pick up floating-point rounding errors. Convert to pounds only for display.

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatPence(pence: number): string {
  if (!Number.isInteger(pence)) throw new Error(`Expected whole pence, got ${pence}`);
  return GBP.format(pence / 100);
}

// VAT included in a VAT-inclusive price, e.g. 20% VAT in £6.00 is £1.00.
export function vatIncludedPence(grossPence: number, ratePercent: number): number {
  return Math.round((grossPence * ratePercent) / (100 + ratePercent));
}
