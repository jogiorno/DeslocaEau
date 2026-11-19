// Acesso ao Supabase via REST (sem SDK).
window.DB = (() => {
  const C = window.CONFIG || {};
  const ok = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  // Chaves novas (sb_publishable_...) não são JWT: só o cabeçalho apikey; chaves antigas (eyJ...) também aceitam Bearer.
  const H = { apikey: C.SUPABASE_ANON_KEY };
  if (/^eyJ/.test(C.SUPABASE_ANON_KEY || '')) H.Authorization = 'Bearer ' + C.SUPABASE_ANON_KEY;
  const url = p => C.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/entries' + p;
  const fromRow = r => ({ id: r.id, home: r.home, work: r.work, semester: r.semester, mode: r.mode,
    internHours: r.intern_hours, realMin: r.real_min, distKm: +r.dist_km, legs: r.legs || [] });

  // Lê em páginas de 500 (o limite padrão do Supabase é 1000 por requisição).
  async function list({ legs = true } = {}) {
    if (!ok) throw new Error('Banco não configurado (docs/config.js).');
    const cols = 'id,home,work,semester,mode,intern_hours,real_min,dist_km' + (legs ? ',legs' : '');
    const out = [];
    for (let off = 0; ; off += 500) {
      const r = await fetch(url(`?select=${cols}&order=created_at&limit=500&offset=${off}`), { headers: H });
      if (!r.ok) throw new Error('Falha ao ler trajetos (' + r.status + ')');
      const rows = await r.json(); out.push(...rows.map(fromRow));
      if (rows.length < 500) return out;
    }
  }

  async function add(b) {
    if (!ok) throw new Error('Banco não configurado (docs/config.js).');
    const r = await fetch(url(''), { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ home: b.home, work: b.work, semester: b.semester, mode: b.mode, intern_hours: b.internHours,
        real_min: b.realMin, dist_km: b.distKm, legs: b.legs }) });
    if (!r.ok) throw new Error('Falha ao enviar (' + r.status + ')');
  }
  return { list, add, ok };
})();
