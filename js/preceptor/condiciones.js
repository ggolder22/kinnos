// ═══════════════════════════════════════════════════
//  Condición de materias (Regular / Promocional) — panel del preceptor
//  El profesor la carga una vez por ciclo desde Planificación; para
//  cambiarla pide autorización y la resuelve acá un preceptor.
//  La aprobación pasa por kinnos_resolver_cambio_condicion (sql/condicion-materia.sql),
//  que es lo único que puede modificar una condición ya cargada.
// ═══════════════════════════════════════════════════
const PreceptorCondiciones = {
  _materias:    [],
  _condiciones: {}, // subject_id → fila de subject_conditions
  _pendientes:  [],
  _resueltas:   [],

  async init() {
    const el = document.getElementById('condiciones-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();
    const ciclo = new Date().getFullYear();

    if (!session.inst) {
      el.innerHTML = '<div class="empty-state"><p>Tu perfil no tiene institución asignada. Pedile al administrador que te la cargue.</p></div>';
      return;
    }

    const { data: carreras } = await sb.from('careers').select('id').eq('institution_id', session.inst);
    const careerIds = (carreras || []).map(c => c.id);
    if (!careerIds.length) {
      el.innerHTML = '<div class="empty-state"><p>Tu institución todavía no tiene carreras cargadas.</p></div>';
      return;
    }

    const { data: materias } = await sb.from('subjects')
      .select('id, name, year, division, despliegue').in('career_id', careerIds);
    this._materias = materias || [];
    const ids = this._materias.map(m => m.id);

    const [{ data: conds }, { data: sols }] = ids.length ? await Promise.all([
      sb.from('subject_conditions').select('*').in('subject_id', ids).eq('anio_academico', ciclo),
      sb.from('condition_change_requests').select('*').in('subject_id', ids).eq('anio_academico', ciclo)
        .order('requested_at', { ascending: false }),
    ]) : [{ data: [] }, { data: [] }];

    this._condiciones = Object.fromEntries((conds || []).map(c => [c.subject_id, c]));
    this._pendientes = (sols || []).filter(s => s.status === 'pending');
    this._resueltas  = (sols || []).filter(s => s.status !== 'pending').slice(0, 30);
    this._pintarBadge(this._pendientes.length);
    this._render();
  },

  // Contador de pendientes en el menú (se llama al entrar al panel)
  async actualizarBadge() {
    const session = Auth.session();
    if (!session.inst) return;
    const { data: carreras } = await sb.from('careers').select('id').eq('institution_id', session.inst);
    const careerIds = (carreras || []).map(c => c.id);
    if (!careerIds.length) return;
    const { data: materias } = await sb.from('subjects').select('id').in('career_id', careerIds);
    const ids = (materias || []).map(m => m.id);
    if (!ids.length) return;
    const { count } = await sb.from('condition_change_requests')
      .select('id', { count: 'exact', head: true })
      .in('subject_id', ids).eq('status', 'pending');
    this._pintarBadge(count || 0);
  },

  _pintarBadge(n) {
    const b = document.getElementById('condiciones-badge');
    if (!b) return;
    b.textContent = n;
    b.style.display = n ? '' : 'none';
  },

  _esc(t) {
    return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  _materia(id) { return this._materias.find(m => m.id === id); },
  _curso(m)    { return m ? `${m.year ? m.year + '°' : ''}${m.division || ''}` : ''; },

  _render() {
    const el = document.getElementById('condiciones-content');
    const ciclo = new Date().getFullYear();

    const pendientesHtml = this._pendientes.length ? this._pendientes.map(s => {
      const m = this._materia(s.subject_id);
      return `
        <div class="card" style="margin-bottom:12px;padding:16px;border-color:var(--warning)">
          <div style="font-weight:600;color:var(--text-1)">${this._esc(m?.name || '—')} <span class="badge badge-indigo" style="font-size:.65rem">${this._curso(m)}</span></div>
          <div style="font-size:.85rem;color:var(--text-2);margin-top:6px">
            ${this._esc(s.requested_by_name || 'Profesor')} pide cambiar de <strong>${s.condicion_actual}</strong> a <strong>${s.condicion_nueva}</strong>
          </div>
          <div style="font-size:.82rem;color:var(--text-3);margin-top:4px">Motivo: ${this._esc(s.motivo)} · ${Utils.formatDate(s.requested_at)}</div>
          <input type="text" id="cond-resp-${s.id}" placeholder="Respuesta para el profesor (opcional)" style="margin-top:10px">
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary btn-sm" onclick="PreceptorCondiciones.resolver('${s.id}', true)">✓ Aprobar cambio</button>
            <button class="btn btn-danger btn-sm" onclick="PreceptorCondiciones.resolver('${s.id}', false)">✗ Rechazar</button>
          </div>
        </div>`;
    }).join('') : '<div style="font-size:.85rem;color:var(--text-3);margin-bottom:12px">No hay solicitudes pendientes.</div>';

    // Condición de cada materia, agrupada por curso
    const porCurso = {};
    for (const m of this._materias) (porCurso[this._curso(m) || 'Sin curso'] ??= []).push(m);
    const cursosHtml = Object.keys(porCurso).sort().map(curso => `
      <div class="card" style="padding:16px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:10px">${curso}</div>
        ${porCurso[curso].sort((a, b) => a.name.localeCompare(b.name)).map(m => {
          const c = this._condiciones[m.id];
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:.84rem">
              <span style="color:var(--text-1)">${this._esc(m.name)}</span>
              ${c
                ? `<span class="badge ${c.condicion === 'Promocional' ? 'badge-green' : 'badge-indigo'}" title="Cargada por ${this._esc(c.set_by_name || '—')} el ${Utils.formatDate(c.set_at)}">${c.condicion}</span>`
                : '<span style="font-size:.75rem;color:var(--text-3)">Sin cargar</span>'}
            </div>`;
        }).join('')}
      </div>`).join('');

    const historialHtml = this._resueltas.length ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Materia</th><th>Pedido</th><th>Profesor</th><th>Resultado</th><th>Resolvió</th></tr></thead>
          <tbody>${this._resueltas.map(s => {
            const m = this._materia(s.subject_id);
            return `<tr>
              <td class="text-main">${this._esc(m?.name || '—')} ${this._curso(m)}</td>
              <td>${s.condicion_actual} → ${s.condicion_nueva}<div style="font-size:.72rem;color:var(--text-3)">${this._esc(s.motivo)}</div></td>
              <td>${this._esc(s.requested_by_name || '—')}</td>
              <td style="color:${s.status === 'approved' ? 'var(--success)' : 'var(--danger)'};font-weight:600">${s.status === 'approved' ? '✓ Aprobado' : '✗ Rechazado'}${s.respuesta ? `<div style="font-size:.72rem;color:var(--text-3);font-weight:400">${this._esc(s.respuesta)}</div>` : ''}</td>
              <td>${this._esc(s.resolved_by_name || '—')}<div style="font-size:.72rem;color:var(--text-3)">${s.resolved_at ? Utils.formatDate(s.resolved_at) : ''}</div></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>` : '<div style="font-size:.85rem;color:var(--text-3)">Todavía no se resolvió ninguna solicitud.</div>';

    const titulo = t => `<div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin:24px 0 10px">${t}</div>`;

    el.innerHTML = `
      <div class="page-header"><h3>🔒 Condición de materias — ciclo ${ciclo}</h3></div>
      <p style="font-size:.8rem;color:var(--text-3);margin:-10px 0 8px">
        Cada profesor carga la condición (Regular o Promocional) desde la Planificación de su materia. Una vez cargada queda bloqueada:
        solo cambia si aprobás la solicitud del profesor.
      </p>
      ${titulo(`⏳ Solicitudes pendientes (${this._pendientes.length})`)}
      ${pendientesHtml}
      ${titulo('Condición de cada materia')}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">${cursosHtml}</div>
      ${titulo('Historial de solicitudes')}
      ${historialHtml}`;
  },

  async resolver(id, aprobar) {
    const s = this._pendientes.find(x => x.id === id);
    const m = this._materia(s?.subject_id);
    const pregunta = aprobar
      ? `¿Aprobar el cambio de ${s.condicion_actual} a ${s.condicion_nueva} en "${m?.name}"?`
      : `¿Rechazar el pedido de cambio en "${m?.name}"?`;
    if (!await Utils.confirmar(pregunta)) return;

    const { error } = await sb.rpc('kinnos_resolver_cambio_condicion', {
      p_request: id,
      p_aprobar: aprobar,
      p_preceptor: Auth.session().id,
      p_respuesta: document.getElementById(`cond-resp-${id}`)?.value.trim() || null,
    });
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(aprobar ? `✓ Aprobado: ahora es ${s.condicion_nueva}` : 'Solicitud rechazada');
    this.init();
  },
};
