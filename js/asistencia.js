// ═══════════════════════════════════════════════════
//  Asistencia — helpers compartidos (profesor + alumno)
//  La ventana para marcar presente se deriva del cronograma:
//  arranca en el horario de inicio de la materia y dura VENTANA_MIN.
// ═══════════════════════════════════════════════════
const Asistencia = {
  UMBRAL: 70,      // % mínimo para regularizar
  VENTANA_MIN: 30, // minutos de ventana desde el inicio de la clase

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

  DIAS: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],

  // Trae los horarios de una materia desde el cronograma. No hace falta que nadie
  // los vincule a mano: primero busca un vínculo explícito (subject_id, cargado por
  // el admin para casos puntuales) y si no hay, matchea en vivo por año + nombre
  // (y división, si la materia la tiene definida).
  async cargarHorariosDeMateria(materia) {
    if (!materia?.id) return [];

    const { data: vinculados } = await sb.from('schedules').select('*').eq('subject_id', materia.id);
    if (vinculados?.length) return vinculados;

    if (!materia.name || !materia.year) return [];
    const { data: porNombre } = await sb
      .from('schedules').select('*')
      .eq('anio', materia.year)
      .ilike('subject_name', materia.name.trim());

    if (!porNombre?.length) return [];
    return materia.division
      ? porNombre.filter(r => !r.division || r.division === materia.division)
      : porNombre;
  },

  diaDeHoy() {
    return this.DIAS[new Date().getDay()];
  },

  // Nombre del día de la semana para una fecha "YYYY-MM-DD" (sin corrimiento de huso horario)
  diaDeFecha(fechaStr) {
    const [y, m, d] = fechaStr.split('-').map(Number);
    return this.DIAS[new Date(y, m - 1, d, 12).getDay()];
  },

  // horarios: filas de `schedules` ya filtradas por subject_id — puede haber varias
  // para el mismo día si la clase ocupa varios bloques seguidos; se toma la más temprana.
  _inicioDelDia(horarios, nombreDia) {
    const deEseDia = (horarios || [])
      .filter(h => h.day === nombreDia && !h.is_consulta)
      .sort((a, b) => a.time_start.localeCompare(b.time_start));
    return deEseDia[0]?.time_start || null; // "HH:MM"
  },

  // Ventana de HOY para una materia, según su cronograma. Devuelve { start, end } (Date) o null.
  ventanaDeHoy(horarios) {
    const inicio = this._inicioDelDia(horarios, this.diaDeHoy());
    if (!inicio) return null;
    const [h, m] = inicio.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0, 0);
    return { start, end: new Date(start.getTime() + this.VENTANA_MIN * 60000) };
  },

  // Ventana de una fecha pasada/futura puntual, para el profesor al revisar el historial.
  ventanaDeFecha(fechaStr, horarios) {
    const inicio = this._inicioDelDia(horarios, this.diaDeFecha(fechaStr));
    if (!inicio) return null;
    const [h, m] = inicio.split(':').map(Number);
    const [y, mo, d] = fechaStr.split('-').map(Number);
    const start = new Date(y, mo - 1, d, h, m, 0, 0);
    return { start, end: new Date(start.getTime() + this.VENTANA_MIN * 60000) };
  },

  // 'sin_clase' | 'antes' | 'abierta' | 'vencida'
  estadoVentana(ventana) {
    if (!ventana) return 'sin_clase';
    const ahora = new Date();
    if (ahora < ventana.start) return 'antes';
    if (ahora > ventana.end) return 'vencida';
    return 'abierta';
  },

  horaCorta(d) {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },

  // records: [{ status }, ...] — devuelve { pct, computadas, total } o pct null si no hay clases computables
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
