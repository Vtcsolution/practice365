const User = require('../models/User');
const Matter = require('../models/Matter');
const FirmSettings = require('../models/FirmSettings');

/**
 * Three-level rate hierarchy (Section 6.1):
 *   1. Matter-level override (most specific)
 *   2. Practice-area override on the attorney
 *   3. Attorney's firm-wide default billing rate
 *   4. Firm-wide default rate (fallback)
 *
 * Rate is resolved and locked at time-entry creation.
 * Rate changes are NEVER retroactive.
 */
async function resolveRate(userId, matterId) {
  const [matter, user, settings] = await Promise.all([
    Matter.findById(matterId),
    User.findById(userId),
    FirmSettings.findOne()
  ]);

  // Level 1: Matter-level override
  if (matter?.billingRateOverride && matter.billingRateOverride > 0) {
    return matter.billingRateOverride;
  }

  // Level 2: Practice-area override on the attorney
  if (user?.practiceAreaRates && matter?.practiceArea) {
    const paRate = user.practiceAreaRates.get(matter.practiceArea);
    if (paRate && paRate > 0) {
      return paRate;
    }
  }

  // Level 3: Attorney's default billing rate
  if (user?.billingRate && user.billingRate > 0) {
    return user.billingRate;
  }

  // Level 4: Firm-wide default
  return settings?.defaultBillingRate || 250;
}

/**
 * Determine whether time generates a per-hour invoice charge.
 * Flat-fee and contingency matters still log time for internal tracking
 * but the line amount is $0 on invoices.
 */
function isChargeableTime(matter) {
  return matter?.billingType === 'hourly';
}

module.exports = { resolveRate, isChargeableTime };
