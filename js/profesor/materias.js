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

  // ── Crear nueva materia ───────────────────────────────────────

  async abrirModalCrear() {
    // Cargar instituciones
    const { data: insts } = await sb.from('institutions').select('id, name').order('name');
    if (!insts?.length) {
      Utils.toast('No hay instituciones cargadas. Pedile al administrador que cree una primero.', 'error');
      return;
    }
    Utils.fillSelect('nueva-mat-inst', insts, 'id', 'name', 'Seleccioná institución…');
    document.getElementById('nueva-mat-carrera').innerHTML = '<option value="">Primero seleccioná institución</option>';
    document.getElementById('nueva-mat-nombre').value = '';
    document.getElementById('nueva-mat-year').value  = '';
    document.getElementById('nueva-mat-modal').classList.remove('hidden');
    document.getElementById('nueva-mat-nombre').focus();
  },

  cerrarModalCrear() {
    document.getElementById('nueva-mat-modal').classList.add('hidden');
  },

  async onInstChange() {
    const instId = document.getElementById('nueva-mat-inst').value;
    const sel = document.getElementById('nueva-mat-carrera');
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

  async guardarNuevaMateria() {
    const btn      = document.getElementById('nueva-mat-save');
    const carreraId = document.getElementById('nueva-mat-carrera').value;
    const nombre   = document.getElementById('nueva-mat-nombre').value.trim();
    const year     = parseInt(document.getElementById('nueva-mat-year').value) || null;

    if (!carreraId) { Utils.toast('Seleccioná una carrera', 'error'); return; }
    if (!nombre)    { Utils.toast('El nombre es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    const session = Auth.session();

    // Crear la materia (el trigger genera el join_code)
    const { data: materia, error } = await sb
      .from('subjects')
      .insert({ name: nombre, year, career_id: carreraId })
      .select()
      .single();

    if (error) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error al crear: ' + error.message, 'error');
      return;
    }

    // Asignar el profesor a la materia creada
    await sb.from('professor_subjects')
      .insert({ professor_id: session.id, subject_id: materia.id, is_primary: true });

    Utils.btnLoading(btn, false);
    Utils.toast(`Materia "${nombre}" creada — código: ${materia.join_code}`);
    this.cerrarModalCrear();
    await this._loadMaterias();
    this.seleccionar(materia.id);
  },
};
