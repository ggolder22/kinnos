// Estado global compartido entre todos los módulos del profesor
const ProfesorState = {
  materia: null,
  seccion: null,
};

const ProfesorMaterias = {
  async init() {
    const session = Auth.session();
    document.getElementById('prof-greeting').textContent = session.nombre || `DNI ${session.dni}`;
    await this._loadMaterias();
  },

  async _loadMaterias() {
    const session = Auth.session();
    const { data, error } = await sb
      .from('professor_subjects')
      .select('is_primary, subjects(id, name, year, join_code, careers(name, institutions(name)))')
      .eq('professor_id', session.id)
      .order('is_primary', { ascending: false });

    if (error) { Utils.toast('Error al cargar materias', 'error'); return; }

    const materias = (data || []).map(r => r.subjects).filter(Boolean);
    this._renderSidebar(materias);

    if (materias.length === 1) this.seleccionar(materias[0].id);
  },

  _renderSidebar(materias) {
    const el = document.getElementById('sidebar-materias');
    if (!materias.length) {
      el.innerHTML = '<div style="padding:12px 20px;font-size:.8rem;color:var(--text-3)">Sin materias. Creá una.</div>';
      return;
    }
    el.innerHTML = materias.map(m => `
      <div class="nav-item" id="nav-mat-${m.id}" onclick="ProfesorMaterias.seleccionar('${m.id}')">
        <span class="icon">📚</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</span>
        <span class="join-code">${m.join_code}</span>
      </div>`).join('');
  },

  async seleccionar(subjectId) {
    const { data: m } = await sb
      .from('subjects')
      .select('id, name, year, join_code, career_id, careers(name, institutions(name))')
      .eq('id', subjectId)
      .single();
    if (!m) return;
    ProfesorState.materia = m;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`nav-mat-${subjectId}`)?.classList.add('active');

    document.getElementById('topbar-materia').textContent = m.name;
    const sub = [m.careers?.institutions?.name, m.careers?.name, m.year ? `Año ${m.year}` : null]
      .filter(Boolean).join(' › ');
    document.getElementById('topbar-sub').textContent = sub;

    document.getElementById('tabs-bar').classList.remove('hidden');
    showTab(ProfesorState.seccion || 'unidades');
  },

  // ── Tomar materia del plan ────────────────────────────────────

  async abrirModalCrear() {
    const { data: insts } = await sb.from('institutions').select('id, name').order('name');
    if (!insts?.length) {
      Utils.toast('No hay instituciones cargadas aún.', 'error');
      return;
    }
    Utils.fillSelect('nueva-mat-inst', insts, 'id', 'name', 'Seleccioná institución…');
    document.getElementById('nueva-mat-carrera').innerHTML = '<option value="">Primero seleccioná institución</option>';
    document.getElementById('nueva-mat-lista').innerHTML   = '';
    document.getElementById('nueva-mat-modal').classList.remove('hidden');
  },

  cerrarModalCrear() {
    document.getElementById('nueva-mat-modal').classList.add('hidden');
  },

  async onInstChange() {
    const instId = document.getElementById('nueva-mat-inst').value;
    const sel = document.getElementById('nueva-mat-carrera');
    document.getElementById('nueva-mat-lista').innerHTML = '';
    if (!instId) { sel.innerHTML = '<option value="">Primero seleccioná institución</option>'; return; }

    sel.innerHTML = '<option value="">Cargando…</option>';
    const { data: carreras } = await sb.from('careers')
      .select('id, name').eq('institution_id', instId).order('name');

    if (!carreras?.length) {
      sel.innerHTML = '<option value="">Sin carreras — contactá al administrador</option>';
      return;
    }
    Utils.fillSelect('nueva-mat-carrera', carreras, 'id', 'name', 'Seleccioná carrera…');
  },

  async onCarreraChange() {
    const carreraId = document.getElementById('nueva-mat-carrera').value;
    const lista = document.getElementById('nueva-mat-lista');
    if (!carreraId) { lista.innerHTML = ''; return; }

    lista.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">Cargando…</div>';

    const session = Auth.session();
    const [{ data: subjects }, { data: yaAgregadas }] = await Promise.all([
      sb.from('subjects').select('id, name, year, despliegue, campo_formacion')
        .eq('career_id', carreraId).order('year').order('name'),
      sb.from('professor_subjects').select('subject_id').eq('professor_id', session.id),
    ]);

    if (!subjects?.length) {
      lista.innerHTML = '<p style="color:var(--text-3);font-size:.85rem;padding:8px 0">Esta carrera no tiene materias cargadas en el plan. Pedile al admin que las cargue.</p>';
      return;
    }

    const yaIds = new Set((yaAgregadas || []).map(r => r.subject_id));

    // Agrupar por año
    const byYear = {};
    for (const s of subjects) {
      const key = s.year ? `${s.year}° Año` : 'Sin año';
      (byYear[key] = byYear[key] || []).push(s);
    }

    lista.innerHTML = Object.entries(byYear).map(([yr, subs]) => `
      <div style="margin-bottom:16px">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">${yr}</div>
        ${subs.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:7px;margin-bottom:5px">
            <div>
              <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${s.name}</div>
              ${s.campo_formacion ? `<div style="font-size:.72rem;color:var(--text-3)">${s.campo_formacion}${s.despliegue ? ' · ' + s.despliegue : ''}</div>` : ''}
            </div>
            ${yaIds.has(s.id)
              ? '<span style="font-size:.75rem;color:var(--success)">✓ Agregada</span>'
              : `<button class="btn btn-primary btn-sm" onclick="ProfesorMaterias.tomarMateria('${s.id}','${s.name.replace(/'/g, "\\'")}')">Tomar</button>`
            }
          </div>`).join('')}
      </div>`).join('');
  },

  async tomarMateria(subjectId, nombre) {
    const session = Auth.session();
    const { error } = await sb.from('professor_subjects')
      .insert({ professor_id: session.id, subject_id: subjectId, is_primary: true });
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(`"${nombre}" agregada a tus materias`);
    this.cerrarModalCrear();
    await this._loadMaterias();
    this.seleccionar(subjectId);
  },
};
