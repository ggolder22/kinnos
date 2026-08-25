// ═══════════════════════════════════════════════════
//  Horarios — módulo compartido (login público + panel del alumno)
// ═══════════════════════════════════════════════════
const Horarios = {
  DIAS: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],

  // Devuelve las combinaciones año/división que tienen horario cargado,
  // agrupadas por año: [{ anio: 1, divisiones: ['A','B'] }, { anio: 2, divisiones: ['B'] }, ...]
  async listarCombinaciones(sb) {
    const { data, error } = await sb.from('schedules').select('anio, division');
    if (error || !data) return [];

    const porAnio = new Map();
    data.forEach(r => {
      if (!porAnio.has(r.anio)) porAnio.set(r.anio, new Set());
      if (r.division) porAnio.get(r.anio).add(r.division);
    });

    return [...porAnio.keys()].sort((a, b) => a - b).map(anio => ({
      anio,
      divisiones: [...porAnio.get(anio)].sort(),
    }));
  },

  async cargar(sb, anio, division) {
    let query = sb.from('schedules').select('*').eq('anio', anio).order('time_start');
    query = division ? query.eq('division', division) : query.is('division', null);
    const { data, error } = await query;
    if (error) return { rows: [], periodo: null, curso: null };
    return {
      rows: data || [],
      periodo: data?.[0]?.periodo || null,
      curso: data?.[0]?.curso || null,
    };
  },

  etiqueta(anio, division) {
    return `${anio}°${division ? ' ' + division : ''}`;
  },

  // Arma el HTML de la grilla semanal a partir de las filas de la tabla `schedules`
  renderTabla(rows) {
    if (!rows.length) {
      return `<div class="horario-empty-state">Todavía no hay un horario cargado para este curso.</div>`;
    }

    const dias = this.DIAS.filter(d => rows.some(r => r.day === d));

    // Bloques horarios únicos, ordenados
    const bloques = [...new Map(rows.map(r => [`${r.time_start}-${r.time_end}`, r])).values()]
      .sort((a, b) => a.time_start.localeCompare(b.time_start))
      .map(r => ({ start: r.time_start, end: r.time_end }));

    const porCelda = {};
    rows.forEach(r => { porCelda[`${r.day}|${r.time_start}`] = r; });

    const theadCols = dias.map(d => `<th>${d}</th>`).join('');

    const bodyRows = bloques.map(b => {
      const celdas = dias.map(d => {
        const r = porCelda[`${d}|${b.start}`];
        if (!r) return `<td><span class="horario-celda-vacia">—</span></td>`;
        const tag = r.is_consulta ? '<span class="horario-tag">Consulta: </span>' : '';
        return `<td>
          <div class="horario-materia${r.is_consulta ? ' consulta' : ''}">${tag}${r.subject_name}</div>
          ${r.professor_name ? `<div class="horario-profesor">${r.professor_name}</div>` : ''}
        </td>`;
      }).join('');

      return `<tr>
        <td class="horario-hora">${b.start}<br>${b.end}</td>
        ${celdas}
      </tr>`;
    }).join('');

    return `
      <div class="horario-table-scroll">
        <table class="horario-table">
          <thead><tr><th>Horario</th>${theadCols}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  },
};
