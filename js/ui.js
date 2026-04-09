// ui.js — Shared UI utilities
// Depends on: accrual.js  |  Adds to window.RC namespace

window.RC = window.RC || {};

RC.fmtHours = function(hours, profile) {
  if (hours === null || hours === undefined) return '—';
  const h = parseFloat(hours);
  if (profile && profile.settings && profile.settings.displayUnits === 'days') {
    const wh = profile.settings.workdayHours || 8;
    return (+(h / wh).toFixed(1)) + ' days';
  }
  const totalMinutes = Math.round(h * 60);
  const sign = totalMinutes < 0 ? '-' : '';
  const absMinutes = Math.abs(totalMinutes);
  const wholeHours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;
  return sign + wholeHours + ':' + String(mins).padStart(2, '0');
};

RC.fmtDate = function(dateStr) {
  if (!dateStr) return '—';
  const d = RC.parseDate(dateStr);
  return d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', timeZone:'UTC' });
};

RC.fmtDateShort = function(dateStr) {
  if (!dateStr) return '—';
  const d = RC.parseDate(dateStr);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', timeZone:'UTC' });
};

RC.ACTION_LABELS = { used:'Used', accrued:'Accrued', awarded:'Awarded', forfeited:'Forfeited', expired:'Expired' };
RC.LEAVE_TYPE_LABELS = { vacation:'Annual Leave', sick:'Sick Leave', comp:'Comp Time' };
RC.ACTION_COLORS = {
  used:'text-red-600', accrued:'text-emerald-600', awarded:'text-dark',
  forfeited:'text-orange-600', expired:'text-slate-500'
};

// Toast notifications
(function() {
  let container = null;
  RC.showToast = function(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3000;
    if (!container) {
      container = document.createElement('div');
      container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }
    const colors = { info:'bg-slate-800 text-white', success:'bg-emerald-600 text-white', warning:'bg-amber-500 text-white', error:'bg-red-600 text-white' };
    const toast  = document.createElement('div');
    toast.className = 'pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 opacity-0 ' + (colors[type] || colors.info);
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
    setTimeout(function() {
      toast.style.opacity = '0';
      setTimeout(function() { toast.remove(); }, 300);
    }, duration);
  };
})();

RC.openModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
};

RC.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
};

RC.setupModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.addEventListener('click', function(e) { if (e.target === modal) RC.closeModal(id); });
  modal.querySelectorAll('[data-modal-close]').forEach(function(btn) {
    btn.addEventListener('click', function() { RC.closeModal(id); });
  });
};

RC.progressBar = function(value, max, colorClass) {
  colorClass = colorClass || 'bg-forest';
  const pct  = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return '<div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div class="' + colorClass + ' h-2 rounded-full transition-all duration-500" style="width:' + pct + '%"></div></div>';
};

RC.requireProfile = function(profile) {
  if (!profile || !profile.balances || !profile.balances.asOfDate) {
    window.location.href = 'settings.html?setup=1';
    return false;
  }
  return true;
};
