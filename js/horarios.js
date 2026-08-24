// ═══════════════════════════════════════════════════
//  Horarios — módulo compartido (login público + panel del alumno)
// ═══════════════════════════════════════════════════
const Horarios = {
  DIAS: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],

  // Devuelve la lista de cursos que tienen horario cargado, ej: ["CENT N° 18 · 1° B"]
  async listarCursos(sb) {
    const { data, error } = await sb.from('schedules').select('curso');
    if (error || !data) return [];
    return [...new Set(data.map(r => r.curso))].sort();
  },

  async cargar(sb, curso) {
    const { data, error } = await sb
      .from('schedules')
      .select('*')
      .eq('curso', curso)
      .order('time_start');
    if (error) return { rows: [], periodo: null };
    return { rows: data || [], periodo: data?.[0]?.periodo || null };
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
