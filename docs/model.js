// Modelo compartilhado entre mapa e dashboard.
window.Model = (() => {
  // Escola de Arquitetura e Urbanismo da UFF, Rua Passo da Pátria, 156 – São Domingos, Niterói (coordenada do OSM/Nominatim).
  const UFF = { lat: -22.90464, lng: -43.13083, name: 'Escola de Arquitetura e Urbanismo – UFF (Praia Vermelha)' };

  const MODES = {
    pe:        { label: 'A pé',                     kmh: 5,   waitMin: 0,  color: '#7ddc8b' },
    bike:      { label: 'Bicicleta',                kmh: 15,  waitMin: 2,  color: '#5fd4e6' },
    onibus:    { label: 'Ônibus',                   kmh: 18,  waitMin: 7, color: '#ffc857' },
    integrado: { label: 'Barca / metrô / trem (integrado)', kmh: 24, waitMin: 10, color: '#c792ea' },
    carro:     { label: 'Carro / moto',             kmh: 30,  waitMin: 5,  color: '#ff7a7a' },
    app:       { label: 'App / carona',             kmh: 28,  waitMin: 5,  color: '#ff9f5a' },
  };

  // Fluxograma curricular UFF Arquitetura e Urbanismo (GradeCurricularR25): carga horária obrigatória por período.
  // Total obrigatório 3.825 h (+90 eletivas, +225 optativas, +160 AC = 4.300 h; não distribuídas por período).
  const TERM_HOURS = [450, 435, 465, 450, 450, 390, 405, 390, 210, 180];
  const WEEKS_PER_TERM = 15; // premissa: semanas letivas por período
  const DEFAULTS = {
    classByTerm: TERM_HOURS.map(h => +(h / WEEKS_PER_TERM).toFixed(1)), // h/semana
    sleepPerDay: 7,        // h de sono por dia
    essentialsPerDay: 3.5, // alimentação, higiene, tarefas domésticas
    studyExtra: 10,        // h/semana de trabalho extraclasse (ateliê, projetos)
    campusDays: 5,         // dias por semana na universidade
    freeMin: 10,           // h/semana de lazer/vida social que se quer preservar
  };

  // Barcas Praça XV (Rio) ↔ Arariboia (Niterói). Lado "R" = oeste da baía (Rio); "N" = Niterói/leste.
  const FERRY = { rio: [-22.8978, -43.1742], nit: [-22.8945, -43.1250] };
  const FERRY_MIN = 20; // minutos por travessia
  const side = p => p[1] < -43.155 ? 'R' : 'N';
  // Nº de travessias da baía no sentido de ida (casa → trabalho → UFF), a partir só dos pontos.
  const crossings = e => {
    const pts = [e.home, ...(e.work ? [e.work] : []), [UFF.lat, UFF.lng]];
    return pts.slice(1).filter((p, i) => side(p) !== side(pts[i])).length;
  };
  const oneWayMin = e => e.realMin ?? Math.round(e.distKm / MODES[e.mode].kmh * 60 + MODES[e.mode].waitMin
    + (e.mode === 'integrado' ? crossings(e) * FERRY_MIN : 0));

  function week(e, a) {
    const commute = oneWayMin(e) * 2 * a.campusDays / 60;
    const cls = a.classByTerm[e.semester - 1];
    const sleep = a.sleepPerDay * 7, ess = a.essentialsPerDay * 7;
    const used = commute + cls + e.internHours + sleep + ess + a.studyExtra;
    const sleepAvail = (168 - commute - cls - e.internHours - ess - a.studyExtra - a.freeMin) / 7; // h/noite
    return { sleepAvail, commute, class: cls, intern: e.internHours, sleep, essentials: ess, study: a.studyExtra, free: 168 - used };
  }

  // Redução de pontos + arredondamento (~11 m)
  function simplify(line, max = 250) {
    const step = Math.max(1, Math.ceil(line.length / max)), out = [];
    for (let i = 0; i < line.length; i += step) out.push(line[i]);
    if (out[out.length - 1] !== line[line.length - 1]) out.push(line[line.length - 1]);
    return out.map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]);
  }

  return { UFF, FERRY, FERRY_MIN, side, crossings, MODES, DEFAULTS, oneWayMin, week, simplify };
})();
