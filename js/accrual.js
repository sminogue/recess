// accrual.js — Pay period schedule generation and accrual rate resolution
// Adds to window.RC namespace; no ES module imports required

window.RC = window.RC || {};

// --- Date utilities (UTC-only to avoid DST issues) ---

RC.parseDate = function(str) {
  if (!str) return null;
  if (str instanceof Date) return str;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

RC.formatDate = function(date) {
  if (!date) return null;
  return date.toISOString().split('T')[0];
};

RC.addDays = function(date, n) {
  return new Date(date.getTime() + n * 86400000);
};

RC.daysBetween = function(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

RC.yearsBetween = function(earlier, later) {
  let years = later.getUTCFullYear() - earlier.getUTCFullYear();
  const monthDiff = later.getUTCMonth() - earlier.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && later.getUTCDate() < earlier.getUTCDate())) {
    years--;
  }
  return years;
};

RC.getPayPeriodLength = function(frequency) {
  switch (frequency) {
    case 'weekly':       return 7;
    case 'biweekly':     return 14;
    case 'semi-monthly': return null;
    case 'monthly':      return null;
    default:             return 14;
  }
};

// Returns the Date of the first pay period of the leave year for a given calendar year.
// For biweekly: smallest (anchorDate + 14n) >= Jan 1 of that year.
RC.getLeaveYearStart = function(year, settings) {
  const { anchorDate, frequency } = settings.payPeriod;
  const anchor = RC.parseDate(anchorDate);
  const jan1   = new Date(Date.UTC(year, 0, 1));

  if (frequency === 'biweekly' || frequency === 'weekly') {
    const periodLen = RC.getPayPeriodLength(frequency);
    const daysToJan1 = RC.daysBetween(anchor, jan1);
    const periodsToAdvance = Math.ceil(daysToJan1 / periodLen);
    return RC.addDays(anchor, periodsToAdvance * periodLen);
  }
  return new Date(Date.UTC(year, 0, 1));
};

// Returns array of pay period start Date objects between rangeStart and rangeEnd
RC.generatePayPeriods = function(settings, rangeStart, rangeEnd) {
  const { anchorDate, frequency } = settings.payPeriod;
  const anchor = RC.parseDate(anchorDate);
  const start  = rangeStart instanceof Date ? rangeStart : RC.parseDate(rangeStart);
  const end    = rangeEnd   instanceof Date ? rangeEnd   : RC.parseDate(rangeEnd);
  const periods = [];

  if (frequency === 'biweekly' || frequency === 'weekly') {
    const len = RC.getPayPeriodLength(frequency);
    const daysFromAnchorToStart = RC.daysBetween(anchor, start);
    let n = Math.floor(daysFromAnchorToStart / len);
    let current = RC.addDays(anchor, n * len);
    while (current > start) current = RC.addDays(current, -len);
    while (current < start) current = RC.addDays(current, len);
    while (current <= end) {
      periods.push(new Date(current));
      current = RC.addDays(current, len);
    }
    return periods;
  }

  if (frequency === 'semi-monthly') {
    let y = start.getUTCFullYear(), m = start.getUTCMonth();
    while (true) {
      for (const day of [1, 15]) {
        const d = new Date(Date.UTC(y, m, day));
        if (d < start) continue;
        if (d > end) return periods;
        periods.push(d);
      }
      m++; if (m > 11) { m = 0; y++; }
    }
  }

  if (frequency === 'monthly') {
    const anchorDay = anchor.getUTCDate();
    let y = start.getUTCFullYear(), m = start.getUTCMonth();
    while (true) {
      const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const day = Math.min(anchorDay, daysInMonth);
      const d = new Date(Date.UTC(y, m, day));
      if (d >= start && d <= end) periods.push(d);
      if (d > end) break;
      m++; if (m > 11) { m = 0; y++; }
    }
  }

  return periods;
};

// Returns the date leave accrues for a given pay period start
RC.getAccrualDate = function(ppStart, settings) {
  const { frequency, accrualTiming } = settings.payPeriod;
  if (accrualTiming !== 'end') return ppStart;
  const len = RC.getPayPeriodLength(frequency);
  if (!len) return ppStart;
  return RC.addDays(ppStart, len - 1);
};

// Returns true if this pay period is the last one of the leave year
RC.isLastPayPeriodOfLeaveYear = function(ppStart, settings) {
  const len = RC.getPayPeriodLength(settings.payPeriod.frequency);
  if (!len) return false;
  const year = ppStart.getUTCFullYear();
  const nextYearStart = RC.getLeaveYearStart(year + 1, settings);
  const nextPP = RC.addDays(ppStart, len);
  return nextPP >= nextYearStart;
};

// Federal vacation accrual rate based on years of service
RC.getFederalVacationRate = function(serviceInceptDate, ppDate) {
  if (!serviceInceptDate) return 4;
  const incept = RC.parseDate(serviceInceptDate);
  const years  = RC.yearsBetween(incept, ppDate);
  if (years < 3)  return 4;
  if (years < 15) return 6;
  return 8;
};

// Resolve accrual rate for any leave type at a specific pay period date
RC.resolveAccrualRate = function(profile, leaveTypeId, ppDate) {
  const ppDateObj = ppDate instanceof Date ? ppDate : RC.parseDate(ppDate);
  const { settings } = profile;

  const overrides = (settings.accrualOverrides || [])
    .filter(o => o.leaveTypeId === leaveTypeId && RC.parseDate(o.effectiveDate) <= ppDateObj)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  if (overrides.length > 0) return overrides[0].hoursPerPeriod;

  if (settings.employerPreset === 'us_federal') {
    if (leaveTypeId === 'vacation') return RC.getFederalVacationRate(settings.serviceInceptDate, ppDateObj);
    if (leaveTypeId === 'sick')     return 4;
    if (leaveTypeId === 'comp')     return 0;
  }

  return 0;
};
