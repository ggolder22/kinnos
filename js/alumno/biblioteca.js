const AlumnoBiblioteca = {
  _ICONS: { pdf: '📄', video: '🎥', link: '🔗' },

  // ── Vista general (sidebar — toda la institución) ─────────

  abrir() {
    document.getElementById('tabs-bar').classList.add('hidden');
    document.getElementById('topbar-materia').textContent = 'Biblioteca';
    document.getElementById('topbar-sub').textContent = '';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-biblioteca-global').classList.add('active');
    this._loadGlobal();
  },

  async _loadGlobal() {
    const el = document.getElementById('biblioteca-global-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    if (!session.inst) {
      el.innerHTML = '<div class="empty-state"><p>Tu perfil no tiene institución asignada.</p></div>';
      return;
    }

    let query = sb.from('library_resources').select('*').eq('institution_id', session.inst);
    query = session.career
      ? query.or(`career_id.is.null,career_id.eq.${session.career}`)
      : query.is('career_id', null);

    const { data: recursos, error } = await query.order('created_at', { ascending: false });
    if (error) { Utils.toast('Error al cargar la biblioteca', 'error'); return; }

    await this._renderConProgreso(el, recursos || [], 'No hay recursos publicados todavía.');
  },

  // ── Vista por materia (pestaña dentro de la materia) ──────

  async init() {
    const el = document.getElementById('biblioteca-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: links, error } = await sb
      .from('library_subject_links')
      .select('library_resources(*)')
      .eq('subject_id', AlumnoState.materia.id);

    if (error) { Utils.toast('Error al cargar la biblioteca', 'error'); return; }
    const recursos = (links || []).map(l => l.library_resources).filter(Boolean);
    await this._renderConProgreso(el, recursos, 'No hay recursos vinculados a esta materia.');
  },

  // ── Render compartido ──────────────────────────────────────

  async _renderConProgreso(el, recursos, mensajeVacio) {
    if (!recursos.length) {
      el.innerHTML = `<div class="page-header"><h3>Biblioteca</h3></div>
        <div class="empty-state"><div class="icon">📚</div><p>${mensajeVacio}</p></div>`;
      return;
    }

    const session = Auth.session();
    const { data: progreso } = await sb
      .from('library_progress')
      .select('*')
      .eq('student_id', session.id)
      .in('resource_id', recursos.map(r => r.id));

    const progresoPorId = {};
    (progreso || []).forEach(p => { progresoPorId[p.resource_id] = p; });

    const cards = recursos.map(r => {
      const icon = this._ICONS[r.type] || '📄';
      const url  = r.file_url || r.video_url || r.external_url || '#';
      const p    = progresoPorId[r.id];
      const completado = p?.status === 'completed';

      return `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1.4rem">${icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--text-1)">${r.title}</div>
            ${r.description ? `<div style="font-size:.8rem;color:var(--text-2);margin-top:2px">${r.description}</div>` : ''}
            ${r.category ? `<span class="badge badge-indigo" style="font-size:.62rem;margin-top:4px;display:inline-block">${r.category}</span>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
            <a href="${url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" onclick="AlumnoBiblioteca._marcarVisto('${r.id}')">Ver</a>
            ${completado
              ? '<span class="badge badge-active" style="font-size:.65rem">✓ Completado</span>'
              : `<button class="btn btn-ghost btn-sm" style="font-size:.7rem" onclick="AlumnoBiblioteca.marcarCompletado('${r.id}')">Marcar completado</button>`}
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="page-header"><h3>Biblioteca</h3></div>${cards}`;
  },

  _marcarVisto(resourceId) {
    const session = Auth.session();
    sb.from('library_progress').upsert(
      { resource_id: resourceId, student_id: session.id, status: 'viewed' },
      { onConflict: 'resource_id,student_id', ignoreDuplicates: true }
    );
  },

  async marcarCompletado(resourceId) {
    const session = Auth.session();
    const { error } = await sb.from('library_progress').upsert(
      { resource_id: resourceId, student_id: session.id, status: 'completed', completed_at: new Date().toISOString() },
      { onConflict: 'resource_id,student_id' }
    );
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Marcado como completado');
    if (document.getElementById('page-biblioteca-global').classList.contains('active')) this._loadGlobal();
    else this.init();
  },
};
