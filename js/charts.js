// charts.js — Chart.js helpers
// Depends on: ui.js, accrual.js  |  Adds to window.RC namespace
// Chart.js must be loaded via <script> tag before this file

window.RC = window.RC || {};

const LEAVE_COLORS = {
  vacation: { solid:'rgb(14,165,233)',  faded:'rgba(14,165,233,0.12)'  },
  sick:     { solid:'rgb(139,92,246)',  faded:'rgba(139,92,246,0.12)'  },
  comp:     { solid:'rgb(245,158,11)',  faded:'rgba(245,158,11,0.12)'  }
};

RC.buildTimelineDatasets = function(history, todayISO) {
  const leaveTypes = ['vacation','sick','comp'];
  const labels     = history.map(function(p) { return p.date; });
  const datasets   = [];

  leaveTypes.forEach(function(lt) {
    const color    = LEAVE_COLORS[lt];
    const values   = history.map(function(p) { return +(( p.balances[lt] || 0)).toFixed(1); });
    const todayIdx = labels.findIndex(function(d) { return d > todayISO; });
    const splitIdx = todayIdx === -1 ? labels.length : todayIdx;

    const actualData    = values.map(function(v, i) { return i < splitIdx  ? v : null; });
    const projectedData = values.map(function(v, i) { return i >= splitIdx ? v : null; });
    if (splitIdx > 0 && splitIdx < values.length) {
      actualData[splitIdx]        = values[splitIdx];
      projectedData[splitIdx - 1] = values[splitIdx - 1];
    }

    const ltLabel = lt.charAt(0).toUpperCase() + lt.slice(1);
    datasets.push({
      label: ltLabel + ' (actual)',
      data: actualData, borderColor: color.solid, backgroundColor: color.faded,
      borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3, spanGaps: false
    });
    datasets.push({
      label: ltLabel + ' (projected)',
      data: projectedData, borderColor: color.solid, backgroundColor: 'transparent',
      borderWidth: 2, borderDash: [6,4], pointRadius: 0, fill: false, tension: 0.3, spanGaps: false
    });
  });

  return { labels: labels, datasets: datasets };
};

RC.timelineChartOptions = function(displayUnits) {
  const unit = displayUnits === 'days' ? 'd' : 'h';
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: {
        display: true,
        labels: {
          filter: function(item) { return !item.text.includes('projected'); },
          color: '#475569', font: { size: 12 }
        }
      },
      tooltip: {
        filter: function(ctx, index, items) {
          const baseLabel = ctx.dataset.label.split(' (')[0];
          return !items.slice(0, index).some(function(prev) {
            return prev.label === ctx.label &&
              prev.parsed.y === ctx.parsed.y &&
              prev.dataset.label.split(' (')[0] === baseLabel;
          });
        },
        callbacks: {
          title: function(ctx) { return ctx[0] ? RC.fmtDate(ctx[0].label) : ''; },
          label: function(ctx) {
            if (ctx.parsed.y === null) return null;
            return ' ' + ctx.dataset.label.split(' (')[0] + ': ' + ctx.parsed.y + ' ' + unit;
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8', maxTicksLimit: 10,
          callback: function(val) { return RC.fmtDate(this.getLabelForValue(val)); }
        },
        grid: { color: 'rgba(148,163,184,0.1)' }
      },
      y: {
        ticks: { color:'#94a3b8', callback: function(v) { return v + ' ' + unit; } },
        grid: { color:'rgba(148,163,184,0.15)' }
      }
    }
  };
};
