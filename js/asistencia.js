// ═══════════════════════════════════════════════════
//  Asistencia — helpers compartidos (profesor + alumno)
// ═══════════════════════════════════════════════════
const Asistencia = {
  UMBRAL: 70, // % mínimo para regularizar

  // 'justificada' no cuenta ni a favor ni en contra: queda fuera del cálculo
  PESO: { presente: 1, tarde: 0.5, ausente: 0, justificada: null },

  LABEL: { presente: 'Presente', tarde: 'Tarde', ausente: 'Ausente', justificada: 'Justificada' },
  COLOR: { presente: 'var(--success)', tarde: '#f59e0b', ausente: 'var(--danger)', justificada: 'var(--text-3)' },
  COLOR_BG: {
    presente:    'rgba(34,197,94,.15)',
    tarde:       'rgba(245,158,11,.15)',
    ausente:     'rgba(239,68,68,.15)',
    justificada: 'rgba(100,116,139,.15)',
  },

  // records: [{ status }, ...] — devuelve { pct, computadas, total } o null si no hay clases computables
  calcular(records) {
    let computadas = 0, suma = 0, total = records.length;
    for (const r of records) {
      const w = this.PESO[r.status];
      if (w === null || w === undefined) continue;
      computadas++;
      suma += w;
    }
    if (computadas === 0) return { pct: null, computadas: 0, total };
    return { pct: Math.round((suma / computadas) * 1000) / 10, computadas, total };
  },

  badge(pct) {
    if (pct === null) return '<span class="badge badge-practice">Sin clases registradas</span>';
    const ok = pct >= this.UMBRAL;
    return ok
      ? `<span class="badge badge-active">✓ Regular — ${pct}%</span>`
      : `<span class="badge" style="background:rgba(239,68,68,.15);color:#fca5a5">⚠ Riesgo de libre — ${pct}%</span>`;
  },
};
