const PreceptorAlumnos = {
  _todos: [],
  _filtroAnio: '',
  _filtroDivision: '',

  async init() {
    const el = document.getElementById('alumnos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    if (!session.inst) {
      el.innerHTML = '<div class="empty-state"><p>Tu perfil no tiene institución asignada.</p></div>';
      return;
    }

    const { data, error } = await sb
      .from('students')
      .select('*, careers(name)')
      .eq('institution_id', session.inst);

    if (error) { Utils.toast('Error al cargar alumnos', 'error'); return; }
    this._todos = (data || []).sort((a, b) => Utils.nombrePlanilla(a).localeCompare(Utils.nombrePlanilla(b)));
    this._render();
  },

  _aplicarFiltros() {
    return this._todos.filter(a => {
      if (this._filtroAnio && String(a.anio || '') !== this._filtroAnio) return false;
      if (this._filtroDivision && (a.division || '') !== this._filtroDivision) return false;
      return true;
    });
  },

  filtrar(campo, value) {
    if (campo === 'anio')     this._filtroAnio     = value;
    if (campo === 'division') this._filtroDivision = value;
    this._render();
  },

  _render() {
    const el = document.getElementById('alumnos-content');
    const data = this._aplicarFiltros();

    const filterBar = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <label style="font-size:.78rem;color:var(--text-3)">Filtrar:</label>
        <select onchange="PreceptorAlumnos.filtrar('anio', this.value)" style="width:auto;padding:5px 10px">
          <option value="">Todos los años</option>
          ${[1, 2, 3, 4].map(y => `<option value="${y}" ${this._filtroAnio === String(y) ? 'selected' : ''}>${y}°</option>`).join('')}
        </select>
        <select onchange="PreceptorAlumnos.filtrar('division', this.value)" style="width:auto;padding:5px 10px">
          <option value="">Ambas divisiones</option>
          <option value="A" ${this._filtroDivision === 'A' ? 'selected' : ''}>División A</option>
          <option value="B" ${this._filtroDivision === 'B' ? 'selected' : ''}>División B</option>
        </select>
        <span style="font-size:.78rem;color:var(--text-3)">${data.length} de ${this._todos.length} alumnos</span>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="PreceptorAlumnos.imprimir()">🖨 Armar lista / imprimir</button>
      </div>`;

    if (!this._todos.length) {
      el.innerHTML = `<div class="page-header"><h3>Alumnos</h3></div>
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos cargados en esta institución todavía.</p></div>`;
      return;
    }

    const rows = data.map(a => {
      const curso = a.anio ? `${a.anio}°${a.division ? ' ' + a.division : ''}` : '—';
      return `
        <tr>
          <td class="text-main">${Utils.nombrePlanilla(a)}</td>
          <td>${a.dni}</td>
          <td>${curso}</td>
          <td>${a.careers?.name || '—'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-ghost btn-sm" onclick="PreceptorAsistencia.verAlumno('${a.id}')">Asistencia</button>
              <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.verAlumno('${a.id}')">Notas</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Alumnos <span style="font-weight:400;font-size:.9rem;color:var(--text-3)">(${this._todos.length})</span></h3></div>
      ${filterBar}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Curso</th><th>Carrera</th><th>Acciones</th></tr></thead>
          <tbody>${rows.length ? rows : `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-3)">Ningún alumno coincide con el filtro.</td></tr>`}</tbody>
        </table>
      </div>`;
  },

  imprimir() {
    const data = this._aplicarFiltros();
    const anio = this._filtroAnio ? `${this._filtroAnio}°` : 'Todos los años';
    const division = this._filtroDivision || 'Ambas divisiones';

    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Lista de alumnos</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 1.2rem; margin-bottom: 4px; }
        p { color: #555; font-size: .85rem; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: .85rem; }
        th { background: #eee; }
      </style></head><body>
      <h1>Listado de alumnos — ${anio} · ${division}</h1>
      <p>Generado el ${Utils.formatDate(Utils.hoyLocal())} — ${data.length} alumnos</p>
      <table>
        <thead><tr><th>#</th><th>Apellido y Nombre</th><th>DNI</th><th>Curso</th></tr></thead>
        <tbody>
          ${data.map((a, i) => `<tr><td>${i + 1}</td><td>${Utils.nombrePlanilla(a)}</td><td>${a.dni}</td><td>${a.anio ? a.anio + '°' : ''} ${a.division || ''}</td></tr>`).join('')}
        </tbody>
      </table>
      </body></html>`);
    win.document.close();
    win.print();
  },
};
