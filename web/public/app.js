// Bố trí servo khớp ELECTRON_CHANNELS trong core.cpp: K 0-1, L 2-9, M 10-17, N 18-19
const SHELLS = [
  { name: 'K', start: 0,  cap: 2, r: 52,  spin: '28s' },
  { name: 'L', start: 2,  cap: 8, r: 98,  spin: '44s' },
  { name: 'M', start: 10, cap: 8, r: 144, spin: '62s' },
  { name: 'N', start: 18, cap: 2, r: 186, spin: '80s' },
];
const ELECTRON_COUNT = 20;
const STEP_MS = 40;          // SERVO_STEP_INTERVAL_MS trong firmware
const DROP_MS = 800;
const SVG_NS = 'http://www.w3.org/2000/svg';
const SUPERSCRIPT = { 1: '', 2: '²', 3: '³' };
const SUBSCRIPT = { 2: '₂', 3: '₃' };

const panels = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Logic electron (mirror firmware) ----------
function neutralTargets(el) {
  const t = new Array(ELECTRON_COUNT).fill(false);
  SHELLS.forEach((s, i) => {
    for (let k = 0; k < Math.min(el.shells[i], s.cap); k++) t[s.start + k] = true;
  });
  return t;
}

function outerShellIndex(el) {
  for (let i = 3; i >= 0; i--) if (el.shells[i] > 0) return i;
  return -1;
}

// removeOuterElectrons / addOuterElectrons trong core.cpp
function ionTargets(el, model) {
  const t = neutralTargets(el);
  const si = outerShellIndex(el);
  const s = SHELLS[si];
  let amount = el.transfer;
  if (model === 'metal') {
    for (let idx = s.start + el.shells[si] - 1; amount > 0 && idx >= s.start; idx--, amount--) t[idx] = false;
  } else {
    for (let k = 0; k < s.cap && amount > 0; k++) {
      if (!t[s.start + k]) { t[s.start + k] = true; amount--; }
    }
  }
  return t;
}

function ionShells(el, model) {
  const shells = [...el.shells];
  const si = outerShellIndex(el);
  shells[si] += model === 'metal' ? -el.transfer : el.transfer;
  return shells;
}

const ionLabel = (el, model) =>
  `${el.symbol}${SUPERSCRIPT[el.transfer]}${model === 'metal' ? '⁺' : '⁻'}`;
const configText = (shells) => shells.filter((n) => n > 0).join(', ');
const total = (shells) => shells.reduce((a, b) => a + b, 0);

// ---------- API ----------
async function api(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    toast(`Không gửi được lệnh xuống phần cứng: ${err.message}`, true);
    return null;
  }
}

// ---------- UI helpers ----------
function toast(msg, isError = false) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast${isError ? ' error' : ''}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4000);
}

function announce(msg) {
  const a = document.getElementById('announcer');
  a.textContent = '';
  requestAnimationFrame(() => { a.textContent = msg; });
}

function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function restartClass(node, ...classes) {
  node.classList.remove(...classes);
  void node.getBoundingClientRect();
  node.classList.add(...classes);
}

// ---------- Dựng mô hình SVG ----------
function buildAtom(svgEl, model) {
  const defs = svg('defs', {}, svgEl);
  const grad = svg('radialGradient', { id: `nucleusGrad-${model}`, cx: '35%', cy: '35%' }, defs);
  const color = model === 'metal' ? '#ffb547' : '#4fb3ff';
  svg('stop', { offset: '0%', 'stop-color': '#ffffff' }, grad);
  svg('stop', { offset: '45%', 'stop-color': color }, grad);
  svg('stop', { offset: '100%', 'stop-color': model === 'metal' ? '#a8521b' : '#1b4fa8' }, grad);

  for (const s of SHELLS) {
    svg('circle', { class: 'ring', r: s.r }, svgEl);
    svg('text', { class: 'ring-label', x: 4, y: -s.r - 4 }, svgEl).textContent = s.name;
  }

  const dots = [];
  for (const s of SHELLS) {
    const g = svg('g', { class: 'shell', style: `--spin:${s.spin}` }, svgEl);
    for (let k = 0; k < s.cap; k++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / s.cap;
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const x = s.r * ux, y = s.r * uy;
      svg('circle', { class: 'slot', cx: x, cy: y, r: 9 }, g);
      const e = svg('circle', { class: 'e', cx: x, cy: y, r: 9, 'data-servo': s.start + k }, g);
      e.style.setProperty('--dx', `${ux * 70}px`);
      e.style.setProperty('--dy', `${uy * 70}px`);
      dots.push(e);
    }
  }

  svg('circle', { class: 'nucleus', r: 34, fill: `url(#nucleusGrad-${model})` }, svgEl);
  const symbol = svg('text', { class: 'nuc-symbol', y: -4 }, svgEl);
  const charge = svg('text', { class: 'nuc-charge', y: 22 }, svgEl);
  const badge = svg('text', { class: 'ion-badge', x: 30, y: -30 }, svgEl);
  symbol.textContent = '?';
  return { dots, symbol, charge, badge };
}

// ---------- Panel ----------
function createPanel(model) {
  const root = document.querySelector(`.panel[data-model="${model}"]`);
  const atom = buildAtom(root.querySelector('.atom'), model);
  const p = {
    model, root, ...atom,
    picker: root.querySelector('.picker'),
    info: root.querySelector('.info'),
    btnIon: root.querySelector('.btn-ion'),
    btnReset: root.querySelector('.btn-reset'),
    state: new Array(ELECTRON_COUNT).fill(false),
    el: null,
    ionized: false,
    busy: false,
    runId: 0,
  };

  for (const el of ELEMENTS[model]) {
    const b = document.createElement('button');
    b.className = 'el-btn';
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `${el.name}, ${el.symbol}, ${el.z} electron`);
    b.dataset.z = el.z;
    b.innerHTML = `<span class="zz">${el.z}</span><span class="sym">${el.symbol}</span><span class="nm">${el.name}</span>`;
    b.addEventListener('click', () => selectElement(p, el));
    p.picker.appendChild(b);
  }
  p.btnIon.addEventListener('click', () => ionize(p));
  p.btnReset.addEventListener('click', () => resetPanel(p));
  renderInfo(p);
  panels[model] = p;
}

function setBusy(p, busy) {
  p.busy = busy;
  p.btnIon.disabled = busy || !p.el || p.ionized;
  p.btnReset.disabled = busy;
  updateBond();
}

function clearDots(p) {
  p.dots.forEach((d) => d.classList.remove('up', 'pop', 'lost', 'gained', 'stable', 'fade'));
  p.state.fill(false);
}

// Bật/tắt tuần tự từng servo như scheduler firmware
async function applyTargets(p, targets, mode) {
  const runId = p.runId;
  const changed = [];
  for (let i = 0; i < ELECTRON_COUNT; i++) {
    if (p.state[i] === targets[i]) continue;
    if (p.runId !== runId) return changed;
    const d = p.dots[i];
    if (targets[i]) {
      d.classList.remove('lost', 'fade');
      restartClass(d, 'up', mode === 'gain' ? 'gained' : 'pop');
    } else {
      d.classList.remove('up', 'pop', 'gained', 'stable');
      restartClass(d, mode === 'lose' ? 'lost' : 'fade');
    }
    p.state[i] = targets[i];
    changed.push(d);
    await sleep(STEP_MS);
  }
  return changed;
}

async function selectElement(p, el) {
  p.runId++;
  p.el = el;
  p.ionized = false;
  setBusy(p, true);

  p.picker.querySelectorAll('.el-btn').forEach((b) =>
    b.setAttribute('aria-pressed', String(Number(b.dataset.z) === el.z)));
  p.symbol.textContent = el.symbol;
  p.charge.textContent = `+${el.z}`;
  p.badge.classList.remove('show');
  clearDots(p);
  renderInfo(p);
  announce(`${el.name}, ${el.z} electron, cấu hình ${configText(el.shells)}`);

  const req = api(`/api/${p.model}/select`, { z: el.z });
  const runId = p.runId;
  await applyTargets(p, neutralTargets(el), 'pop');
  await req;
  if (p.runId === runId) setBusy(p, false);
}

async function ionize(p, { skipApi = false } = {}) {
  if (!p.el || p.ionized) return [];
  const el = p.el;
  const runId = p.runId;
  setBusy(p, true);

  const req = skipApi ? null : api(`/api/${p.model}/ion`);
  const isMetal = p.model === 'metal';
  const changed = await applyTargets(p, ionTargets(el, p.model), isMetal ? 'lose' : 'gain');
  if (p.runId !== runId) return changed;

  await sleep(isMetal ? DROP_MS : 500);
  p.ionized = true;
  // Lớp vỏ bền còn lại nhấp nháy
  p.dots.forEach((d, i) => {
    if (p.state[i] && !d.classList.contains('gained')) {
      d.classList.remove('pop');
      restartClass(d, 'stable');
    }
  });
  p.badge.textContent = `${el.transfer > 1 ? el.transfer : ''}${isMetal ? '+' : '−'}`;
  restartClass(p.badge, 'show');
  renderInfo(p);

  const shells = ionShells(el, p.model);
  announce(`${el.name} ${isMetal ? 'nhường' : 'nhận'} ${el.transfer} electron, thành ion ${ionLabel(el, p.model)}, còn ${total(shells)} electron, cấu hình bền giống khí hiếm ${NOBLE_GAS_NAMES[el.noble]}`);
  await req;
  if (p.runId === runId) setBusy(p, false);
  return changed;
}

async function resetPanel(p) {
  p.runId++;
  const runId = p.runId;
  p.el = null;
  p.ionized = false;
  setBusy(p, true);
  p.picker.querySelectorAll('.el-btn').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  p.badge.classList.remove('show');
  p.symbol.textContent = '?';
  p.charge.textContent = '';
  renderInfo(p);
  announce(`Reset mô hình ${p.model === 'metal' ? 'kim loại' : 'phi kim'}`);

  // Electron đã "lost" coi như đã hạ
  p.dots.forEach((d, i) => { if (d.classList.contains('lost')) p.state[i] = false; });
  const req = api(`/api/${p.model}/reset`);
  await applyTargets(p, new Array(ELECTRON_COUNT).fill(false), 'fade');
  await req;
  if (p.runId === runId) {
    clearDots(p);
    setBusy(p, false);
  }
}

function renderInfo(p) {
  const el = p.el;
  if (!el) {
    p.info.innerHTML = `<span class="empty">Chọn ${p.model === 'metal' ? 'một kim loại' : 'một phi kim'} để hiển thị electron.</span>`;
    return;
  }
  const isMetal = p.model === 'metal';
  const rows = [
    ['Nguyên tố', `<span class="hl">${el.name} (${el.symbol})</span>`],
    ['Số hiệu Z', `${el.z} → ${el.z} electron`],
    ['Cấu hình', `${configText(el.shells)} &nbsp;·&nbsp; lớp ngoài: ${el.shells[outerShellIndex(el)]} e`],
    ['Xu hướng', `${isMetal ? 'Nhường' : 'Nhận'} ${el.transfer} e → <span class="hl">${ionLabel(el, p.model)}</span> (${isMetal ? 'cation' : 'anion'})`],
  ];
  if (p.ionized) {
    const shells = ionShells(el, p.model);
    rows.push(['Sau ion hóa', `<span class="hl">${configText(shells)}</span> = ${total(shells)} e, giống ${NOBLE_GAS_NAMES[el.noble]} (${el.noble})`]);
  }
  p.info.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

// ---------- Liên kết ion ----------
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function formulaHtml(m, n) {
  const l = (m.transfer * n.transfer) / gcd(m.transfer, n.transfer);
  const a = l / m.transfer, b = l / n.transfer;
  return `<span class="m">${m.symbol}${SUBSCRIPT[a] || ''}</span><span class="n">${n.symbol}${SUBSCRIPT[b] || ''}</span>`;
}

function updateBond() {
  const m = panels.metal, n = panels.nonmetal;
  if (!m || !n) return;
  const formula = document.getElementById('bond-formula');
  const desc = document.getElementById('bond-desc');
  const btn = document.getElementById('btn-bond');
  btn.disabled = !m.el || !n.el || m.busy || n.busy || bondBusy;
  if (bondBusy) return;
  formula.classList.remove('done');
  if (m.el && n.el) {
    formula.innerHTML = `<span class="m">${m.el.symbol}</span> + <span class="n">${n.el.symbol}</span>`;
    desc.textContent = `${m.el.name} nhường ${m.el.transfer} e, ${n.el.name} nhận ${n.el.transfer} e.`;
  } else {
    formula.textContent = `${m.el ? m.el.symbol : '—'} + ${n.el ? n.el.symbol : '—'}`;
    desc.textContent = 'Chọn 1 kim loại và 1 phi kim để ghép thành hợp chất ion.';
  }
}

let bondBusy = false;

function flyElectrons(fromDots, targetEl) {
  const to = targetEl.getBoundingClientRect();
  const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
  return Promise.all(fromDots.map((d, i) => {
    const r = d.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'flyer';
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(f);
    const dx = tx - (r.left + r.width / 2), dy = ty - (r.top + r.height / 2);
    const anim = f.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx / 2}px, ${dy / 2 - 120}px) scale(1.4)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.2 },
    ], { duration: 1100, delay: i * 120, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    return anim.finished.then(() => f.remove());
  }));
}

async function bond() {
  const m = panels.metal, n = panels.nonmetal;
  if (!m.el || !n.el || bondBusy) return;
  bondBusy = true;
  updateBond();
  const req = api('/api/bond');

  // Chụp vị trí e lớp ngoài kim loại trước khi chúng rơi
  const outgoing = m.ionized ? [] : ionTargets(m.el, 'metal')
    .map((on, i) => (!on && m.state[i] ? m.dots[i] : null)).filter(Boolean);
  const flight = flyElectrons(outgoing, n.root.querySelector('.nucleus'));
  await ionize(m, { skipApi: true });
  await flight;
  await ionize(n, { skipApi: true });

  const formula = document.getElementById('bond-formula');
  formula.innerHTML = formulaHtml(m.el, n.el);
  restartClass(formula, 'done');
  document.getElementById('bond-desc').textContent =
    `${ionLabel(m.el, 'metal')} và ${ionLabel(n.el, 'nonmetal')} hút nhau bằng lực tĩnh điện.`;
  announce(`Liên kết ion tạo thành ${formula.textContent}`);

  const res = await req;
  if (res) setMagnet(true, false);
  bondBusy = false;
  document.getElementById('btn-bond').disabled = false;
}

// ---------- Nam châm ----------
const magnetBtn = document.getElementById('btn-magnet');
function setMagnet(on, send = true) {
  magnetBtn.setAttribute('aria-pressed', String(on));
  magnetBtn.textContent = `Nam châm: ${on ? 'BẬT' : 'TẮT'}`;
  if (send) api('/api/magnet', { on });
}
magnetBtn.addEventListener('click', () => {
  const on = magnetBtn.getAttribute('aria-pressed') !== 'true';
  setMagnet(on);
  announce(`Nam châm ${on ? 'bật' : 'tắt'}`);
});

// ---------- Trạng thái board ----------
async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    for (const model of ['metal', 'nonmetal']) {
      const node = document.getElementById(`status-${model}`);
      const s = data[model];
      node.classList.remove('online', 'offline', 'mock');
      node.classList.add(s.mock ? 'mock' : s.online ? 'online' : 'offline');
      node.title = s.mock ? 'Chế độ mô phỏng (chưa có token)' : s.online ? 'Đang kết nối' : (s.error || 'Mất kết nối');
    }
  } catch { /* server tắt: giữ nguyên */ }
}

// ---------- Init ----------
createPanel('metal');
createPanel('nonmetal');
document.getElementById('btn-bond').addEventListener('click', bond);
updateBond();
pollStatus();
setInterval(pollStatus, 15000);
