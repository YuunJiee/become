// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const COLORS = [
  '#c0392b', '#e74c3c', '#d35400', '#e67e22',
  '#f39c12', '#27ae60', '#16a085', '#1abc9c',
  '#2980b9', '#2c3e50', '#8e44ad', '#7f8c8d',
];

const BLOCKS_SM = 20;
const BLOCKS_LG = 30;

const TIERS = [
  { min: 0,    max: 100,  label: 'Beginner',     tier: 'beginner'     },
  { min: 100,  max: 300,  label: 'Practitioner', tier: 'practitioner' },
  { min: 300,  max: 1000, label: 'Skilled',       tier: 'skilled'      },
  { min: 1000, max: null, label: 'Expert',        tier: 'expert'       },
];


// ─── UTILS ─────────────────────────────────────────────────────────────────

const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);

function fmtDate(d) {
  const dt = new Date(d + 'T12:00:00');
  const isToday = d === today();
  if (isToday) return { label: dt.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' }), isToday: true };
  return { label: dt.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }), isToday: false };
}

function milestone(hours) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (hours >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[0];
}

function blocks(hours, n, color) {
  const t = milestone(hours);
  const progress = t.max === null
    ? 1
    : (hours - t.min) / (t.max - t.min);
  const filled = t.max === null ? n : Math.min(n, Math.round(progress * n));
  return Array.from({ length: n }, (_, i) => {
    if (i < filled - 1)                    return `<div class="bb f"></div>`;
    if (i === filled - 1 && filled > 0)    return `<div class="bb f" style="background:${color}"></div>`;
    return `<div class="bb"></div>`;
  }).join('');
}

function dispH(h) {
  return h % 1 === 0 ? h : h.toFixed(1);
}


// ─── STORAGE ───────────────────────────────────────────────────────────────

const DB = {
  skills() { try { return JSON.parse(localStorage.getItem('bec_s') || 'null'); } catch (_) { return null; } },
  logs()   { try { return JSON.parse(localStorage.getItem('bec_l') || '[]'); }  catch (_) { return []; } },
  saveS(s) { localStorage.setItem('bec_s', JSON.stringify(s)); },
  saveL(l) { localStorage.setItem('bec_l', JSON.stringify(l)); },
};

function getSkills() { return DB.skills() || []; }
function getLogs()   { return DB.logs(); }

function skillHours(id) {
  return getLogs()
    .filter(l => l.skillId === id)
    .reduce((s, l) => s + l.minutes, 0) / 60;
}

function streak() {
  const logs = getLogs();
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map(l => l.date))].sort().reverse();
  const t = today();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dates[0] !== t && dates[0] !== y) return 0;
  let n = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const d1 = new Date(dates[i] + 'T12:00:00');
    const d2 = new Date(dates[i + 1] + 'T12:00:00');
    if ((d1 - d2) / 86400000 === 1) n++;
    else break;
  }
  return n;
}


// ─── ROUTER ────────────────────────────────────────────────────────────────

function go(hash) { location.hash = hash; }

function route() {
  const h = location.hash.replace(/^#/, '') || '';
  if (!h)                    return renderHome();
  if (h === 'add')           return renderAdd(null);
  if (h.startsWith('edit/')) return renderAdd(h.slice(5));
  if (h.startsWith('skill/'))return renderSkill(h.slice(6));
  renderHome();
}

window.addEventListener('hashchange', route);


// ─── HEATMAP ───────────────────────────────────────────────────────────────

function buildHeatmap(logs) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const byDay = {};
  logs.forEach(l => { byDay[l.date] = (byDay[l.date] || 0) + l.minutes; });

  // End = today; start = Sunday of the week 52 weeks ago
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay()); // rewind to Sunday

  // Build week columns
  const weeks = [];
  const cur = new Date(start);
  while (cur <= end) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      week.push(cur > end ? null : iso);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  // Color level by minutes
  function lvl(mins) {
    if (!mins)     return '';
    if (mins < 30) return ' l1';
    if (mins < 90) return ' l2';
    return ' l3';
  }

  // Month label for each week column (show when week contains the 1st)
  const monthRow = weeks.map(week => {
    const firstReal = week.find(d => d !== null);
    if (!firstReal) return `<div class="hm-ml"></div>`;
    const dt = new Date(firstReal + 'T12:00:00');
    const label = dt.getDate() <= 7 ? MONTHS[dt.getMonth()] : '';
    return `<div class="hm-ml">${label}</div>`;
  }).join('');

  const grid = weeks.map(week =>
    `<div class="hw">${week.map(d => {
      if (!d) return `<div class="hc void"></div>`;
      const m = byDay[d] || 0;
      const tip = m ? `${d}  ${m}min` : d;
      return `<div class="hc${lvl(m)}" title="${tip}"></div>`;
    }).join('')}</div>`
  ).join('');

  return `<div class="hm-months">${monthRow}</div><div class="heatmap">${grid}</div>`;
}


// ─── HOME ──────────────────────────────────────────────────────────────────

function renderHome() {
  const skills  = getSkills();
  const logs    = getLogs();
  const todayLg = logs.filter(l => l.date === today());
  const totalH  = skills.reduce((s, sk) => s + skillHours(sk.id), 0);
  const sk_str  = streak();

  const chips = skills.map(sk => {
    const mins = todayLg.filter(l => l.skillId === sk.id).reduce((s, l) => s + l.minutes, 0);
    return mins > 0 ? `<span class="chip"><b>${sk.name}</b> ${mins}min</span>` : null;
  }).filter(Boolean).join('');

  const skOpts = skills.map(sk =>
    `<option value="${sk.id}">${sk.name}${sk.en ? ' · ' + sk.en : ''}</option>`
  ).join('');

  let skRows;
  if (skills.length === 0) {
    skRows = `<div class="empty">
      尚無技能
      <div class="empty-sub">點右上角「+ 新增技能」開始你的 100 小時旅程</div>
    </div>`;
  } else {
    skRows = skills.map(sk => {
      const h = skillHours(sk.id);
      const m = milestone(h);
      return `<div class="sk-row" onclick="go('skill/${sk.id}')">
        <div class="sk-swatch" style="background:${sk.color}"></div>
        <div class="sk-nm">${sk.name}${sk.en ? `<em class="sk-en">${sk.en}</em>` : ''}</div>
        <div class="sk-bar">${blocks(h, BLOCKS_SM, sk.color)}</div>
        <div class="sk-h">${dispH(h)}<sub>h</sub></div>
        <div class="sk-st"><span class="pill ${m.tier}">${m.label}</span></div>
        <span class="sk-arr">›</span>
      </div>`;
    }).join('');
  }

  document.getElementById('app').innerHTML = `
    <div class="view"><div class="page">
      <div class="masthead">
        <div class="masthead-top">
          <div class="brand">Be<em>come</em></div>
          <div class="mast-right">
            <span class="mast-date" id="mast-date"></span>
            <button class="txt-btn" onclick="exportData()">匯出</button>
            <label class="txt-btn" style="cursor:pointer">匯入<input type="file" accept=".json" onchange="importData(event)" style="display:none"></label>
          </div>
        </div>
        <div class="tagline">今天的 18 分鐘，是一年後的 100 小時。</div>
        <hr class="rule-thick">
      </div>

      <div class="today-wrap">
        <div class="sec-label">今日記錄</div>
        ${skills.length > 0 ? `
        <div class="log-form">
          <select class="f-select" id="log-sk">${skOpts}</select>
          <input  class="f-input f-mins" id="log-min" type="number" placeholder="分鐘" min="1" max="999">
          <input  class="f-input f-note" id="log-note" type="text" placeholder="備註（選填）" maxlength="80">
          <button class="f-btn" onclick="logTime()">→ 記錄</button>
        </div>
        ${chips ? `<div class="today-chips"><span class="chip-lbl">今日：</span>${chips}</div>` : ''}
        ` : `<div style="font-size:12px;color:var(--dim)">先新增一個技能，才能開始記錄</div>`}
      </div>

      <div class="stats-row">
        <div class="stat">
          <div class="stat-n">${dispH(totalH)}h</div>
          <div class="stat-l">Hours Logged</div>
        </div>
        <div class="stat">
          <div class="stat-n">${skills.length}</div>
          <div class="stat-l">Skills Active</div>
        </div>
        <div class="stat">
          <div class="stat-n">${sk_str > 0 ? sk_str + ' 天' : '—'}</div>
          <div class="stat-l">Day Streak</div>
        </div>
      </div>

      <div class="sec-head">
        <span class="sec-name">Skills in Progress</span>
        <button class="sec-act" onclick="go('add')">+ 新增技能</button>
      </div>

      <div>${skRows}</div>

      <div class="hm-sect">
        <div class="sec-label" style="padding-top:24px">Activity</div>
        ${buildHeatmap(logs)}
      </div>

      <div class="pg-foot">
        <span>Become — 100 Hours Project</span>
        <span>每天 18 分鐘</span>
      </div>
    </div></div>`;

  document.getElementById('mast-date').textContent =
    new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  document.getElementById('log-min')?.addEventListener('keydown',  e => { if (e.key === 'Enter') logTime(); });
  document.getElementById('log-note')?.addEventListener('keydown', e => { if (e.key === 'Enter') logTime(); });
}


// ─── SKILL DETAIL ──────────────────────────────────────────────────────────

function renderSkill(id) {
  const skills = getSkills();
  const sk = skills.find(s => s.id === id);
  if (!sk) { go(''); return; }

  const hours = skillHours(id);
  const m     = milestone(hours);
  const pct   = m.max === null ? 100 : ((hours - m.min) / (m.max - m.min) * 100).toFixed(0);

  const logs = getLogs().filter(l => l.skillId === id).sort((a, b) => b.ts - a.ts);

  const byDate = {};
  logs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = [];
    byDate[l.date].push(l);
  });

  const histHTML = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => {
    const { label, isToday } = fmtDate(date);
    const dayMins = byDate[date].reduce((s, l) => s + l.minutes, 0);
    const entries = byDate[date].map(l => `
      <div class="hist-entry">
        <span class="h-mins">${l.minutes}min</span>
        <span class="h-note">${esc(l.note || '')}</span>
        <button class="h-del" onclick="delLog('${l.id}','${id}')" title="刪除">×</button>
      </div>`).join('');
    return `<div>
      <div class="hist-date">
        <span class="${isToday ? 'today-tag' : ''}">${label}</span>
        <span style="color:var(--dim)">${dayMins}min</span>
      </div>
      ${entries}
    </div>`;
  }).join('');

  document.getElementById('app').innerHTML = `
    <div class="view"><div class="page">
      <button class="back-btn" onclick="go('')">← 返回</button>

      <div class="det-header">
        <div class="det-top">
          <div class="det-left">
            <div class="det-swatch" style="background:${sk.color}"></div>
            <div>
              <div class="det-name">${esc(sk.name)}</div>
              ${sk.en ? `<div class="det-en">${esc(sk.en)}</div>` : ''}
            </div>
          </div>
          <div class="det-acts">
            <button class="det-act" onclick="go('edit/${id}')">編輯</button>
            <button class="det-act del" onclick="delSkill('${id}')">刪除</button>
          </div>
        </div>
      </div>

      <div class="det-prog">
        <div class="det-bar">${blocks(hours, BLOCKS_LG, sk.color)}</div>
        <div class="det-nums">
          <span class="det-h">${dispH(hours)}<sub>h</sub></span>
          <span class="det-goal">
            <span class="pill ${m.tier}">${m.label}</span>
            &nbsp;
            ${m.max === null
              ? '已達頂峰'
              : `${pct}% → ${m.max}h`}
          </span>
        </div>
      </div>

      <div class="hist-wrap">
        <div class="hist-head">
          <span class="hist-ttl">歷史紀錄</span>
          <span class="hist-cnt">${logs.length} 次記錄</span>
        </div>
        ${logs.length === 0
          ? '<div class="empty">還沒有記錄<div class="empty-sub">回首頁選擇這個技能開始記錄</div></div>'
          : histHTML}
      </div>

      <div class="pg-foot">
        <span>Become</span>
        <span>${esc(sk.name)}${sk.en ? ' / ' + esc(sk.en) : ''}</span>
      </div>
    </div></div>`;
}


// ─── ADD / EDIT ─────────────────────────────────────────────────────────────

let _editId = null;
let _color  = COLORS[0];

function renderAdd(editId) {
  _editId = editId || null;
  const skills = getSkills();
  const ex = _editId ? skills.find(s => s.id === _editId) : null;
  if (_editId && !ex) { go(''); return; }
  _color = ex?.color || COLORS[0];

  document.getElementById('app').innerHTML = `
    <div class="view"><div class="page">
      <button class="back-btn" onclick="go(${_editId ? `'skill/${_editId}'` : "''"})">← 返回</button>
      <div class="add-wrap">
        <div class="add-title">${_editId ? '編輯技能' : '新增技能'}</div>

        <div class="field">
          <span class="field-lbl">顏色</span>
          <div class="color-pick-wrap">
            <div class="color-pick" id="cp" style="background:${_color}" onclick="openColor()"></div>
            <span class="color-pick-lbl" onclick="openColor()">點擊更換</span>
          </div>
        </div>

        <div class="field">
          <span class="field-lbl">名稱</span>
          <input class="field-in" id="add-name" placeholder="例：程式設計、素描" value="${esc(ex?.name || '')}" maxlength="12">
        </div>

        <div class="field">
          <span class="field-lbl">英文</span>
          <input class="field-in" id="add-en" placeholder="選填，例：Coding" value="${esc(ex?.en || '')}" maxlength="24">
        </div>

        <button class="add-btn" onclick="submitSkill()">${_editId ? '儲存變更' : '新增技能'}</button>
      </div>
    </div></div>`;

  setTimeout(() => document.getElementById('add-name')?.focus(), 50);
}


// ─── ACTIONS ───────────────────────────────────────────────────────────────

function logTime() {
  const id   = document.getElementById('log-sk')?.value;
  const mins = parseInt(document.getElementById('log-min')?.value);
  const note = document.getElementById('log-note')?.value?.trim() || '';
  if (!id || !mins || mins <= 0 || mins > 999) { toast('請選擇技能並輸入分鐘數'); return; }

  const logs = getLogs();
  logs.unshift({ id: uid(), skillId: id, minutes: mins, note, date: today(), ts: Date.now() });
  DB.saveL(logs);

  document.getElementById('log-min').value  = '';
  document.getElementById('log-note').value = '';

  const sk = getSkills().find(s => s.id === id);
  toast(`${sk?.name || ''} +${mins} 分鐘`);
  renderHome();
}

function submitSkill() {
  const name = document.getElementById('add-name')?.value?.trim();
  const en   = document.getElementById('add-en')?.value?.trim() || '';
  if (!name) { toast('請輸入技能名稱'); return; }

  const skills = getSkills();

  if (_editId) {
    const i = skills.findIndex(s => s.id === _editId);
    if (i >= 0) {
      skills[i] = { ...skills[i], name, en, color: _color };
      DB.saveS(skills);
      toast('已儲存');
      go(`skill/${_editId}`);
    }
  } else {
    skills.push({ id: uid(), name, en, color: _color, createdAt: today() });
    DB.saveS(skills);
    toast(`${name} 已新增`);
    go('');
  }
}

function delSkill(id) {
  if (!confirm('確定要刪除這個技能嗎？相關記錄也會一起刪除。')) return;
  DB.saveS(getSkills().filter(s => s.id !== id));
  DB.saveL(getLogs().filter(l => l.skillId !== id));
  toast('已刪除');
  go('');
}

function delLog(logId, skillId) {
  DB.saveL(getLogs().filter(l => l.id !== logId));
  toast('已刪除記錄');
  renderSkill(skillId);
}


// ─── EXPORT / IMPORT ───────────────────────────────────────────────────────

function exportData() {
  const data = { v: 1, exportedAt: new Date().toISOString(), skills: getSkills(), logs: getLogs() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `become-${today()}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast('備份已下載');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      if (!Array.isArray(d.skills) || !Array.isArray(d.logs)) throw new Error();
      if (!confirm('確定要匯入？現有資料將被覆蓋。')) return;
      DB.saveS(d.skills);
      DB.saveL(d.logs);
      toast('匯入成功');
      route();
    } catch (_) {
      toast('匯入失敗，請確認檔案格式');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}


// ─── COLOR PICKER ──────────────────────────────────────────────────────────

function openColor() {
  const grid = document.getElementById('color-grid');
  grid.innerHTML = COLORS.map(c => `
    <button class="c-opt${c === _color ? ' selected' : ''}"
      style="background:${c}"
      onclick="pickColor('${c}')">
    </button>`).join('');
  document.getElementById('color-modal').classList.remove('hidden');
}

function closeColor() {
  document.getElementById('color-modal').classList.add('hidden');
}

function pickColor(c) {
  _color = c;
  const cp = document.getElementById('cp');
  if (cp) cp.style.background = c;
  closeColor();
}


// ─── HELPERS ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _tt;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('on'), 2800);
}


// ─── INIT ──────────────────────────────────────────────────────────────────

route();
