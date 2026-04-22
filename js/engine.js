// engine.js — Core balance calculation engine (pure functions)
// Depends on: accrual.js  |  Adds to window.RC namespace

window.RC = window.RC || {};

RC.getNextUseOrLoseBoundary = function(profile, referenceDate) {
  const ref = referenceDate instanceof Date ? referenceDate : RC.parseDate(referenceDate);

  if (profile.settings.employerPreset === 'us_federal') {
    let boundary = RC.addDays(RC.getLeaveYearStart(ref.getUTCFullYear() + 1, profile.settings), -1);
    if (boundary <= ref) boundary = RC.addDays(RC.getLeaveYearStart(ref.getUTCFullYear() + 2, profile.settings), -1);
    return boundary;
  }

  const { boundaryMonth, boundaryDay } = profile.settings.useOrLose;
  let boundary = new Date(Date.UTC(ref.getUTCFullYear(), boundaryMonth - 1, boundaryDay));
  if (boundary <= ref) boundary = new Date(Date.UTC(ref.getUTCFullYear() + 1, boundaryMonth - 1, boundaryDay));
  return boundary;
};

// Main balance calculator.
// Returns { vacation, sick, comp } at targetDate.
// All planned transactions are treated as real — "planned" is a display flag only.
RC.calculateBalance = function(profile, targetDate, options) {
  options = options || {};
  const target = targetDate instanceof Date ? targetDate : RC.parseDate(targetDate);
  const asOf   = RC.parseDate(profile.balances.asOfDate);

  // Helper: add non-opening-balance comp blocks earned by a given date to a balance object.
  // Opening-balance blocks are excluded because their hours are already in profile.balances.hours.comp.
  function seedCompBlocks(base, byDate) {
    (profile.compBlocks || []).forEach(function(b) {
      if (b.isOpeningBalance) return;
      const earned = RC.parseDate(b.dateEarned);
      if (!earned || earned > byDate) return;
      base.comp = (base.comp || 0) + (b.hoursRemaining != null ? b.hoursRemaining : b.hoursOriginal);
    });
  }

  if (!asOf || target <= asOf) {
    const base = Object.assign({}, profile.balances.hours);
    seedCompBlocks(base, target);
    return base;
  }

  const bal = Object.assign({}, profile.balances.hours);

  // Comp blocks with mutable `remaining` for FIFO tracking (oldest first)
  const compBlocks = profile.compBlocks
    .map(function(b) { return Object.assign({}, b, { remaining: b.hoursRemaining != null ? b.hoursRemaining : b.hoursOriginal }); })
    .sort(function(a, b) { return a.dateEarned.localeCompare(b.dateEarned); });

  // Non-opening-balance comp blocks earned on or before asOf aren't added as accrual
  // events, but their hours also aren't in profile.balances.hours.comp. Seed them now
  // so FIFO deduction stays consistent.
  compBlocks.forEach(function(b) {
    if (b.isOpeningBalance) return;
    if (RC.parseDate(b.dateEarned) <= asOf) bal.comp = (bal.comp || 0) + b.remaining;
  });

  const events = [];

  // 1. Accrual events
  const payPeriods = RC.generatePayPeriods(profile.settings, asOf, target);

  payPeriods.forEach(function(ppStart) {
    const accrualDate = RC.getAccrualDate(ppStart, profile.settings);
    if (accrualDate <= asOf || accrualDate > target) return;

    const isLastPP = RC.isLastPayPeriodOfLeaveYear(ppStart, profile.settings);

    ['vacation', 'sick'].forEach(function(ltId) {
      let rate = RC.resolveAccrualRate(profile, ltId, ppStart);
      if (rate <= 0) return;

      // Federal bonus: 3–15 yr tier gets +4 in the last PP of the leave year
      if (ltId === 'vacation' && profile.settings.employerPreset === 'us_federal' && isLastPP && rate === 6) {
        rate += 4;
      }

      events.push({ date: accrualDate, priority: 1, kind: 'accrual', leaveTypeId: ltId, hours: rate });
    });
  });

  // 2. Stored transactions (actual + planned — no distinction in the engine)
  profile.transactions.forEach(function(tx) {
    const txDate = RC.parseDate(tx.date);
    if (txDate <= asOf || txDate > target) return;
    events.push({ date: txDate, priority: 2, kind: 'transaction', tx: tx });
  });

  // 3. Use-or-lose boundaries
  for (let uolDate = RC.getNextUseOrLoseBoundary(profile, asOf); uolDate <= target; uolDate = RC.getNextUseOrLoseBoundary(profile, uolDate)) {
    events.push({ date: uolDate, priority: 4, kind: 'useOrLose' });
  }

  // 4. Comp block earnings (hours credited when a block is earned, after asOf)
  compBlocks.forEach(function(block) {
    const earnedDate = RC.parseDate(block.dateEarned);
    if (earnedDate <= asOf || earnedDate > target) return;
    events.push({ date: earnedDate, priority: 1, kind: 'compEarned', blockId: block.id, hours: block.hoursOriginal });
  });

  // 5. Comp block expirations
  compBlocks.forEach(function(block) {
    if (!block.expiresOn) return;
    const expDate = RC.parseDate(block.expiresOn);
    if (expDate <= asOf || expDate > target) return;
    events.push({ date: expDate, priority: 3, kind: 'compExpiry', blockId: block.id });
  });

  // Sort: by date, then priority
  events.sort(function(a, b) {
    const diff = a.date - b.date;
    return diff !== 0 ? diff : a.priority - b.priority;
  });

  // Apply events
  events.forEach(function(ev) {
    if (ev.kind === 'accrual' || ev.kind === 'compEarned') {
      const ltId = ev.leaveTypeId || 'comp';
      bal[ltId] = (bal[ltId] || 0) + ev.hours;

    } else if (ev.kind === 'transaction') {
      const tx    = ev.tx;
      const debit = ['used','forfeited','expired'].includes(tx.action);
      const sign  = debit ? -1 : 1;

      if (tx.leaveTypeId === 'comp' && debit) {
        let toDeduct = tx.hours;
        compBlocks.forEach(function(blk) {
          if (toDeduct <= 0 || blk.remaining <= 0) return;
          const expDate = blk.expiresOn ? RC.parseDate(blk.expiresOn) : null;
          if (expDate && expDate <= ev.date) return;
          const draw = Math.min(blk.remaining, toDeduct);
          blk.remaining -= draw;
          toDeduct -= draw;
        });
        bal.comp = (bal.comp || 0) - tx.hours;
      } else {
        bal[tx.leaveTypeId] = (bal[tx.leaveTypeId] || 0) + sign * tx.hours;
      }

    } else if (ev.kind === 'compExpiry') {
      const blk = compBlocks.find(function(b) { return b.id === ev.blockId; });
      if (blk && blk.remaining > 0) {
        bal.comp = Math.max(0, (bal.comp || 0) - blk.remaining);
        blk.remaining = 0;
      }

    } else if (ev.kind === 'useOrLose') {
      if (options.ignoreUseOrLose) return;
      const limits = profile.settings.useOrLose.limits;
      Object.keys(limits).forEach(function(ltId) {
        const limit = limits[ltId];
        if (limit !== null && (bal[ltId] || 0) > limit) bal[ltId] = limit;
      });
    }
  });

  return bal;
};

// Balance history for charting: array of { date, balances }
RC.getBalanceHistory = function(profile, startDate, endDate, stepDays) {
  stepDays = stepDays || 7;
  const start   = startDate instanceof Date ? startDate : RC.parseDate(startDate);
  const end     = endDate   instanceof Date ? endDate   : RC.parseDate(endDate);
  const points  = [];
  let   current = new Date(start);
  while (current <= end) {
    points.push({ date: RC.formatDate(current), balances: RC.calculateBalance(profile, current) });
    current = RC.addDays(current, stepDays);
  }
  const lastFormatted = RC.formatDate(RC.addDays(current, -stepDays));
  if (lastFormatted !== RC.formatDate(end)) {
    points.push({ date: RC.formatDate(end), balances: RC.calculateBalance(profile, end) });
  }
  return points;
};

// Annotate comp blocks with status + estimated remaining hours at referenceDate
RC.annotateCompBlocks = function(profile, referenceDate) {
  const ref        = referenceDate instanceof Date ? referenceDate : RC.parseDate(referenceDate);
  const warnDays   = profile.settings.compExpirationWarningDays || 30;
  const asOf       = RC.parseDate(profile.balances.asOfDate);
  const currentBal = RC.calculateBalance(profile, ref);
  let   remaining  = Math.max(0, currentBal.comp || 0);

  const sorted = profile.compBlocks
    .filter(function(b) {
      const earned   = RC.parseDate(b.dateEarned);
      const expires  = b.expiresOn ? RC.parseDate(b.expiresOn) : null;
      return earned <= ref && (!expires || expires > asOf);
    })
    .sort(function(a, b) { return a.dateEarned.localeCompare(b.dateEarned); });

  return sorted.map(function(block) {
    const expDate        = block.expiresOn ? RC.parseDate(block.expiresOn) : null;
    const daysUntilExpiry = expDate ? RC.daysBetween(ref, expDate) : null;
    const attributed     = Math.min(remaining, block.hoursOriginal);
    remaining -= attributed;

    let status = 'active';
    if (expDate && expDate <= ref) {
      status = 'expired';
    } else if (daysUntilExpiry !== null && daysUntilExpiry <= warnDays) {
      status = 'expiring';
    }

    return Object.assign({}, block, { hoursRemaining: attributed, daysUntilExpiry: daysUntilExpiry, status: status });
  });
};

// Use-or-lose risk at the next applicable boundary
RC.getUseOrLoseRisk = function(profile, referenceDate) {
  const ref  = referenceDate instanceof Date ? referenceDate : RC.parseDate(referenceDate);
  const { limits } = profile.settings.useOrLose;
  const boundary = RC.getNextUseOrLoseBoundary(profile, ref);

  const projectedBal = RC.calculateBalance(profile, boundary, { ignoreUseOrLose: true });
  const risks = {};
  Object.keys(limits).forEach(function(ltId) {
    const limit = limits[ltId];
    if (limit === null) return;
    const projected = projectedBal[ltId] || 0;
    risks[ltId] = {
      projectedBalance:   projected,
      limit:              limit,
      atRisk:             Math.max(0, projected - limit),
      boundaryDate:       RC.formatDate(boundary),
      daysUntilBoundary:  RC.daysBetween(ref, boundary)
    };
  });
  return risks;
};

// Comp blocks expiring within the warning window
RC.getExpiringCompBlocks = function(profile, referenceDate) {
  return RC.annotateCompBlocks(profile, referenceDate)
    .filter(function(b) { return b.status === 'expiring' || b.status === 'expired'; })
    .sort(function(a, b) { return (a.expiresOn || '').localeCompare(b.expiresOn || ''); });
};

// Next accrual event after referenceDate
RC.getNextAccrual = function(profile, referenceDate) {
  const ref       = referenceDate instanceof Date ? referenceDate : RC.parseDate(referenceDate);
  const lookBack  = RC.addDays(ref, -31);
  const lookAhead = RC.addDays(ref, 45);
  const pps       = RC.generatePayPeriods(profile.settings, lookBack, lookAhead);
  const nextPP    = pps.find(function(ppStart) {
    return RC.getAccrualDate(ppStart, profile.settings) > ref;
  });

  if (!nextPP) return null;

  const accrualDate = RC.getAccrualDate(nextPP, profile.settings);
  return {
    date:     RC.formatDate(accrualDate),
    vacation: RC.resolveAccrualRate(profile, 'vacation', nextPP),
    sick:     RC.resolveAccrualRate(profile, 'sick', nextPP)
  };
};

// Transactions enriched with running balance for the log view
RC.enrichTransactionsWithRunningBalance = function(profile) {
  const sorted = profile.transactions.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
  return sorted.map(function(tx) {
    const balBefore = RC.calculateBalance(profile, RC.addDays(RC.parseDate(tx.date), -1));
    const sign      = ['used','forfeited','expired'].includes(tx.action) ? -1 : 1;
    const balAfter  = Object.assign({}, balBefore);
    balAfter[tx.leaveTypeId] = (balAfter[tx.leaveTypeId] || 0) + sign * tx.hours;
    return Object.assign({}, tx, { balanceAfter: balAfter });
  });
};
