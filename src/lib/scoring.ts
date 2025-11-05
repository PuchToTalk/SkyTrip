export function weatherScore(
  temp: number,
  pref: { min: number; max: number }
) {
  const { min, max } = pref;
  if (temp < min) return 1 - Math.min((min - temp) / 15, 1);
  if (temp > max) return 1 - Math.min((temp - max) / 15, 1);
  return 1;
}

export function priceScore(price: number, budget: number) {
  if (!Number.isFinite(price)) return 0;
  if (price <= budget) return 1;
  const over = (price - budget) / Math.max(budget, 1);
  return Math.max(0, 1 - Math.min(over, 1));
}

export function composite(
  temp: number,
  price: number,
  pref: { min: number; max: number },
  budget: number
) {
  return 0.6 * weatherScore(temp, pref) + 0.4 * priceScore(price, budget);
}

