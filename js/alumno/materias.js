const AlumnoState = {
  materia: null,
  seccion: null,
};

const AlumnoMaterias = {
  async init() {
    const session = Auth.session();
    document.getElementById('alumno-greeting').textContent = session.nombre || `DNI ${session.dni}`;
    await this._loadMaterias();
  },

  async _loadMaterias() {
    const session = Auth.session();
    const { data, error } = await sb
      .from('student_subjects')
      .select('subjects(id, name, year, join_code, careers(name, institutions(name)))')
      .eq('student_id', session.id);

    if (error) { Utils.toast('Error al cargar materias', 'error'); return; }

    const materias = (data || []).map(r => r.subjects).filter(Boolean);
    this._renderSidebar(materias);

    if (materias.length === 1) this.seleccionar(materias[0].id);
  },

  _renderSidebar(materias) {
    const el = document.getElementById('sidebar-materias');
    if (!materias.length) {
      el.innerHTML = '<div style="padding:12px 20px;font-size:.8rem;color:var(--text-3)">No estás inscripto en ninguna materia.</div>';
      return;
    }
    el.innerHTML = materias.map(m => `
      <div class="nav-item" id="nav-mat-${m.id}" onclick="AlumnoMaterias.seleccionar('${m.id}')">
        <span class="icon">📚</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</span>
      </div>`).join('');
  },

  async seleccionar(subjectId) {
    const { data: m } = await sb
      .from('subjects')
      .select('id, name, year, join_code, careers(name, institutions(name))')
      .eq('id', subjectId)
      .single();
    if (!m) return;
    AlumnoState.materia = m;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`nav-mat-${subjectId}`)?.classList.add('active');

    document.getElementById('topbar-materia').textContent = m.name;
    const sub = [m.careers?.institutions?.name, m.careers?.name, m.year ? `Año ${m.year}` : null]
      .filter(Boolean).join(' › ');
    document.getElementById('topbar-sub').textContent = sub;

    document.getElementById('tabs-bar').classList.remove('hidden');
    AlumnoNovedades.renderBanner();
    showTab(AlumnoState.seccion || 'unidades');
  },

  async explorar() {
    const modal   = document.getElementById('explorar-modal');
    const content = document.getElementById('explorar-content');
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="loading">Cargando…</div>';

    const session  = Auth.session();
    const careerId = session.career;
    const instId   = session.inst;

    if (!instId && !careerId) {
      content.innerHTML = '<p style="color:var(--text-3);font-size:.875rem;padding:8px 0">Tu cuenta no tiene institución asignada. Contactá al administrador.</p>';
      return;
    }

    // Si tiene carrera, mostrar solo esa. Si no, mostrar todas las de la institución.
    let careerIds, careerMap;
    if (careerId) {
      const { data: car } = await sb.from('careers').select('id, name').eq('id', careerId).single();
      careerIds = car ? [car.id] : [];
      careerMap = car ? { [car.id]: car.name } : {};
    } else {
      const { data: careers } = await sb.from('careers')
        .select('id, name').eq('institution_id', instId).order('name');
      careerIds = (careers || []).map(c => c.id);
      careerMap = Object.fromEntries((careers || []).map(c => [c.id, c.name]));
    }

    if (!careerIds.length) {
      content.innerHTML = '<p style="color:var(--text-3);font-size:.875rem;padding:8px 0">No hay carreras disponibles todavía.</p>';
      return;
    }

    // Materias de esa(s) carrera(s) + inscripciones actuales + mi propio año/división
    const [{ data: subjects }, { data: enrolled }, { data: yo }] = await Promise.all([
      sb.from('subjects').select('id, name, year, division, career_id').in('career_id', careerIds).order('year').order('name'),
      sb.from('student_subjects').select('subject_id').eq('student_id', session.id),
      sb.from('students').select('anio, division').eq('id', session.id).single(),
    ]);

    if (!subjects?.length) {
      content.innerHTML = '<p style="color:var(--text-3);font-size:.875rem;padding:8px 0">No hay materias cargadas todavía.</p>';
      return;
    }

    const enrolledIds = new Set((enrolled || []).map(e => e.subject_id));

    // Si ya elegí mi año/división (en Horarios o al registrarme), no muestro materias que sean
    // exclusivas de la otra división. Si todavía no lo elegí, se ven todas (igual que antes).
    const misSubjects = (yo?.anio && yo?.division)
      ? subjects.filter(s => !(s.division && s.year === yo.anio && s.division !== yo.division))
      : subjects;

    // Agrupar por año dentro de la carrera
    const byYear = {};
    for (const s of misSubjects) {
      const key = s.year ? `Año ${s.year}` : 'Sin año asignado';
      (byYear[key] = byYear[key] || []).push(s);
    }

    // Cabecera con nombre de la carrera si hay una sola
    const carName = careerIds.length === 1 ? Object.values(careerMap)[0] : null;
    const header  = carName
      ? `<div style="font-size:.8rem;color:var(--text-3);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)">${carName}</div>`
      : '';

    content.innerHTML = header + Object.entries(byYear).map(([yearLabel, subs]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">${yearLabel}</div>
        ${subs.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-base);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
            <div style="font-weight:500;color:var(--text-1);font-size:.875rem">
              ${s.name}${s.division ? ` <span class="badge badge-indigo" style="font-size:.62rem">${s.division}</span>` : ''}
            </div>
            ${enrolledIds.has(s.id)
              ? '<span class="badge badge-indigo" style="background:rgba(34,197,94,.15);color:#4ade80;border-color:rgba(34,197,94,.3)">Inscripto</span>'
              : `<button class="btn btn-primary btn-sm" onclick="AlumnoMaterias.inscribirse('${s.id}',${JSON.stringify(s.name).replace(/"/g,'&quot;')})">Inscribirme</button>`
            }
          </div>`).join('')}
      </div>`).join('');
  },

  async inscribirse(subjectId, nombre) {
    const session = Auth.session();
    const { error } = await sb.from('student_subjects')
      .insert({ student_id: session.id, subject_id: subjectId });
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(`¡Inscripto en ${nombre}!`);
    document.getElementById('explorar-modal').classList.add('hidden');
    await this._loadMaterias();
    this.seleccionar(subjectId);
  },

  async unirse() {
    const input = document.getElementById('join-code-input');
    const codigo = input.value.trim().toUpperCase();
    if (!codigo) { Utils.toast('Ingresá el código de la materia', 'error'); return; }

    const { data: materia } = await sb
      .from('subjects').select('id, name, year, division').eq('join_code', codigo).maybeSingle();

    if (!materia) { Utils.toast('Código incorrecto. Verificá con tu profesor.', 'error'); return; }

    const session = Auth.session();

    // Si la materia es exclusiva de una división, y yo ya elegí la mía, deben coincidir
    if (materia.division) {
      const { data: yo } = await sb.from('students').select('anio, division').eq('id', session.id).single();
      if (yo?.anio && yo?.division && yo.anio === materia.year && yo.division !== materia.division) {
        Utils.toast(`Este código es para ${materia.year}° ${materia.division}. Vos estás en ${yo.anio}° ${yo.division}.`, 'error');
        return;
      }
    }

    const { data: yaInscripto } = await sb
      .from('student_subjects')
      .select('student_id')
      .eq('student_id', session.id)
      .eq('subject_id', materia.id)
      .maybeSingle();

    if (yaInscripto) { Utils.toast(`Ya estás inscripto en ${materia.name}`, 'info'); return; }

    const { error } = await sb.from('student_subjects')
      .insert({ student_id: session.id, subject_id: materia.id });
    if (error) { Utils.toast('Error al inscribirse: ' + error.message, 'error'); return; }

    Utils.toast(`¡Inscripto en ${materia.name}!`);
    input.value = '';
    await this._loadMaterias();
    this.seleccionar(materia.id);
  },
};
