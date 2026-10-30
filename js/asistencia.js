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

  // Devuelve { reason } si ese día está cerrado para esta materia (feriado o
  // suspensión cargada por un preceptor), o null si es un día normal. Una
  // declaración "toda la institución" (anio y division en NULL) afecta a
  // cualquier materia; una declaración acotada a un año/división solo afecta
  // a las materias de ESE año/división — materiaAnio/materiaDivision son los
  // de la propia materia, no del alumno (una materia es de un solo curso).
  async diaSinClases(institutionId, fechaStr, materiaAnio = null, materiaDivision = null) {
    if (!institutionId) return null;
    const { data } = await sb.from('no_class_days').select('reason, anio, division, day_date')
      .eq('institution_id', institutionId).eq('day_date', fechaStr);
    return this._matchDiaSinClases(data || [], materiaAnio, materiaDivision);
  },

  // Trae TODOS los días sin clase de una institución en una sola consulta —
  // para revisar muchas fechas (ej. el historial completo de una materia)
  // sin hacer una consulta por fecha. Se usa junto con _matchDiaSinClases.
  async diasSinClasesDeInstitucion(institutionId) {
    if (!institutionId) return [];
    const { data } = await sb.from('no_class_days').select('reason, anio, division, day_date')
      .eq('institution_id', institutionId);
    return data || [];
  },

  _matchDiaSinClases(dias, materiaAnio, materiaDivision, fechaStr = null) {
    const match = dias.find(r =>
      (fechaStr === null || r.day_date === fechaStr) &&
      (r.anio === null || r.anio === materiaAnio) &&
      (r.division === null || r.division === materiaDivision)
    );
    return match ? { reason: match.reason } : null;
  },

  // Trae los horarios de una materia desde el cronograma. Cada materia es de una
  // sola división (1°A y 1°B son materias distintas, con otros días y profesores),
  // así que solo se usan bloques de ESA división — nunca los de la otra.
  // Junta el vínculo explícito (subject_id) con los bloques sueltos que coinciden
  // por año + división + nombre, para que un vínculo parcial no deje días afuera.
  async cargarHorariosDeMateria(materia) {
    if (!materia?.id) return [];

    const { data: vinculados } = await sb.from('schedules').select('*').eq('subject_id', materia.id);

    let porNombre = [];
    if (materia.name && materia.year) {
      const { data } = await sb
        .from('schedules').select('*')
        .is('subject_id', null)
        .eq('anio', materia.year)
        .ilike('subject_name', materia.name.trim());
      porNombre = data || [];
    }

    const deMiDivision = r => !materia.division || r.division === materia.division;
    const todos = [...(vinculados || []), ...porNombre].filter(deMiDivision);

    // El mismo bloque puede estar cargado dos veces en el cronograma
    return [...new Map(todos.map(r => [`${r.day}|${r.time_start}|${r.is_consulta}`, r])).values()];
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
