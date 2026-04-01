/**
 * Smart Study Planner Pro — script.js
 * Clean, modular vanilla JS
 */

'use strict';

/* ════════════════════════════════════════════
   DATA & STATE
   ════════════════════════════════════════════ */

const STORAGE_KEY      = 'ssp_tasks_v2';
const SESSIONS_KEY     = 'ssp_sessions_v2';
const THEME_KEY        = 'ssp_theme';
const SETTINGS_KEY     = 'ssp_settings';

const PRIORITY_ORDER   = { high: 0, medium: 1, low: 2 };

let tasks              = loadFromStorage(STORAGE_KEY, []);
let sessions           = loadFromStorage(SESSIONS_KEY, []);  // [{date, type, minutes}]
let currentFilter      = 'all';
let currentSort        = 'newest';
let analyticsChart     = null;

/* ════════════════════════════════════════════
   QUOTES & TIPS
   ════════════════════════════════════════════ */

const QUOTES = [
  "The secret of getting ahead is getting started. — Mark Twain",
  "It always seems impossible until it's done. — Nelson Mandela",
  "Education is not the learning of facts, but the training of the mind to think. — Einstein",
  "The more that you read, the more things you will know. — Dr. Seuss",
  "Discipline is the bridge between goals and accomplishment. — Jim Rohn",
  "Success is the sum of small efforts, repeated day in and day out. — Robert Collier",
  "Focused, hard work is the real key to success. — John Carmack",
  "You don't have to be great to start, but you have to start to be great. — Zig Ziglar",
  "The expert in anything was once a beginner. — Helen Hayes",
  "Study while others are sleeping; work while others are loafing. — William A. Ward",
  "Knowledge is power. Information is liberating. — Kofi Annan",
  "An investment in knowledge pays the best interest. — Benjamin Franklin",
];

const TIPS = [
  "🍅 Use the Pomodoro Technique: 25 min focus + 5 min break cycles.",
  "📝 Break large topics into smaller, manageable tasks.",
  "🚫 Eliminate distractions — silence notifications while studying.",
  "🔄 Review notes within 24 hours to boost retention by 60%.",
  "💧 Stay hydrated. Dehydration reduces cognitive performance.",
  "😴 Sleep is critical — memories consolidate during deep sleep.",
  "🎯 Set specific goals: 'Read Chapter 3' beats 'Study Biology'.",
];

/* ════════════════════════════════════════════
   STORAGE HELPERS
   ════════════════════════════════════════════ */

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* quota exceeded — silently ignore */ }
}

/* ════════════════════════════════════════════
   TASK CRUD
   ════════════════════════════════════════════ */

function createTask({ subject, minutes, priority, note }) {
  return {
    id:        crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    subject:   subject.trim(),
    minutes:   Number(minutes),
    priority,
    note:      (note || '').trim(),
    completed: false,
    createdAt: Date.now(),
  };
}

function addTask(data) {
  const task = createTask(data);
  tasks.unshift(task);
  saveToStorage(STORAGE_KEY, tasks);
  renderTasks();
  updateStats();
  showToast(`✦ Task added: "${task.subject}"`);
  return task;
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveToStorage(STORAGE_KEY, tasks);
  renderTasks();
  updateStats();
  if (task.completed) showToast(`✓ Completed: "${task.subject}"`);
}

function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  tasks = tasks.filter(t => t.id !== id);
  saveToStorage(STORAGE_KEY, tasks);
  renderTasks();
  updateStats();
  showToast(`🗑 Deleted: "${task.subject}"`);
}

/* ════════════════════════════════════════════
   FILTER & SORT
   ════════════════════════════════════════════ */

function getFilteredSortedTasks() {
  let list = [...tasks];

  // Filter
  switch (currentFilter) {
    case 'pending':   list = list.filter(t => !t.completed); break;
    case 'completed': list = list.filter(t =>  t.completed); break;
    case 'high':      list = list.filter(t => t.priority === 'high'); break;
  }

  // Sort
  switch (currentSort) {
    case 'oldest':   list.sort((a, b) => a.createdAt - b.createdAt); break;
    case 'priority': list.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]); break;
    case 'time':     list.sort((a, b) => b.minutes - a.minutes); break;
    default:         list.sort((a, b) => b.createdAt - a.createdAt);
  }

  return list;
}

/* ════════════════════════════════════════════
   RENDER TASKS
   ════════════════════════════════════════════ */

function renderTasks() {
  const list    = document.getElementById('taskList');
  const empty   = document.getElementById('emptyState');
  const filtered = getFilteredSortedTasks();

  list.innerHTML = '';

  if (filtered.length === 0) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  const frag   = document.createDocumentFragment();

  filtered.forEach((task, i) => {
    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority}${task.completed ? ' completed' : ''}`;
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${i * 0.04}s`;

    const timeLabel = task.minutes >= 60
      ? `${(task.minutes / 60).toFixed(1)}h`
      : `${task.minutes}m`;

    card.innerHTML = `
      <button class="task-check" data-id="${task.id}" title="${task.completed ? 'Mark pending' : 'Mark complete'}" aria-label="Toggle task completion">
        ${task.completed ? '✓' : ''}
      </button>
      <div class="task-info">
        <div class="task-subject">${escapeHtml(task.subject)}</div>
        <div class="task-meta">
          <span class="task-badge">⏱ ${timeLabel}</span>
          <span class="task-badge badge-${task.priority}">${capitalise(task.priority)}</span>
          ${task.completed ? '<span class="task-badge" style="color:var(--green);border-color:rgba(72,187,120,.3)">Done</span>' : ''}
        </div>
        ${task.note ? `<div class="task-note">📌 ${escapeHtml(task.note)}</div>` : ''}
      </div>
      <div class="task-actions">
        <button class="task-action-btn delete-btn" data-id="${task.id}" title="Delete task" aria-label="Delete task">✕</button>
      </div>
    `;

    frag.appendChild(card);
  });

  list.appendChild(frag);

  // Bind events
  list.querySelectorAll('.task-check').forEach(btn =>
    btn.addEventListener('click', () => toggleTask(btn.dataset.id))
  );
  list.querySelectorAll('.delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteTask(btn.dataset.id))
  );
}

/* ════════════════════════════════════════════
   STATS
   ════════════════════════════════════════════ */

function updateStats() {
  const total     = tasks.length;
  const done      = tasks.filter(t => t.completed).length;
  const totalMins = tasks.reduce((s, t) => s + t.minutes, 0);
  const pct       = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('statTotalVal').textContent    = total;
  document.getElementById('statDoneVal').textContent     = done;
  document.getElementById('statTimeVal').textContent     = totalMins >= 60 ? `${(totalMins / 60).toFixed(1)}h` : `${totalMins}m`;
  document.getElementById('statProgressVal').textContent = pct + '%';

  // Progress bar
  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = `${pct}% complete`;
}

/* ════════════════════════════════════════════
   POMODORO TIMER
   ════════════════════════════════════════════ */

const MODES = {
  focus: { label: 'Focus',       minutes: 25, color: 'var(--amber)' },
  short: { label: 'Short Break', minutes: 5,  color: 'var(--teal)'  },
  long:  { label: 'Long Break',  minutes: 15, color: 'var(--blue)'  },
};

const TimerState = {
  mode:        'focus',
  totalSecs:   25 * 60,
  remainSecs:  25 * 60,
  running:     false,
  intervalId:  null,
  sessionCount: loadFromStorage('ssp_pom_count', 0),
  customFocus: 25,
};

const CIRCUMFERENCE = 2 * Math.PI * 88; // ≈ 553

function timerSetMode(mode) {
  if (TimerState.running) timerStop();
  TimerState.mode = mode;
  const mins = mode === 'focus' ? TimerState.customFocus : MODES[mode].minutes;
  TimerState.totalSecs  = mins * 60;
  TimerState.remainSecs = mins * 60;
  timerRender();
}

function timerStart() {
  if (TimerState.running) return;
  TimerState.running = true;
  document.getElementById('timerStart').disabled = true;
  document.getElementById('timerPause').disabled = false;

  TimerState.intervalId = setInterval(() => {
    if (TimerState.remainSecs <= 0) {
      timerComplete();
      return;
    }
    TimerState.remainSecs--;
    timerRender();
  }, 1000);
}

function timerPause() {
  clearInterval(TimerState.intervalId);
  TimerState.running = false;
  document.getElementById('timerStart').disabled = false;
  document.getElementById('timerPause').disabled = true;
}

function timerStop() {
  clearInterval(TimerState.intervalId);
  TimerState.running = false;
  document.getElementById('timerStart').disabled = false;
  document.getElementById('timerPause').disabled = true;
}

function timerReset() {
  timerStop();
  timerSetMode(TimerState.mode);
}

function timerComplete() {
  timerStop();

  if (TimerState.mode === 'focus') {
    TimerState.sessionCount++;
    saveToStorage('ssp_pom_count', TimerState.sessionCount);
    document.getElementById('pomodoroCount').textContent = TimerState.sessionCount;

    // Log session
    sessions.push({ date: new Date().toLocaleDateString(), type: 'focus', minutes: TimerState.customFocus });
    saveToStorage(SESSIONS_KEY, sessions);
    updateAnalytics();

    showToast('🍅 Focus session complete! Time for a break.');

    const nextMode = TimerState.sessionCount % 4 === 0 ? 'long' : 'short';
    setTimeout(() => timerSetMode(nextMode), 500);
  } else {
    showToast('☕ Break over! Ready for another session?');
    setTimeout(() => timerSetMode('focus'), 500);
  }

  // Beep
  playBeep();
}

function timerRender() {
  const { remainSecs, totalSecs, mode, sessionCount } = TimerState;
  const m   = String(Math.floor(remainSecs / 60)).padStart(2, '0');
  const s   = String(remainSecs % 60).padStart(2, '0');
  const pct = 1 - (remainSecs / totalSecs);
  const offset = CIRCUMFERENCE * pct;

  document.getElementById('timerDisplay').textContent  = `${m}:${s}`;
  document.getElementById('timerSession').textContent  = `Session ${sessionCount + 1}`;
  document.getElementById('pomodoroCount').textContent = sessionCount;
  document.getElementById('nextBreak').textContent     = sessionCount % 4 === 3 ? 'Long break' : 'Short break';

  const ring = document.getElementById('ringProgress');
  ring.style.strokeDasharray  = CIRCUMFERENCE;
  ring.style.strokeDashoffset = CIRCUMFERENCE - offset;

  if (mode !== 'focus') {
    ring.classList.add('break-mode');
  } else {
    ring.classList.remove('break-mode');
  }
}

function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* AudioContext not available */ }
}

/* ════════════════════════════════════════════
   ANALYTICS CHART
   ════════════════════════════════════════════ */

function updateAnalytics() {
  // Build last-7-days data
  const days = [];
  const focusData  = [];
  const breakData  = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString();
    days.push(d.toLocaleDateString('en', { weekday: 'short' }));

    const daySessions = sessions.filter(s => s.date === key);
    const totalFocus  = daySessions.filter(s => s.type === 'focus').reduce((a, s) => a + s.minutes, 0);
    focusData.push(totalFocus);
    breakData.push(daySessions.filter(s => s.type !== 'focus').length * 5);
  }

  const isDark    = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#7a849a' : '#5a5a7a';

  if (analyticsChart) {
    analyticsChart.data.labels           = days;
    analyticsChart.data.datasets[0].data = focusData;
    analyticsChart.data.datasets[1].data = breakData;
    analyticsChart.update();
  } else {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    analyticsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [
          {
            label: 'Focus (min)',
            data: focusData,
            backgroundColor: 'rgba(240,180,41,0.75)',
            borderColor: '#f0b429',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Break (min)',
            data: breakData,
            backgroundColor: 'rgba(79,209,197,0.4)',
            borderColor: '#4fd1c5',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } } },
          tooltip: {
            backgroundColor: '#151b28',
            borderColor: 'rgba(240,180,41,0.3)',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono' },
            bodyFont:  { family: 'JetBrains Mono' },
          },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }, beginAtZero: true },
        },
      },
    });
  }

  // Summary tiles
  const totalFocusMins   = sessions.filter(s => s.type === 'focus').reduce((a, s) => a + s.minutes, 0);
  const todaySessions    = sessions.filter(s => s.date === today.toLocaleDateString());
  const todayMins        = todaySessions.filter(s => s.type === 'focus').reduce((a, s) => a + s.minutes, 0);
  const weekFocus        = focusData.reduce((a, v) => a + v, 0);

  document.getElementById('analyticsSummary').innerHTML = `
    <div class="analytics-item">
      <div class="a-val">${TimerState.sessionCount}</div>
      <div class="a-label">Total sessions</div>
    </div>
    <div class="analytics-item">
      <div class="a-val">${totalFocusMins >= 60 ? (totalFocusMins/60).toFixed(1)+'h' : totalFocusMins+'m'}</div>
      <div class="a-label">All-time focus</div>
    </div>
    <div class="analytics-item">
      <div class="a-val">${todayMins}m</div>
      <div class="a-label">Today</div>
    </div>
    <div class="analytics-item">
      <div class="a-val">${weekFocus}m</div>
      <div class="a-label">This week</div>
    </div>
  `;
}

/* ════════════════════════════════════════════
   THEME TOGGLE
   ════════════════════════════════════════════ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '◑' : '○';
  saveToStorage(THEME_KEY, theme);
  // Rebuild chart with new colors
  if (analyticsChart) {
    analyticsChart.destroy();
    analyticsChart = null;
    updateAnalytics();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ════════════════════════════════════════════
   QUOTES
   ════════════════════════════════════════════ */

let quoteIndex = 0;

function showQuote() {
  const el = document.getElementById('quoteText');
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = '';
  el.textContent = QUOTES[quoteIndex];
  quoteIndex = (quoteIndex + 1) % QUOTES.length;
}

/* ════════════════════════════════════════════
   TIPS
   ════════════════════════════════════════════ */

function renderTips() {
  const ul = document.getElementById('tipsList');
  ul.innerHTML = TIPS.map(t => `<li>${t}</li>`).join('');
}

/* ════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════ */

let toastTimeout;

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ════════════════════════════════════════════
   EVENT BINDING
   ════════════════════════════════════════════ */

function bindEvents() {
  // ── Add task ──
  document.getElementById('addTaskBtn').addEventListener('click', () => {
    const subject  = document.getElementById('subjectInput').value.trim();
    const minutes  = parseInt(document.getElementById('timeInput').value) || 25;
    const priority = document.getElementById('priorityInput').value;
    const note     = document.getElementById('noteInput').value;

    if (!subject) {
      showToast('⚠ Please enter a subject name.');
      document.getElementById('subjectInput').focus();
      return;
    }

    addTask({ subject, minutes, priority, note });

    // Clear form
    document.getElementById('subjectInput').value = '';
    document.getElementById('timeInput').value    = '';
    document.getElementById('noteInput').value    = '';
    document.getElementById('priorityInput').value = 'medium';
  });

  // ── Enter key on subject input ──
  document.getElementById('subjectInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('addTaskBtn').click();
  });

  // ── Filter buttons ──
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  // ── Sort ──
  document.getElementById('sortSelect').addEventListener('change', e => {
    currentSort = e.target.value;
    renderTasks();
  });

  // ── Timer buttons ──
  document.getElementById('timerStart').addEventListener('click', timerStart);
  document.getElementById('timerPause').addEventListener('click', timerPause);
  document.getElementById('timerReset').addEventListener('click', timerReset);

  // ── Timer mode tabs ──
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      timerSetMode(tab.dataset.mode);
    });
  });

  // ── Custom focus duration ──
  document.getElementById('applyCustom').addEventListener('click', () => {
    const val = parseInt(document.getElementById('customFocus').value);
    if (val >= 1 && val <= 120) {
      TimerState.customFocus = val;
      if (TimerState.mode === 'focus') {
        timerSetMode('focus');
        showToast(`⏱ Focus timer set to ${val} minutes`);
      }
    }
  });

  // ── Theme toggle ──
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // ── Quote ──
  document.getElementById('quoteBtn').addEventListener('click', showQuote);

  // Rotate quote every 30 seconds automatically
  setInterval(showQuote, 30000);
}

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */

function init() {
  // Restore theme
  const savedTheme = loadFromStorage(THEME_KEY, 'dark');
  applyTheme(savedTheme);

  // Restore pomodoro count
  TimerState.sessionCount = loadFromStorage('ssp_pom_count', 0);

  // Render
  renderTasks();
  updateStats();
  timerRender();
  renderTips();
  showQuote();
  updateAnalytics();

  // Bind events
  bindEvents();

  console.log('%c📚 Smart Study Planner Pro', 'color:#f0b429;font-size:1.2rem;font-family:monospace;font-weight:bold;');
  console.log('%cLoaded successfully. Study hard! 🚀', 'color:#4fd1c5;font-family:monospace;');
}

// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
