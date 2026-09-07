const AlumnoPerfil = {
  _alumno: null,

  abrir() {
    document.getElementById('tabs-bar').classList.add('hidden');
    document.getElementById('topbar-materia').textContent = 'Mi Perfil';
    document.getElementById('topbar-sub').textContent = '';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-perfil').classList.add('active');
    this.init();
  },

  async init() {
    const el = document.getElementById('perfil-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    const { data: alumno, error } = await sb
      .from('students')
      .select('*, institutions(name), careers(name)')
      .eq('id', session.id)
      .single();

    if (error || !alumno) { Utils.toast('Error al cargar tu perfil', 'error'); return; }
    this._alumno = alumno;
    this._render();
  },

  _render() {
    const a  = this._alumno;
    const el = document.getElementById('perfil-content');
    const curso = a.anio ? `${a.anio}°${a.division ? ' ' + a.division : ''}` : 'Sin indicar';

    el.innerHTML = `
      <div class="page-header"><h3>Mi Perfil</h3></div>
      <div class="card" style="max-width:520px">
        <div style="font-size:1.15rem;font-weight:700;color:var(--text-1);margin-bottom:4px">${a.full_name}</div>
        <div style="font-size:.85rem;color:var(--text-3);line-height:1.7">
          DNI ${a.dni}<br>
          ${a.email || 'Sin email'}${a.phone ? ' · ' + a.phone : ''}<br>
          ${a.institutions?.name || 'Sin institución'}${a.careers?.name ? ' · ' + a.careers.name : ''}<br>
          Curso: ${curso}
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="AlumnoPerfil.abrirEditar()">Editar perfil</button>
      </div>`;
  },

  async abrirEditar() {
    const a = this._alumno;
    document.getElementById('miperfil-nombre').value   = a.first_name || '';
    document.getElementById('miperfil-apellido').value = a.last_name  || '';
    document.getElementById('miperfil-dni').value       = a.dni   || '';
    document.getElementById('miperfil-email').value     = a.email || '';
    document.getElementById('miperfil-phone').value     = a.phone || '';
    document.getElementById('miperfil-anio').value      = a.anio  || '';
    document.getElementById('miperfil-division').value  = a.division || '';

    const hint = document.getElementById('miperfil-legacy-hint');
    if (!a.first_name && !a.last_name && a.full_name) {
      hint.style.display = 'block';
      document.getElementById('miperfil-legacy-name').textContent = a.full_name;
    } else {
      hint.style.display = 'none';
    }

    // Instituciones
    const { data: insts } = await sb.from('institutions').select('id, name').order('name');
    const selInst = document.getElementById('miperfil-inst');
    selInst.innerHTML = '<option value="">Sin institución asignada</option>' +
      (insts || []).map(i => `<option value="${i.id}"${a.institution_id === i.id ? ' selected' : ''}>${i.name}</option>`).join('');

    if (a.institution_id) {
      await this.onInstChange(a.career_id);
    } else {
      document.getElementById('miperfil-carrera').innerHTML = '<option value="">Primero seleccioná institución</option>';
      document.getElementById('miperfil-carrera').disabled = true;
    }

    document.getElementById('miperfil-modal').classList.remove('hidden');
    document.getElementById('miperfil-nombre').focus();
  },

  async onInstChange(preselect = null) {
    const instId = document.getElementById('miperfil-inst').value;
    const selCar = document.getElementById('miperfil-carrera');
    if (!instId) {
      selCar.innerHTML = '<option value="">Primero seleccioná institución</option>';
      selCar.disabled = true;
      return;
    }
    selCar.innerHTML = '<option value="">Cargando…</option>';
    selCar.disabled = true;
    const { data: carreras } = await sb.from('careers').select('id, name').eq('institution_id', instId).order('name');
    if (!carreras?.length) {
      selCar.innerHTML = '<option value="">Sin carreras</option>';
      return;
    }
    selCar.innerHTML = '<option value="">Sin carrera asignada</option>' +
      carreras.map(c => `<option value="${c.id}"${preselect === c.id ? ' selected' : ''}>${c.name}</option>`).join('');
    selCar.disabled = false;
  },

  closeEditar() {
    document.getElementById('miperfil-modal').classList.add('hidden');
  },

  async guardar() {
    const btn      = document.getElementById('miperfil-save');
    const nombre   = document.getElementById('miperfil-nombre').value.trim();
    const apellido = document.getElementById('miperfil-apellido').value.trim();
    const dni      = document.getElementById('miperfil-dni').value.trim();
    const email    = document.getElementById('miperfil-email').value.trim();
    const phone    = document.getElementById('miperfil-phone').value.trim();
    const instId   = document.getElementById('miperfil-inst').value;
    const carreraId = document.getElementById('miperfil-carrera').value;
    const anio     = parseInt(document.getElementById('miperfil-anio').value) || null;
    const division = document.getElementById('miperfil-division').value || null;

    if (!dni) { Utils.toast('El DNI es obligatorio', 'error'); return; }

    const dejaronVacio = !nombre && !apellido;
    if (dejaronVacio && !this._alumno.full_name) { Utils.toast('Nombre y apellido son obligatorios', 'error'); return; }

    const nombrePayload = dejaronVacio
      ? { full_name: this._alumno.full_name, first_name: this._alumno.first_name, last_name: this._alumno.last_name }
      : { full_name: `${nombre} ${apellido}`.trim(), first_name: nombre || null, last_name: apellido || null };

    Utils.btnLoading(btn, true);
    const session = Auth.session();
    const { error } = await sb.from('students').update({
      ...nombrePayload, dni,
      email: email || null, phone: phone || null,
      institution_id: instId || null, career_id: carreraId || null,
      anio, division,
    }).eq('id', session.id);
    Utils.btnLoading(btn, false);

    if (error) {
      Utils.toast(error.message.includes('unique') ? 'Ese DNI ya está registrado por otro alumno.' : 'Error: ' + error.message, 'error');
      return;
    }

    sessionStorage.setItem('kinnos_nombre', nombrePayload.full_name);
    sessionStorage.setItem('kinnos_dni', dni);
    if (instId)    sessionStorage.setItem('kinnos_inst', instId);    else sessionStorage.removeItem('kinnos_inst');
    if (carreraId) sessionStorage.setItem('kinnos_career', carreraId); else sessionStorage.removeItem('kinnos_career');
    document.getElementById('alumno-greeting').textContent = nombrePayload.full_name;

    this.closeEditar();
    Utils.toast('Perfil actualizado');
    this.init();
  },
};
