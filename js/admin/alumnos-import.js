const AdminAlumnosImport = {
  _sheets: [],          // [{ name, anio, division, rows }]
  _diff: null,          // { nuevos, correcciones, sinCambios, errores }
  _institutionId: null,
  _institutionName: '',
  _careerId: null,
  _careerName: '',

  // ── Apertura / cierre ─────────────────────────────────────

  abrir() {
    document.getElementById('alumno-import-overlay').style.display = 'flex';
    document.getElementById('alumno-import-save').style.display    = 'none';
    document.getElementById('alumno-import-count').textContent     = '';
    this._paso1();
  },

  cerrar() {
    document.getElementById('alumno-import-overlay').style.display = 'none';
    this._sheets = [];
    this._diff   = null;
  },

  // ── Paso 1: institución/carrera + elegir archivo ──────────

  async _paso1() {
    const { data: insts } = await sb.from('institutions').select('id, name').order('name');

    document.getElementById('alumno-import-body').innerHTML = `
      <div style="max-width:560px;margin:0 auto">
        <div style="font-size:2rem;text-align:center;margin-bottom:16px">📊</div>
        <p style="color:var(--text-2);font-size:.9rem;line-height:1.65;margin-bottom:24px">
          Subí tu Excel con los alumnos del instituto. Podés tenerlos en <strong>una hoja por año y división</strong>
          (ej: "1A", "2do B") — Kinnos intenta adivinar el año y la división a partir del nombre de cada hoja,
          y después vas a poder corregirlo a mano. Los encabezados de columna pueden variar
          (Apellido, Nombre, DNI, Email, Teléfono — en cualquier orden).
        </p>

        <div class="form-group">
          <label>Institución (se asigna a los alumnos nuevos)</label>
          <select id="imp-al-inst" onchange="AdminAlumnosImport._onInstChange()">
            <option value="">Sin institución asignada</option>
            ${(insts || []).map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Carrera</label>
          <select id="imp-al-carrera" disabled>
            <option value="">Primero seleccioná institución</option>
          </select>
        </div>

        <div style="text-align:center;margin-top:24px">
          <button class="btn btn-primary" onclick="AdminAlumnosImport._elegirArchivo()">📂 Elegir archivo Excel (.xlsx)</button>
        </div>
      </div>`;
  },

  async _onInstChange() {
    const instId = document.getElementById('imp-al-inst').value;
    const selCar = document.getElementById('imp-al-carrera');
    if (!instId) {
      selCar.innerHTML = '<option value="">Primero seleccioná institución</option>';
      selCar.disabled = true;
      return;
    }
    selCar.innerHTML = '<option value="">Cargando…</option>';
    selCar.disabled = true;
    const { data: carreras } = await sb.from('careers').select('id, name').eq('institution_id', instId).order('name');
    selCar.innerHTML = '<option value="">Sin carrera asignada</option>' +
      (carreras || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    selCar.disabled = false;
  },

  _elegirArchivo() {
    const instSel = document.getElementById('imp-al-inst');
    const carSel  = document.getElementById('imp-al-carrera');
    this._institutionId   = instSel?.value || null;
    this._institutionName = instSel?.selectedOptions?.[0]?.textContent || '';
    this._careerId         = carSel?.value || null;
    this._careerName       = carSel?.selectedOptions?.[0]?.textContent || '';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = e => { if (e.target.files[0]) this._procesarArchivo(e.target.files[0]); };
    input.click();
  },

  // ── Lectura del Excel ──────────────────────────────────────

  _cargarLibreria(globalName, src) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  },

  async _procesarArchivo(file) {
    document.getElementById('alumno-import-body').innerHTML =
      '<div class="loading" style="padding:60px;text-align:center">Leyendo archivo…</div>';

    try {
      await this._cargarLibreria('XLSX', 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      this._sheets = wb.SheetNames.map(name => {
        const rows  = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
        const guess = this._adivinarAnioDivision(name);
        return { name, anio: guess.anio, division: guess.division, rows };
      }).filter(s => s.rows.length > 0);

      if (!this._sheets.length) {
        document.getElementById('alumno-import-body').innerHTML = `
          <div style="padding:40px;text-align:center">
            <p style="color:var(--text-2)">El archivo no tiene filas de datos.</p>
            <button class="btn btn-ghost" style="margin-top:16px" onclick="AdminAlumnosImport._paso1()">← Volver</button>
          </div>`;
        return;
      }

      this._renderMapeoHojas();
    } catch (e) {
      document.getElementById('alumno-import-body').innerHTML = `
        <div style="padding:40px;text-align:center">
          <p style="color:var(--danger)">Error al leer el archivo: ${e.message}</p>
          <button class="btn btn-ghost" style="margin-top:16px" onclick="AdminAlumnosImport._paso1()">← Volver</button>
        </div>`;
    }
  },

  _adivinarAnioDivision(sheetName) {
    const dMatch = sheetName.match(/\d+/);
    const anio   = dMatch ? parseInt(dMatch[0]) : null;
    const letraMatch = sheetName.match(/\b([ABab])\b/);
    const division = letraMatch ? letraMatch[1].toUpperCase() : null;
    return { anio, division };
  },

  // ── Paso 2: confirmar año/división por hoja ───────────────

  _renderMapeoHojas() {
    const anioOpts = (sel) => [1, 2, 3, 4, 5, 6, 7].map(n =>
      `<option value="${n}" ${sel === n ? 'selected' : ''}>${n}°</option>`).join('');

    const rows = this._sheets.map((s, i) => `
      <tr>
        <td class="text-main">${s.name}</td>
        <td style="text-align:center">${s.rows.length}</td>
        <td>
          <select id="imp-al-anio-${i}" style="width:auto;padding:5px 8px">
            <option value="">—</option>
            ${anioOpts(s.anio)}
          </select>
        </td>
        <td>
          <select id="imp-al-div-${i}" style="width:auto;padding:5px 8px">
            <option value="" ${!s.division ? 'selected' : ''}>—</option>
            <option value="A" ${s.division === 'A' ? 'selected' : ''}>A</option>
            <option value="B" ${s.division === 'B' ? 'selected' : ''}>B</option>
          </select>
        </td>
      </tr>`).join('');

    document.getElementById('alumno-import-body').innerHTML = `
      <h3 style="color:var(--text-1);margin-bottom:6px">Revisá año y división por hoja</h3>
      <p style="color:var(--text-3);font-size:.85rem;margin-bottom:18px">
        Kinnos adivinó esto a partir del nombre de cada hoja. Corregilo si hace falta antes de continuar.
      </p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Hoja</th><th style="text-align:center">Filas</th><th>Año</th><th>División</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="text-align:right;margin-top:20px">
        <button class="btn btn-ghost" onclick="AdminAlumnosImport._paso1()">← Volver</button>
        <button class="btn btn-primary" onclick="AdminAlumnosImport._confirmarMapeo()">Continuar →</button>
      </div>`;
  },

  async _confirmarMapeo() {
    this._sheets.forEach((s, i) => {
      s.anio     = parseInt(document.getElementById(`imp-al-anio-${i}`).value) || null;
      s.division = document.getElementById(`imp-al-div-${i}`).value || null;
    });

    document.getElementById('alumno-import-body').innerHTML =
      '<div class="loading" style="padding:60px;text-align:center">Comparando con la base de datos…</div>';

    await this._calcularDiff();
  },

  // ── Extracción flexible de columnas ───────────────────────

  _extraerCampos(row) {
    const keys = Object.keys(row);
    const find = (...alts) => {
      for (const k of keys) {
        const nk = k.toLowerCase().trim();
        if (alts.some(a => nk === a || nk.includes(a))) {
          const v = row[k];
          return v === undefined || v === null ? '' : String(v).trim();
        }
      }
      return '';
    };

    let apellido = find('apellido', 'apellidos');
    let nombre   = find('nombre', 'nombres');

    if (!apellido && !nombre) {
      const combinedKey = keys.find(k => /apellido/i.test(k) && /nombre/i.test(k));
      if (combinedKey) {
        const val = String(row[combinedKey] ?? '').trim();
        if (val.includes(',')) {
          const [a, n] = val.split(',');
          apellido = (a || '').trim();
          nombre   = (n || '').trim();
        } else {
          apellido = val;
        }
      }
    }

    const dni = find('dni', 'documento', 'cuil').replace(/\D/g, '');

    return {
      apellido, nombre, dni,
      email: find('email', 'correo', 'mail') || '',
      phone: find('telefono', 'teléfono', 'celular', 'tel') || '',
    };
  },

  // ── Diff contra la base de datos ──────────────────────────

  async _calcularDiff() {
    let candidatos = [];
    const errores = [];

    this._sheets.forEach(s => {
      s.rows.forEach((row, idx) => {
        const c = this._extraerCampos(row);
        if (!c.dni || (!c.apellido && !c.nombre)) {
          errores.push({ hoja: s.name, fila: idx + 2, motivo: !c.dni ? 'Sin DNI' : 'Sin nombre ni apellido' });
          return;
        }
        candidatos.push({
          dni: c.dni,
          nombre: c.nombre || '',
          apellido: c.apellido || '',
          full_name: `${c.nombre} ${c.apellido}`.trim(),
          email: c.email || null,
          phone: c.phone || null,
          anio: s.anio,
          division: s.division,
          _hoja: s.name,
        });
      });
    });

    const vistos = new Set();
    candidatos = candidatos.filter(c => {
      if (vistos.has(c.dni)) {
        errores.push({ hoja: c._hoja, fila: '—', motivo: `DNI duplicado dentro del archivo: ${c.dni}` });
        return false;
      }
      vistos.add(c.dni);
      return true;
    });

    let existentesMap = {};
    if (candidatos.length) {
      const { data: existentes } = await sb.from('students').select('*').in('dni', candidatos.map(c => c.dni));
      (existentes || []).forEach(e => { existentesMap[e.dni] = e; });
    }

    const nuevos = [], correcciones = [], sinCambios = [];

    for (const c of candidatos) {
      const ex = existentesMap[c.dni];
      if (!ex) { nuevos.push(c); continue; }

      const cambios = [];
      const dist = (nv, av) => String(nv || '') !== String(av || '') && (nv || av);

      if (ex.first_name || ex.last_name) {
        if (dist(c.nombre, ex.first_name))   cambios.push({ campo: 'Nombre',   actual: ex.first_name, nuevo: c.nombre || null,   field: 'first_name', value: c.nombre || null });
        if (dist(c.apellido, ex.last_name))  cambios.push({ campo: 'Apellido', actual: ex.last_name,  nuevo: c.apellido || null, field: 'last_name',  value: c.apellido || null });
      } else if (c.full_name && c.full_name !== ex.full_name) {
        cambios.push({ campo: 'Nombre completo', actual: ex.full_name, nuevo: c.full_name, field: 'full_name', value: c.full_name });
      }
      if (dist(c.email, ex.email))       cambios.push({ campo: 'Email',    actual: ex.email,    nuevo: c.email,    field: 'email',    value: c.email });
      if (dist(c.phone, ex.phone))       cambios.push({ campo: 'Teléfono', actual: ex.phone,    nuevo: c.phone,    field: 'phone',    value: c.phone });
      if (dist(c.anio, ex.anio))         cambios.push({ campo: 'Año',      actual: ex.anio,     nuevo: c.anio,     field: 'anio',     value: c.anio });
      if (dist(c.division, ex.division))cambios.push({ campo: 'División', actual: ex.division, nuevo: c.division, field: 'division', value: c.division });

      // Institución/Carrera: solo se propone completar si el alumno no tenía (nunca pisa una ya asignada)
      if (!ex.institution_id && this._institutionId) {
        cambios.push({ campo: 'Institución', actual: null, nuevo: this._institutionName, field: 'institution_id', value: this._institutionId });
      }
      if (!ex.career_id && this._careerId) {
        cambios.push({ campo: 'Carrera', actual: null, nuevo: this._careerName, field: 'career_id', value: this._careerId });
      }

      if (cambios.length) correcciones.push({ candidato: c, existente: ex, cambios });
      else sinCambios.push(c);
    }

    this._diff = { nuevos, correcciones, sinCambios, errores };
    this._renderDiff();
  },

  // ── Paso 3: preview + confirmación ────────────────────────

  _renderDiff() {
    const { nuevos, correcciones, sinCambios, errores } = this._diff;

    document.getElementById('alumno-import-count').textContent =
      `${nuevos.length} nuevos · ${correcciones.length} para corregir · ${sinCambios.length} sin cambios${errores.length ? ' · ' + errores.length + ' con error' : ''}`;

    const nuevosHtml = nuevos.length ? `
      <h4 style="color:var(--text-1);margin:20px 0 10px">🆕 Alumnos nuevos (${nuevos.length})</h4>
      ${nuevos.map((c, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" id="imp-al-new-${i}" checked style="width:auto">
          <div style="flex:1;font-size:.85rem">
            <strong style="color:var(--text-1)">${c.apellido ? Utils.nombrePlanilla({ first_name: c.nombre, last_name: c.apellido, full_name: c.full_name }) : c.full_name || '(sin nombre)'}</strong>
            <span style="color:var(--text-3)"> · DNI ${c.dni}${c.anio ? ` · ${c.anio}°${c.division ? ' ' + c.division : ''}` : ''}</span>
          </div>
        </div>`).join('')}` : '';

    const correccionesHtml = correcciones.length ? `
      <h4 style="color:var(--text-1);margin:20px 0 10px">✏️ Para corregir (${correcciones.length})</h4>
      ${correcciones.map(({ candidato, existente, cambios }, i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <input type="checkbox" id="imp-al-fix-${i}" checked style="width:auto;margin-top:3px">
          <div style="flex:1;font-size:.85rem">
            <strong style="color:var(--text-1)">${Utils.nombrePlanilla(existente)}</strong>
            <span style="color:var(--text-3)"> · DNI ${existente.dni}</span>
            <div style="margin-top:4px;color:var(--text-2);font-size:.8rem">
              ${cambios.map(c => `${c.campo}: <span style="color:var(--text-3)">${c.actual ?? '—'}</span> → <strong style="color:var(--accent)">${c.nuevo ?? '—'}</strong>`).join(' · ')}
            </div>
          </div>
        </div>`).join('')}` : '';

    const erroresHtml = errores.length ? `
      <h4 style="color:var(--danger);margin:20px 0 10px">⚠️ No se pudieron leer (${errores.length})</h4>
      <div style="font-size:.8rem;color:var(--text-3);max-height:140px;overflow-y:auto">
        ${errores.map(e => `<div>Hoja "${e.hoja}", fila ${e.fila}: ${e.motivo}</div>`).join('')}
      </div>
      <p style="font-size:.78rem;color:var(--text-3);margin-top:6px">Corregí el Excel y volvé a importar, o completalos a mano después.</p>` : '';

    const sinCambiosHtml = `<p style="color:var(--text-3);font-size:.82rem;margin-top:20px">${sinCambios.length} alumno${sinCambios.length !== 1 ? 's' : ''} ya está${sinCambios.length !== 1 ? 'n' : ''} igual en la base — no se toca${sinCambios.length !== 1 ? 'n' : ''}.</p>`;

    if (!nuevos.length && !correcciones.length) {
      document.getElementById('alumno-import-body').innerHTML = `
        <div style="padding:30px;text-align:center">
          <p style="color:var(--text-2)">No hay nada para importar: todos los alumnos del archivo ya están cargados igual.</p>
          ${erroresHtml}
          <button class="btn btn-ghost" style="margin-top:16px" onclick="AdminAlumnosImport.cerrar()">Cerrar</button>
        </div>`;
      return;
    }

    document.getElementById('alumno-import-body').innerHTML = nuevosHtml + correccionesHtml + erroresHtml + sinCambiosHtml;
    document.getElementById('alumno-import-save').style.display = '';
  },

  async _confirmarImportacion() {
    const btn = document.getElementById('alumno-import-save');
    Utils.btnLoading(btn, true);

    const { nuevos, correcciones } = this._diff;
    const nuevosElegidos       = nuevos.filter((_, i) => document.getElementById(`imp-al-new-${i}`)?.checked);
    const correccionesElegidas = correcciones.filter((_, i) => document.getElementById(`imp-al-fix-${i}`)?.checked);

    let okNuevos = 0, errNuevos = 0, okFix = 0, errFix = 0;

    if (nuevosElegidos.length) {
      const payload = nuevosElegidos.map(c => ({
        full_name: c.full_name || c.apellido || c.nombre || 'Sin nombre',
        first_name: c.nombre || null,
        last_name: c.apellido || null,
        dni: c.dni,
        email: c.email, phone: c.phone,
        anio: c.anio, division: c.division,
        institution_id: this._institutionId || null,
        career_id: this._careerId || null,
      }));

      const { error } = await sb.from('students').insert(payload);
      if (error) {
        // Posible conflicto de DNI entre sí o con un alumno creado mientras tanto:
        // reintentamos de a uno para no perder los que sí se pueden crear.
        for (const row of payload) {
          const { error: e2 } = await sb.from('students').insert(row);
          if (e2) errNuevos++; else okNuevos++;
        }
      } else {
        okNuevos = payload.length;
      }
    }

    for (const { candidato, existente, cambios } of correccionesElegidas) {
      const payload = {};
      for (const ch of cambios) payload[ch.field] = ch.value;
      if (payload.first_name !== undefined || payload.last_name !== undefined) {
        payload.full_name = `${payload.first_name ?? existente.first_name ?? ''} ${payload.last_name ?? existente.last_name ?? ''}`.trim() || existente.full_name;
      }
      const { error } = await sb.from('students').update(payload).eq('id', existente.id);
      if (error) { errFix++; continue; }
      okFix++;

      // Si cambió el curso, se muda a las materias de su nueva división (con su historial)
      if ('anio' in payload || 'division' in payload) {
        const { error: e2 } = await sb.rpc('kinnos_reubicar_alumno', { p_student: existente.id });
        if (e2) errFix++;
      }
    }

    Utils.btnLoading(btn, false);

    const partes = [];
    if (okNuevos) partes.push(`${okNuevos} alumnos nuevos`);
    if (okFix)    partes.push(`${okFix} corregidos`);
    if (!partes.length) partes.push('nada para aplicar');
    const errs = errNuevos + errFix;

    Utils.toast(`Importación lista: ${partes.join(', ')}${errs ? ` — ${errs} con error` : ''}`, errs ? 'error' : 'success');
    this.cerrar();
    AdminAlumnos.init();
  },
};
