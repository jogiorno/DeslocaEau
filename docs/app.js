const { UFF, MODES, simplify } = Model;
const $ = s => document.querySelector(s);
const map = L.map('map', { preferCanvas: true }).setView([UFF.lat, UFF.lng], 11);
// Tiles sem chave de API. O OSM é escurecido por filtro CSS (classe .dark-tiles).
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '© OpenStreetMap contributors', maxZoom: 19, className: 'dark-tiles', opacity: 0.45 });
const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Tiles © Esri', maxZoom: 16, opacity: 0.45 });
osm.addTo(map);
L.control.layers({ 'OSM (escuro)': osm, 'Esri cinza escuro': esri }, null, { position: 'bottomleft' }).addTo(map);
// se o OSM falhar repetidamente, troca sozinho para Esri
let tileErrors = 0;
osm.on('tileerror', () => { if (++tileErrors === 6 && map.hasLayer(osm)) { map.removeLayer(osm); esri.addTo(map); } });
const tangle = L.layerGroup().addTo(map);
// Tons de vermelho: cada trajeto recebe um matiz/luminosidade próprio (estável, derivado do id).
// Sobreposições clareiam via mix-blend-mode, reforçando o emaranhado.
const redShade = seed => {
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = (350 + (h % 30)) % 360, light = 42 + ((h >> 5) % 24), sat = 85 + ((h >> 11) % 16);
  return `hsl(${hue},${sat}%,${light}%)`;
};
L.circleMarker([UFF.lat, UFF.lng], { radius: 9, color: '#fff', weight: 2, fillColor: '#ff3d71', fillOpacity: 1 })
  .bindTooltip(UFF.name, { permanent: false }).addTo(map);

const msg = t => $('#msg').textContent = t || '';
const f = $('#form');
for (let i = 1; i <= 10; i++) f.semester.add(new Option(i + 'º período', i));
for (const [k, m] of Object.entries(MODES)) f.mode.add(new Option(m.label, k));

DB.list().then(es => {
  $('#n').textContent = es.length;
  for (const e of es) for (const leg of e.legs)
    L.polyline(leg, { color: redShade(e.id), weight: 2, opacity: 0.65, interactive: false }).addTo(tangle);
}).catch(e => msg(e.message));

let home = null, work = null, workDone = false, markers = [];
const pin = (ll, color) => { const m = L.circleMarker(ll, { radius: 7, color: '#000', weight: 1, fillColor: color, fillOpacity: 1 }).addTo(map); markers.push(m); };

function refresh() {
  $('#s1').innerHTML = home ? '1. Moradia marcada ✓' : '1. Clique no mapa: <b>moradia</b>';
  $('#s2').innerHTML = workDone ? (work ? '2. Trabalho marcado ✓' : '2. Sem trabalho/estágio ✓')
    : home ? '2. Clique no mapa: <b>trabalho/estágio</b> (ou pule)' : '2. Trabalho/estágio (opcional)';
  $('#skipWork').disabled = !home || workDone;
  f.hidden = !(home && workDone);
  f.internHours.disabled = !work; if (!work) f.internHours.value = 0;
}
function setPoint(ll) {
  if (!home) { home = ll; pin(ll, '#5fd4e6'); }
  else if (!workDone) { work = ll; workDone = true; pin(ll, '#ffc857'); }
  else return;
  refresh();
}
map.on('click', e => setPoint([e.latlng.lat, e.latlng.lng]));
$('#skipWork').onclick = () => { workDone = true; refresh(); };
$('#reset').onclick = () => { home = work = null; workDone = false; markers.forEach(m => m.remove()); markers = []; msg(); refresh(); };
refresh();

// Busca de endereço (Nominatim, restrita ao RJ)
let t;
$('#q').oninput = ev => {
  clearTimeout(t); const q = ev.target.value.trim(); const box = $('#results');
  if (q.length < 3) { box.innerHTML = ''; return; }
  t = setTimeout(async () => {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&viewbox=-43.9,-22.5,-42.7,-23.2&bounded=1&q=' + encodeURIComponent(q));
    const js = await r.json(); box.innerHTML = '';
    js.forEach(x => { const b = document.createElement('button'); b.type = 'button';
      b.style.cssText = 'display:block;width:100%;text-align:left;margin-top:4px;font-size:12px';
      b.textContent = x.display_name; b.onclick = () => { map.setView([x.lat, x.lon], 15); box.innerHTML = ''; $('#q').value = ''; };
      box.appendChild(b); });
  }, 600);
};

async function route(a, b) {
  const u = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
  const r = await fetch(u); const j = await r.json();
  if (j.code !== 'Ok') throw new Error('rota não encontrada');
  const rt = j.routes[0];
  return { line: simplify(rt.geometry.coordinates.map(([x, y]) => [y, x])), km: rt.distance / 1000 };
}
const round = p => p.map(v => +v.toFixed(4));

f.onsubmit = async ev => {
  ev.preventDefault(); $('#send').disabled = true; msg('Calculando rota…');
  try {
    const H = round(home), W = work && round(work), U = [UFF.lat, UFF.lng];
    const legs = [], parts = W ? [[H, W], [W, U]] : [[H, U]]; let km = 0;
    for (const [a, b] of parts) { const r = await route(a, b); legs.push(r.line); km += r.km; }
    const body = { home: H, work: W, semester: +f.semester.value, mode: f.mode.value, internHours: +f.internHours.value,
      realMin: f.realMin.value ? +f.realMin.value : null, distKm: +km.toFixed(2), legs };
    await DB.add(body);
    legs.forEach(l => L.polyline(l, { color: redShade(Math.random()), weight: 4, opacity: 1 }).addTo(tangle));
    $('#n').textContent = +$('#n').textContent + 1;
    msg(`Enviado! ${km.toFixed(1)} km, ~${Model.oneWayMin(body)} min por trecho de ida. Com a carga do seu período, sobram ~${Model.week(body, Model.DEFAULTS).sleepAvail.toFixed(1)} h de sono por noite. Veja o dashboard.`);
    f.hidden = true; home = work = null; workDone = false; markers.forEach(m => m.remove()); markers = []; refresh();
  } catch (e) { msg('Erro: ' + e.message); }
  $('#send').disabled = false;
};
