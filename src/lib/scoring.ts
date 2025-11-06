/**
 * Calculate temperature score (0-100%)
 * Returns 100% if temperature is within min-max range
 * Returns decreasing score if outside range (penalty based on distance from range)
 */
export function weatherScore(
  temp: number,
  pref: { min: number; max: number }
): number {
  const { min, max } = pref;
  
  // Perfect score if within range
  if (temp >= min && temp <= max) {
    return 100;
  }
  
  // Calculate penalty for being outside range
  let penalty = 0;
  if (temp < min) {
    // Too cold: penalty increases with distance below min
    const range = max - min;
    const distance = min - temp;
    // Penalty: lose up to 50% for being outside range
    penalty = Math.min((distance / Math.max(range, 10)) * 50, 50);
  } else if (temp > max) {
    // Too hot: penalty increases with distance above max
    const range = max - min;
    const distance = temp - max;
    // Penalty: lose up to 50% for being outside range
    penalty = Math.min((distance / Math.max(range, 10)) * 50, 50);
  }
  
  return Math.max(0, 100 - penalty);
}

/**
 * Calculate price score (0-100%)
 * Returns 100% if price is exactly at budget
 * Returns decreasing score if price is above budget (penalty)
 * Returns full score if price is below budget (bonus capped at 100%)
 */
export function priceScore(price: number, budget: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  
  if (price <= budget) {
    // Price is within budget: score decreases slightly as price gets lower
    // But still give high score (90-100%) for being under budget
    const ratio = price / budget;
    // Linear interpolation: 90% at 0% of budget, 100% at 100% of budget
    return 90 + (ratio * 10);
  } else {
    // Price is over budget: penalty increases with overage
    const over = (price - budget) / budget;
    // Lose 20% per 100% over budget, max penalty of 80% (min score 20%)
    const penalty = Math.min(over * 20, 80);
    return Math.max(20, 100 - penalty);
  }
}

/**
 * Calculate composite score (0-100%)
 * Average of temperature score (50%) and price score (50%)
 */
export function composite(
  temp: number,
  price: number,
  pref: { min: number; max: number },
  budget: number
): number {
  const tempScore = weatherScore(temp, pref);
  const priceScoreVal = priceScore(price, budget);
  
  // Weighted average: 50% temperature, 50% price
  return (tempScore * 0.5) + (priceScoreVal * 0.5);
}

