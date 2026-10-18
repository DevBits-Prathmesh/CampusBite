/** Advance is 20% of the validated total, rounded to the nearest paise. */
export function splitPayment(totalPaise: number) {
  const advanceDuePaise = Math.round(totalPaise * 0.2);
  const balanceDuePaise = totalPaise - advanceDuePaise;
  return { advanceDuePaise, balanceDuePaise };
}

export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export function rupeesToPaise(rupees: string) {
  const value = Number(rupees);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
