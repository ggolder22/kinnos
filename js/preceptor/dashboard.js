const PreceptorDashboard = {
  async init() {
    const el = document.getElementById('dashboard-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    if (!session.inst) {
      el.innerHTML = '<div class="empty-state"><p>Tu perfil no tiene institución asignada. Pedile al administrador que te la cargue.</p></div>';
      return;
    }

    // Alumnos de la institución
    const { data: alumnos } = await sb.from('students').select('id, anio, division').eq('institution_id', session.inst);
    const alumnoPorId = {};
    (alumnos || []).forEach(a => { alumnoPorId[a.id] = a; });

    // Materias de las carreras de la institución
    const { data: carreras } = await sb.from('careers').select('id').eq('institution_id', session.inst);
    const careerIds = (carreras || []).map(c => c.id);
    let materias = [];
    if (careerIds.length) {
      const { data } = await sb.from('subjects').select('id, name').in('career_id', careerIds);
      materias = data || [];
    }
    const materiaPorId = {};
    materias.forEach(m => { materiaPorId[m.id] = m; });
    const subjectIds = materias.map(m => m.id);

    // Sesiones de asistencia de esas materias
    let sesiones = [];
    if (subjectIds.length) {
      const { data } = await sb.from('attendance_sessions').select('id, subject_id, session_date').in('subject_id', subjectIds);
      sesiones = data || [];
    }
    const sesionPorId = {};
    sesiones.forEach(s => { sesionPorId[s.id] = s; });
    const sessionIds = sesiones.map(s => s.id);

    // Registros de asistencia
    let registros = [];
    if (sessionIds.length) {
      const { data } = await sb.from('attendance_records').select('session_id, student_id, status').in('session_id', sessionIds);
      registros = data || [];
    }

    // Enriquecer cada registro con su contexto (materia, alumno, fecha)
    const enriched = registros.map(r => {
      const s = sesionPorId[r.session_id];
      const a = alumnoPorId[r.student_id];
      if (!s || !a) return null;
      return {
        status: r.status,
        materia: materiaPorId[s.subject_id]?.name || '—',
        anio: a.anio ? `${a.anio}°` : 'Sin año',
        division: a.division || 'Sin división',
        fecha: s.session_date,
      };
    }).filter(Boolean);

    this._render(alumnos || [], enriched);
  },

  _render(alumnos, enriched) {
    const el = document.getElementById('dashboard-content');

    // Alumnos por año/división
    const porAnioDiv = {};
    alumnos.forEach(a => {
      const k = `${a.anio ? a.anio + '°' : 'Sin año'} ${a.division || ''}`.trim();
      porAnioDiv[k] = (porAnioDiv[k] || 0) + 1;
    });
    const cardsAlumnos = Object.entries(porAnioDiv).sort(([x], [y]) => x.localeCompare(y)).map(([k, n]) => `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:1.4rem;font-weight:700;color:var(--text-1)">${n}</div>
        <div style="font-size:.72rem;color:var(--text-3);margin-top:2px">${k}</div>
      </div>`).join('');

    if (!enriched.length) {
      el.innerHTML = `
        <div class="page-header"><h3>Dashboard</h3></div>
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:10px">
          Alumnos (${alumnos.length}) por año y división
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:28px">${cardsAlumnos}</div>
        <div class="empty-state"><div class="icon">📊</div><p>Todavía no hay asistencia registrada en ninguna materia.</p></div>`;
      return;
    }

    const global = Asistencia.calcular(enriched);

    const tabla = (titulo, grupos) => {
      const filas = grupos.map(g => `
        <tr><td class="text-main">${g.label}</td><td style="text-align:center">${g.total}</td><td>${Asistencia.badge(g.pct)}</td></tr>`).join('');
      return `
        <div style="margin-bottom:24px">
          <div class="page-header" style="margin-bottom:8px"><h3 style="font-size:.95rem">${titulo}</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>${titulo}</th><th style="text-align:center">Clases</th><th>Asistencia</th></tr></thead>
              <tbody>${filas}</tbody>
            </table>
          </div>
        </div>`;
    };

    const agrupar = keyFn => {
      const grupos = {};
      enriched.forEach(e => {
        const k = keyFn(e);
        (grupos[k] = grupos[k] || []).push(e);
      });
      return Object.entries(grupos).map(([label, recs]) => {
        const { pct } = Asistencia.calcular(recs);
        return { label, pct, total: recs.length };
      }).sort((a, b) => a.label.localeCompare(b.label));
    };

    const porMes = (() => {
      const grupos = agrupar(e => e.fecha.slice(0, 7));
      const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return grupos.map(g => ({ ...g, label: `${nombres[parseInt(g.label.slice(5, 7)) - 1]} ${g.label.slice(0, 4)}` }));
    })();

    el.innerHTML = `
      <div class="page-header"><h3>Dashboard</h3></div>

      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:10px">
        Alumnos (${alumnos.length}) por año y división
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-bottom:24px">${cardsAlumnos}</div>

      <div class="card" style="margin-bottom:28px;text-align:center">
        <div style="font-size:.78rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:6px">Asistencia global de la institución</div>
        <div style="font-size:1.8rem;font-weight:700;color:var(--text-1)">${global.pct ?? '—'}%</div>
        <div style="font-size:.78rem;color:var(--text-3);margin-top:4px">${global.computadas} registros computados de ${global.total}</div>
      </div>

      ${tabla('Por materia',   agrupar(e => e.materia))}
      ${tabla('Por año',       agrupar(e => e.anio))}
      ${tabla('Por división',  agrupar(e => e.division))}
      ${tabla('Por día de la semana', agrupar(e => Asistencia.diaDeFecha(e.fecha)))}
      ${tabla('Por mes', porMes)}
    `;
  },
};
