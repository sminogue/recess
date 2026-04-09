// nav.js — Shared navigation
// Adds to window.RC namespace

window.RC = window.RC || {};

RC.renderNav = function() {
  const NAV_ITEMS = [
    { href:'index.html',    label:'Dashboard', icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { href:'log.html',      label:'Leave Log', icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { href:'timeline.html', label:'Timeline',  icon:'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
    { href:'comp.html',     label:'Comp Time', icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { href:'holidays.html', label:'Holidays',  icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { href:'settings.html', label:'Settings',  icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
  ];

  const BELL = '<img src="assets/recess_icon.svg" class="w-7 h-7" alt="Recess logo" />';

  const path    = window.location.pathname.split('/').pop() || 'index.html';
  const current = path === '' ? 'index.html' : path;

  function link(item) {
    const active = item.href === current;
    const cls    = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ' + (active ? 'bg-white/20 text-white font-semibold' : 'text-white/70 hover:text-white hover:bg-white/10');
    return '<a href="' + item.href + '" class="' + cls + '"><svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="' + item.icon + '"/></svg><span>' + item.label + '</span></a>';
  }

  function mlink(item) {
    const active = item.href === current;
    const cls    = 'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ' + (active ? 'bg-white/20 text-white font-semibold' : 'text-white/70 hover:text-white hover:bg-white/10');
    return '<a href="' + item.href + '" class="' + cls + '"><svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="' + item.icon + '"/></svg>' + item.label + '</a>';
  }

  const html = [
    '<header class="fixed top-0 left-0 right-0 z-50 brand-nav shadow-lg">',
    '<div class="max-w-7xl mx-auto px-4"><div class="flex items-center justify-between h-16">',
    '<a href="index.html" class="brand-logo hover:opacity-90">' + BELL + '<span class="text-xl tracking-tight">Recess</span></a>',
    '<nav class="hidden md:flex items-center gap-1">' + NAV_ITEMS.map(link).join('') + '</nav>',
    '<button id="mobile-menu-btn" class="md:hidden text-white p-2 rounded-lg hover:bg-white/10"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/></svg></button>',
    '</div></div>',
    '<div id="mobile-menu" class="md:hidden hidden brand-mobile-menu"><div class="flex flex-col py-1">' + NAV_ITEMS.map(mlink).join('') + '</div></div>',
    '</header>',
    '<div class="h-16"></div>'
  ].join('');

  const target = document.getElementById('nav-root');
  if (target) {
    target.innerHTML = html;
  } else {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.insertBefore(div, document.body.firstChild);
  }

  const btn = document.getElementById('mobile-menu-btn');
  if (btn) btn.addEventListener('click', function() {
    document.getElementById('mobile-menu').classList.toggle('hidden');
  });
};

RC.renderNav();
