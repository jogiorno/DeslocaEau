const { MODES, DEFAULTS, week, oneWayMin } = Model;
const $ = s => document.querySelector(s);
const A = JSON.parse(JSON.stringify(DEFAULTS));
try { Object.assign(A, JSON.parse(localStorage.getItem('eau-assump-v2') || '{}')); } catch {}
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const fmt = (n, d = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
let entries = [], charts = {};

const CATS = [['sleep', 'Sono', '#6c7ae0'], ['essentials', 'Atividades essenciais', '#8d98a8'], ['class', 'Aulas', '#ffc857'],
  ['intern', 'Estágio', '#ff9f5a'], ['study', 'Estudo extraclasse', '#c792ea'], ['commute', 'Deslocamento', '#ff5c7a'], ['free', 'Tempo livre', '#5fd4e6']];

function mk(id, cfg) {
  charts[id]?.destroy();
  Chart.defaults.font.family = "'Geist Mono', monospace"; Chart.defaults.color = css('--mute'); Chart.defaults.borderColor = css('--line');
  charts[id] = new Chart($(id), cfg);
}

function render() {
  const rows = entries.map(e => ({ e, w: week(e, A), mins: oneWayMin(e) }));
  const n = rows.length;
  const weekCommute = avg(rows.map(r => r.w.commute));
  const neg = rows.filter(r => r.w.free < 0).length;
  $('#kpis').innerHTML = [
    [n ? fmt(avg(rows.map(r => r.w.sleepAvail))) + ' h' : '–', 'sono possível por noite (média)'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepAvail < 6).length / n, 0) + '%' : '–', 'podem dormir menos de 6 h por noite'],
    [n ? fmt(100 * rows.filter(r => r.w.sleepAvail < 4).length / n, 0) + '%' : '–', 'podem dormir menos de 4 h por noite'],
    [n, 'trajetos registrados'],
    [fmt(avg(rows.map(r => r.mins)), 0) + ' min', 'tempo médio de ida'],
    [fmt(avg(entries.map(e => e.distKm))) + ' km', 'distância média de ida'],
    [fmt(weekCommute) + ' h', 'deslocamento por semana'],
    [fmt(weekCommute * 36, 0) + ' h', 'deslocamento por ano letivo (≈36 sem.)'],
    [n ? fmt(100 * neg / n, 0) + '%' : '–', 'com semana que não fecha (tempo livre < 0)'],
  ].map(([b, s]) => `<div class="card kpi"><b>${b}</b><span>${s}</span></div>`).join('');

  const byTerm = Array.from({ length: 10 }, (_, i) => rows.filter(r => r.e.semester === i + 1));
  const fixed = { sleep: A.sleepPerDay * 7, essentials: A.essentialsPerDay * 7, study: A.studyExtra };
  mk('#c1', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'),
    datasets: CATS.map(([k, l, c]) => ({ label: l, backgroundColor: c,
      data: byTerm.map((g, i) => g.length ? avg(g.map(r => r.w[k])) : (k === 'class' ? A.classByTerm[i] : fixed[k] ?? 0)) })) },
    options: { scales: { x: { stacked: true, title: { display: true, text: 'Período' } }, y: { stacked: true, max: 168, title: { display: true, text: 'horas/semana' } } },
      plugins: { legend: { position: 'bottom' } } } });

  const sl = g => g.length ? +avg(g.map(r => r.w.sleepAvail)).toFixed(1) : null;
  mk('#c5', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'), datasets: [
    { label: 'sono possível (média)', data: byTerm.map(sl), backgroundColor: byTerm.map(g => (sl(g) ?? 8) < 6 ? '#ff5c7a' : '#6c7ae0') },
    { label: 'pior caso', data: byTerm.map(g => g.length ? +Math.min(...g.map(r => r.w.sleepAvail)).toFixed(1) : null), backgroundColor: '#ffc857' },
    { type: 'line', label: 'recomendado (8 h)', data: byTerm.map(() => 8), borderColor: '#7ddc8b', borderDash: [6, 4], pointRadius: 0 }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'horas por noite' } } } } });

  const bins = Array.from({ length: 9 }, (_, i) => i * 15), lab = bins.map((b, i) => i === 8 ? '120+' : `${b}–${b + 14}`);
  const cnt = bins.map(() => 0); rows.forEach(r => cnt[Math.min(8, Math.floor(r.mins / 15))]++);
  mk('#c2', { type: 'bar', data: { labels: lab, datasets: [{ label: 'estudantes', data: cnt, backgroundColor: '#ff5c7a' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { title: { display: true, text: 'estudantes' }, ticks: { precision: 0 } } } } });

  mk('#c3', { type: 'bar', data: { labels: byTerm.map((_, i) => (i + 1) + 'º'),
    datasets: [{ label: 'média', data: byTerm.map(g => g.length ? +avg(g.map(r => r.w.free)).toFixed(1) : null), backgroundColor: '#5fd4e6' },
      { label: 'mínimo', data: byTerm.map(g => g.length ? +Math.min(...g.map(r => r.w.free)).toFixed(1) : null), backgroundColor: '#ff5c7a' }] },
    options: { plugins: { legend: { position: 'bottom' } }, scales: { y: { title: { display: true, text: 'horas livres/semana' } } } } });

  const ms = Object.keys(MODES);
  mk('#c4', { type: 'doughnut', data: { labels: ms.map(k => MODES[k].label), datasets: [{ data: ms.map(k => entries.filter(e => e.mode === k).length), backgroundColor: ms.map(k => MODES[k].color), borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'right' } } } });
}

function buildAssump() {
  const fields = [['sleepPerDay', 'Sono (h/dia)', .5], ['essentialsPerDay', 'Essenciais (h/dia)', .5], ['studyExtra', 'Extraclasse (h/sem)', 1], ['campusDays', 'Dias na UFF/sem', 1], ['freeMin', 'Lazer mínimo (h/sem)', 1]];
  $('#assump').innerHTML = fields.map(([k, l, s]) => `<div><label>${l}</label><input type="number" step="${s}" min="0" data-k="${k}" value="${A[k]}"></div>`).join('');
  $('#terms').innerHTML = A.classByTerm.map((v, i) => `<input type="number" min="0" max="40" data-t="${i}" value="${v}" title="${i + 1}º período">`).join('');
  document.querySelectorAll('[data-k]').forEach(i => i.oninput = () => { A[i.dataset.k] = +i.value; save(); });
  document.querySelectorAll('[data-t]').forEach(i => i.oninput = () => { A.classByTerm[+i.dataset.t] = +i.value; save(); });
}
function save() { try { localStorage.setItem('eau-assump-v2', JSON.stringify(A)); } catch {} render(); }

buildAssump();
DB.list({ legs: false }).then(es => { entries = es; render(); }).catch(e => { $('#kpis').innerHTML = `<div class="card">${e.message}</div>`; });
