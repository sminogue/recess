// store.js — Data model, localStorage, import/export
// Adds to window.RC namespace

window.RC = window.RC || {};

const STORAGE_KEY = 'recess_data';
const VERSION = '1.0';

RC.generateId = function() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
};

RC.todayISO = function() {
  return new Date().toISOString().split('T')[0];
};

RC.createDefaultProfile = function(name) {
  name = name || 'My Profile';
  return {
    id: RC.generateId(),
    displayName: name,
    settings: {
      employerPreset: 'us_federal',
      workdayHours: 8,
      displayUnits: 'hours',
      payPeriod: {
        frequency: 'biweekly',
        anchorDate: '2026-01-11',
        accrualTiming: 'end'
      },
      serviceInceptDate: null,
      accrualOverrides: [],
      useOrLose: {
        boundaryMonth: 12,
        boundaryDay: 31,
        limits: { vacation: 240, sick: null, comp: null }
      },
      compExpirationWarningDays: 30,
      holidays: {
        observedSet: [
          'NEW_YEAR','MLK','PRESIDENTS','MEMORIAL','JUNETEENTH',
          'INDEPENDENCE','LABOR','COLUMBUS','VETERANS','THANKSGIVING','CHRISTMAS'
        ],
        customHolidays: []
      }
    },
    balances: { asOfDate: null, hours: { vacation: 0, sick: 0, comp: 0 } },
    transactions: [],
    compBlocks: []
  };
};

RC.loadData = function() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
};

RC.saveData = function(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

RC.getProfile = function() {
  const data = RC.loadData();
  return data ? data.profile : null;
};

RC.saveProfile = function(profile) {
  const data = RC.loadData() || { version: VERSION };
  data.profile = profile;
  RC.saveData(data);
};

RC.isFirstRun = function() {
  return RC.loadData() === null;
};

RC.exportJSON = function() {
  const data = RC.loadData();
  if (!data) return;
  const exportData = {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    profile: data.profile
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'recess-export-' + RC.todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

RC.importJSON = function(jsonString) {
  const parsed = JSON.parse(jsonString);
  if (!parsed.profile) throw new Error('Invalid Recess export file — missing profile data.');
  const data = { version: parsed.version || VERSION, profile: parsed.profile };
  RC.saveData(data);
  return data.profile;
};

RC.clearAllData = function() {
  localStorage.removeItem(STORAGE_KEY);
};

// Transaction helpers
RC.addTransaction = function(profile, tx) {
  profile.transactions.push(Object.assign({ id: RC.generateId() }, tx));
  return profile;
};

RC.updateTransaction = function(profile, id, updates) {
  const idx = profile.transactions.findIndex(function(t) { return t.id === id; });
  if (idx !== -1) profile.transactions[idx] = Object.assign({}, profile.transactions[idx], updates);
  return profile;
};

RC.deleteTransaction = function(profile, id) {
  profile.transactions = profile.transactions.filter(function(t) { return t.id !== id; });
  return profile;
};

// Comp block helpers
RC.addCompBlock = function(profile, block) {
  profile.compBlocks.push(Object.assign({ id: RC.generateId() }, block));
  return profile;
};

RC.updateCompBlock = function(profile, id, updates) {
  const idx = profile.compBlocks.findIndex(function(b) { return b.id === id; });
  if (idx !== -1) profile.compBlocks[idx] = Object.assign({}, profile.compBlocks[idx], updates);
  return profile;
};

RC.deleteCompBlock = function(profile, id) {
  profile.compBlocks = profile.compBlocks.filter(function(b) { return b.id !== id; });
  return profile;
};

RC.BUILT_IN_LEAVE_TYPES = [
  { id: 'vacation', label: 'Annual Leave', color: 'sky'    },
  { id: 'sick',     label: 'Sick Leave',   color: 'violet' },
  { id: 'comp',     label: 'Comp Time',    color: 'amber'  }
];

RC.getLeaveTypeLabel = function(profile, id) {
  const builtin = RC.BUILT_IN_LEAVE_TYPES.find(function(t) { return t.id === id; });
  if (builtin) return builtin.label;
  return id;
};

RC.getWorkdayHours = function(profile) {
  return (profile && profile.settings && profile.settings.workdayHours) || 8;
};

RC.isWeekend = function(date) {
  const d = date instanceof Date ? date : RC.parseDate(date);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
};

RC.getHolidayDateSetForRange = function(profile, startDate, endDate) {
  const start = startDate instanceof Date ? startDate : RC.parseDate(startDate);
  const end = endDate instanceof Date ? endDate : RC.parseDate(endDate);
  const observedSet = (((profile || {}).settings || {}).holidays || {}).observedSet || [];
  const customHolidays = (((profile || {}).settings || {}).holidays || {}).customHolidays || [];
  const years = new Set();
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year++) years.add(year);
  const dates = new Set();
  years.forEach(function(year) {
    RC.getHolidayDates(year, observedSet, customHolidays).forEach(function(h) {
      dates.add(h.observedDate);
    });
  });
  return dates;
};

RC.getBusinessDatesInRange = function(profile, startDate, endDate) {
  const start = startDate instanceof Date ? startDate : RC.parseDate(startDate);
  const end = endDate instanceof Date ? endDate : RC.parseDate(endDate);
  const holidays = RC.getHolidayDateSetForRange(profile, start, end);
  const dates = [];
  for (let current = new Date(start); current <= end; current = RC.addDays(current, 1)) {
    const iso = RC.formatDate(current);
    if (RC.isWeekend(current)) continue;
    if (holidays.has(iso)) continue;
    dates.push(iso);
  }
  return dates;
};

RC.expandEntryDraft = function(profile, draft, options) {
  options = options || {};
  const isEdit = !!options.isEdit;
  const startDate = draft.startDate || draft.date;
  const endDate = draft.endDate || draft.date;
  const baseTx = Object.assign({}, draft);
  delete baseTx.startDate;
  delete baseTx.endDate;

  if (!startDate) throw new Error('Enter a valid start date.');
  if (!draft.hours || draft.hours <= 0) throw new Error('Enter valid hours.');

  if (isEdit || !endDate || endDate <= startDate || draft.action !== 'used') {
    return [Object.assign({}, baseTx, { date: startDate })];
  }

  const businessDates = RC.getBusinessDatesInRange(profile, startDate, endDate);
  if (!businessDates.length) {
    throw new Error('No workdays found in that range after skipping weekends and holidays.');
  }

  const rangeGroupId = RC.generateId();
  const totalHours = businessDates.length * draft.hours;

  return businessDates.map(function(date) {
    return Object.assign({}, baseTx, {
      date: date,
      rangeGroupId: rangeGroupId,
      rangeStart: businessDates[0],
      rangeEnd: businessDates[businessDates.length - 1],
      rangeEntryCount: businessDates.length,
      rangeTotalHours: totalHours
    });
  });
};
