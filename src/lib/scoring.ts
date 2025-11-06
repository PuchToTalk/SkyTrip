/**
 * Calculate temperature score (0-100%)
 * Returns 100% if temperature is within min-max range (ideal condition)
 * Score decreases proportionally with distance from the ideal range
 * The further from the range, the worse the score
 */
export function weatherScore(
  temp: number,
  pref: { min: number; max: number }
): number {
  const { min, max } = pref;
  
  // Perfect score (100%) if within ideal range
  if (temp >= min && temp <= max) {
    return 100;
  }
  
  // Calculate distance from ideal range
  let distanceFromIdeal = 0;
  if (temp < min) {
    // Too cold: distance below minimum
    distanceFromIdeal = min - temp;
  } else if (temp > max) {
    // Too hot: distance above maximum
    distanceFromIdeal = temp - max;
  }
  
  // Calculate penalty based on distance
  // Use the range as a reference for scaling
  const range = max - min;
  const referenceRange = Math.max(range, 5); // Minimum 5°C reference to avoid division issues
  
  // Penalty increases with distance: 
  // - At 1x the range distance: lose 50% of score
  // - At 2x the range distance: lose 75% of score
  // - At 3x+ the range distance: lose 90%+ of score
  const normalizedDistance = distanceFromIdeal / referenceRange;
  const penalty = Math.min(normalizedDistance * 50, 95); // Max 95% penalty
  
  return Math.max(5, 100 - penalty); // Minimum 5% to show it's still a valid option
}

/**
 * Calculate price score (0-100%)
 * Returns 100% if price is exactly at budget (ideal condition)
 * Score decreases proportionally with distance from budget
 * The further from budget (above or below), the worse the score
 */
export function priceScore(price: number, budget: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  
  // Perfect score (100%) if price equals budget exactly
  if (price === budget) {
    return 100;
  }
  
  // Calculate distance from ideal budget
  let distanceFromIdeal = 0;
  if (price < budget) {
    // Under budget: distance is percentage below
    distanceFromIdeal = (budget - price) / budget;
  } else {
    // Over budget: distance is percentage above
    distanceFromIdeal = (price - budget) / budget;
  }
  
  // Penalty increases with distance from budget:
  // - At 10% away: lose ~10% of score
  // - At 30% away: lose ~30% of score  
  // - At 50% away: lose ~50% of score
  // - At 100%+ away: lose 80%+ of score
  const penalty = Math.min(distanceFromIdeal * 80, 95); // Max 95% penalty
  
  return Math.max(5, 100 - penalty); // Minimum 5% to show it's still a valid option
}

/**
 * Calculate duration score based on ranking (0-100%)
 * For top 3 flights: 1st = 100%, 2nd = 67%, 3rd = 33%
 * Ranking is based on duration (shorter = better)
 */
export function durationScore(rank: number, totalFlights: number): number {
  if (rank < 1 || rank > totalFlights) return 0;
  
  // For top 3 flights, assign scores based on rank
  if (totalFlights <= 3) {
    if (rank === 1) return 100; // Shortest = best
    if (rank === 2) return 67;  // Medium
    if (rank === 3) return 33;  // Longest
  }
  
  // For more than 3 flights, scale linearly
  // rank 1 = 100%, rank n = (n - 1) / (totalFlights - 1) * 100
  const score = 100 - ((rank - 1) / (totalFlights - 1)) * 100;
  return Math.max(0, score);
}

/**
 * Calculate composite score (0-100%)
 * 40% budget score, 30% temperature score, 30% duration score
 */
export function composite(
  temp: number,
  price: number,
  pref: { min: number; max: number },
  budget: number,
  durationRank: number = 1, // Rank of flight by duration (1 = shortest, higher = longer)
  totalFlights: number = 3  // Total number of flights being compared
): number {
  const tempScore = weatherScore(temp, pref);
  const priceScoreVal = priceScore(price, budget);
  const durationScoreVal = durationScore(durationRank, totalFlights);
  
  // Weighted average: 40% budget, 30% temperature, 30% duration
  const compositeScore = (priceScoreVal * 0.4) + (tempScore * 0.3) + (durationScoreVal * 0.3);
  
  return compositeScore;
}

