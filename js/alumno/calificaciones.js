const AlumnoCalificaciones = {
  async init() {
    const el = document.getElementById('calificaciones-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    // Notas de exámenes rendidos en la app (solo las ya confirmadas por el profesor)
    const { data: exams } = await sb
      .from('exams')
      .select('id, title')
      .eq('subject_id', AlumnoState.materia.id);
    const examIds = (exams || []).map(e => e.id);
    const examPorId = {};
    (exams || []).forEach(e => { examPorId[e.id] = e; });

    let resultados = [];
    if (examIds.length) {
      const { data } = await sb
        .from('exam_results')
        .select('*')
        .eq('student_id', session.id)
        .eq('status', 'confirmed')
        .in('exam_id', examIds);
      resultados = data || [];
    }

    // Notas manuales (parciales en papel, conceptos) cargadas por el profesor
    const { data: items } = await sb
      .from('manual_grade_items')
      .select('*')
      .eq('subject_id', AlumnoState.materia.id);
    const itemIds = (items || []).map(i => i.id);
    const itemPorId = {};
    (items || []).forEach(i => { itemPorId[i.id] = i; });

    let notasManuales = [];
    if (itemIds.length) {
      const { data } = await sb
        .from('manual_grades')
        .select('*')
        .eq('student_id', session.id)
        .in('item_id', itemIds);
      notasManuales = (data || []).filter(n => n.score !== null || n.concepto !== null);
    }

    const filas = [
      ...resultados.map(r => {
        const finalScore = r.professor_score ?? r.score;
        return {
          tipo: 'Examen (app)',
          titulo: examPorId[r.exam_id]?.title || '—',
          nota: `${Math.round(finalScore / 10 * 10) / 10}/10`,
          fecha: r.confirmed_at,
          obs: r.professor_notes || '',
          verExamen: r.id,
        };
      }),
      ...notasManuales.map(n => {
        const item = itemPorId[n.item_id];
        return {
          tipo: 'Manual',
          titulo: item?.title || '—',
          nota: item?.tipo === 'numerica' ? `${n.score}/10` : (n.concepto || '—'),
          fecha: item?.fecha ? item.fecha + 'T00:00:00' : n.updated_at,
          obs: n.observaciones || '',
        };
      }),
    ].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

    this._render(filas);
  },

  _render(filas) {
    const el = document.getElementById('calificaciones-content');

    if (!filas.length) {
      el.innerHTML = `
        <div class="page-header"><h3>Calificaciones</h3></div>
        <div class="empty-state"><div class="icon">📋</div><p>Todavía no tenés ninguna nota confirmada en esta materia.</p></div>`;
      return;
    }

    const rows = filas.map(f => `
      <tr>
        <td>${f.titulo}</td>
        <td><span class="badge badge-inactive" style="font-size:.68rem">${f.tipo}</span></td>
        <td style="font-weight:700;color:var(--accent)">${f.nota}</td>
        <td style="font-size:.78rem;color:var(--text-3)">${f.fecha ? Utils.formatDate(f.fecha) : '—'}</td>
        <td style="font-size:.8rem;color:var(--text-2)">${f.obs || '—'}</td>
        <td>${f.verExamen ? `<button class="btn btn-ghost btn-sm" onclick="AlumnoCalificaciones._verExamen('${f.verExamen}')">Ver corrección</button>` : ''}</td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Calificaciones</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Instancia</th><th>Origen</th><th>Nota</th><th>Fecha</th><th>Observaciones</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _verExamen(resultId) {
    showTab('examenes');
    AlumnoExamenes.verResultado(resultId);
  },
};
