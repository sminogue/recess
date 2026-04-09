// holidays.js — Federal holiday date generation
// Adds to window.RC namespace

window.RC = window.RC || {};

function nthWeekdayOfMonth(year, month, weekday, n) {
  const first  = new Date(Date.UTC(year, month, 1));
  const day    = first.getUTCDay();
  const offset = (weekday - day + 7) % 7 + (n - 1) * 7;
  return new Date(Date.UTC(year, month, 1 + offset));
}

function lastWeekdayOfMonth(year, month, weekday) {
  const last   = new Date(Date.UTC(year, month + 1, 0));
  const day    = last.getUTCDay();
  const offset = (day - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - offset));
}

RC.getObservedDate = function(date) {
  const dow = date.getUTCDay();
  if (dow === 6) return new Date(date.getTime() - 86400000); // Sat → Fri
  if (dow === 0) return new Date(date.getTime() + 86400000); // Sun → Mon
  return date;
};

RC.HOLIDAY_DEFINITIONS = {
  NEW_YEAR:     { label: "New Year's Day",             shortLabel: "New Year's"    },
  MLK:          { label: "Martin Luther King Jr. Day", shortLabel: "MLK Day"       },
  PRESIDENTS:   { label: "Presidents' Day",            shortLabel: "Presidents'"   },
  MEMORIAL:     { label: "Memorial Day",               shortLabel: "Memorial Day"  },
  JUNETEENTH:   { label: "Juneteenth",                 shortLabel: "Juneteenth"    },
  INDEPENDENCE: { label: "Independence Day",           shortLabel: "July 4th"      },
  LABOR:        { label: "Labor Day",                  shortLabel: "Labor Day"     },
  COLUMBUS:     { label: "Columbus Day",               shortLabel: "Columbus Day"  },
  VETERANS:     { label: "Veterans Day",               shortLabel: "Veterans Day"  },
  THANKSGIVING: { label: "Thanksgiving Day",           shortLabel: "Thanksgiving"  },
  CHRISTMAS:    { label: "Christmas Day",              shortLabel: "Christmas"     }
};

const FIXED_HOLIDAYS = new Set(['NEW_YEAR','JUNETEENTH','INDEPENDENCE','VETERANS','CHRISTMAS']);

function getActualDate(key, year) {
  switch (key) {
    case 'NEW_YEAR':     return new Date(Date.UTC(year, 0,  1));
    case 'MLK':          return nthWeekdayOfMonth(year, 0,  1, 3);
    case 'PRESIDENTS':   return nthWeekdayOfMonth(year, 1,  1, 3);
    case 'MEMORIAL':     return lastWeekdayOfMonth(year, 4, 1);
    case 'JUNETEENTH':   return new Date(Date.UTC(year, 5, 19));
    case 'INDEPENDENCE': return new Date(Date.UTC(year, 6,  4));
    case 'LABOR':        return nthWeekdayOfMonth(year, 8,  1, 1);
    case 'COLUMBUS':     return nthWeekdayOfMonth(year, 9,  1, 2);
    case 'VETERANS':     return new Date(Date.UTC(year, 10, 11));
    case 'THANKSGIVING': return nthWeekdayOfMonth(year, 10, 4, 4);
    case 'CHRISTMAS':    return new Date(Date.UTC(year, 11, 25));
    default:             return null;
  }
}

RC.getHolidayDates = function(year, observedSet, customHolidays) {
  observedSet    = observedSet    || Object.keys(RC.HOLIDAY_DEFINITIONS);
  customHolidays = customHolidays || [];
  const results  = [];

  Object.keys(RC.HOLIDAY_DEFINITIONS).forEach(function(key) {
    if (!observedSet.includes(key)) return;
    const def      = RC.HOLIDAY_DEFINITIONS[key];
    const actual   = getActualDate(key, year);
    const observed = FIXED_HOLIDAYS.has(key) ? RC.getObservedDate(actual) : actual;
    results.push({
      key,
      label:        def.label,
      shortLabel:   def.shortLabel,
      date:         actual.toISOString().split('T')[0],
      observedDate: observed.toISOString().split('T')[0],
      isShifted:    observed.getTime() !== actual.getTime(),
      isCustom:     false
    });
  });

  customHolidays.forEach(function(ch) {
    if (ch.recurrence !== 'fixed') return;
    const actual   = new Date(Date.UTC(year, ch.month - 1, ch.day));
    const observed = RC.getObservedDate(actual);
    results.push({
      key:          ch.id,
      label:        ch.label,
      shortLabel:   ch.label,
      date:         actual.toISOString().split('T')[0],
      observedDate: observed.toISOString().split('T')[0],
      isShifted:    observed.getTime() !== actual.getTime(),
      isCustom:     true
    });
  });

  results.sort(function(a, b) { return a.observedDate.localeCompare(b.observedDate); });
  return results;
};

RC.getHolidayDateSet = function(year, observedSet, customHolidays) {
  return new Set(RC.getHolidayDates(year, observedSet, customHolidays).map(function(h) { return h.observedDate; }));
};
