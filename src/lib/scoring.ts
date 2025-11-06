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
 * Lower prices are better (cheaper = better)
 * Prices above budget are heavily penalized, especially if much higher
 * The further above budget, the more penalized
 */
export function priceScore(price: number, budget: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(budget) || budget <= 0) return 0;
  
  // If price is at or below budget, give full or near-full score
  // Cheaper is better, so we reward lower prices
  if (price <= budget) {
    // Perfect score (100%) if price is at budget
    // Slightly less for very cheap prices (but still very good)
    // This encourages using the full budget but rewards savings
    if (price === budget) {
      return 100;
    }
    
    // If price is below budget, still give high score (cheaper is better)
    // But slightly reduce if it's much cheaper (e.g., 50% of budget)
    // This way we prefer prices closer to budget but still reward savings
    const ratio = price / budget;
    if (ratio >= 0.8) {
      // 80-100% of budget: excellent score (95-100%)
      return 95 + (ratio - 0.8) * 25; // 95% to 100%
    } else if (ratio >= 0.5) {
      // 50-80% of budget: very good score (85-95%)
      return 85 + (ratio - 0.5) * 33.33; // 85% to 95%
    } else {
      // Below 50% of budget: good score but less than closer to budget
      return 70 + (ratio / 0.5) * 15; // 70% to 85%
    }
  }
  
  // If price is above budget, apply heavy penalty
  // The higher above budget, the more penalized
  const excessRatio = price / budget; // e.g., 1.5 = 50% over budget, 2.0 = 100% over budget
  
  // Exponential penalty for prices above budget:
  // - At 10% over budget (1.1x): lose ~20% of score (80% remaining)
  // - At 25% over budget (1.25x): lose ~40% of score (60% remaining)
  // - At 50% over budget (1.5x): lose ~65% of score (35% remaining)
  // - At 100% over budget (2.0x): lose ~85% of score (15% remaining)
  // - At 200%+ over budget (3.0x+): lose ~95%+ of score (5% remaining)
  
  // Calculate penalty using exponential curve
  const overBudgetRatio = excessRatio - 1; // 0.1 for 10% over, 0.5 for 50% over, etc.
  const penalty = Math.min(overBudgetRatio * 100, 95); // Linear penalty up to 95%
  
  // Apply exponential scaling for severe over-budget cases
  let finalPenalty = penalty;
  if (overBudgetRatio > 0.5) {
    // For prices > 50% over budget, apply exponential penalty
    const excessOverHalf = overBudgetRatio - 0.5;
    finalPenalty = 50 + (excessOverHalf * 90); // 50% base penalty + exponential
    finalPenalty = Math.min(finalPenalty, 95); // Cap at 95%
  }
  
  return Math.max(5, 100 - finalPenalty); // Minimum 5% to show it's still a valid option
}

/**
 * Calculate duration score (0-100%)
 * Shorter durations are better (shorter = better)
 * Longer durations are penalized, especially if much longer
 * The further above the shortest duration, the more penalized
 */
export function durationScore(durationMinutes: number, shortestDurationMinutes: number): number {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return 0;
  if (!Number.isFinite(shortestDurationMinutes) || shortestDurationMinutes <= 0) return 0;
  
  // If duration equals shortest duration, give perfect score
  if (durationMinutes === shortestDurationMinutes) {
    return 100;
  }
  
  // If duration is shorter than reference (shouldn't happen, but handle gracefully)
  if (durationMinutes < shortestDurationMinutes) {
    return 100; // Best possible score
  }
  
  // Calculate ratio of duration to shortest duration
  const durationRatio = durationMinutes / shortestDurationMinutes; // e.g., 1.5 = 50% longer, 2.0 = 100% longer
  
  // Penalty increases with duration ratio:
  // - At 10% longer (1.1x): lose ~15% of score (85% remaining)
  // - At 25% longer (1.25x): lose ~30% of score (70% remaining)
  // - At 50% longer (1.5x): lose ~50% of score (50% remaining)
  // - At 100% longer (2.0x): lose ~75% of score (25% remaining)
  // - At 200%+ longer (3.0x+): lose ~90%+ of score (10% remaining)
  
  // Calculate penalty using exponential curve
  const overShortestRatio = durationRatio - 1; // 0.1 for 10% longer, 0.5 for 50% longer, etc.
  
  // Linear penalty for moderate increases
  let penalty = overShortestRatio * 80; // 10% longer = 8% penalty, 50% longer = 40% penalty
  
  // Apply exponential scaling for severe duration increases
  if (overShortestRatio > 0.5) {
    // For durations > 50% longer, apply exponential penalty
    const excessOverHalf = overShortestRatio - 0.5;
    penalty = 40 + (excessOverHalf * 100); // 40% base penalty + exponential
  }
  
  penalty = Math.min(penalty, 95); // Cap at 95% penalty
  
  return Math.max(5, 100 - penalty); // Minimum 5% to show it's still a valid option
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
  durationMinutes: number, // Duration in minutes
  shortestDurationMinutes: number // Shortest duration in minutes for comparison
): number {
  const tempScore = weatherScore(temp, pref);
  const priceScoreVal = priceScore(price, budget);
  const durationScoreVal = durationScore(durationMinutes, shortestDurationMinutes);
  
  // Weighted average: 40% budget, 30% temperature, 30% duration
  const compositeScore = (priceScoreVal * 0.4) + (tempScore * 0.3) + (durationScoreVal * 0.3);
  
  return compositeScore;
}

