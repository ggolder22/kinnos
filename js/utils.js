const Utils = {
  toast(msg, tipo = 'success') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  async confirmar(msg) {
    return window.confirm(msg);
  },

  formatDate(iso) {
    if (!iso) return '—';
    // Fecha "pelada" (sin hora), ej: columnas `date` como session_date o due_date.
    // new Date('2026-10-01') la interpreta como medianoche UTC, y al mostrarla en huso
    // horario argentino (UTC-3) se corre un día para atrás. Acá se formatea directo,
    // sin pasar por conversión de huso horario.
    const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    if (soloFecha) {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    }
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  },

  // Fecha de HOY según el reloj del dispositivo (hora local), no UTC —
  // evita que entre las 21:00 y las 23:59 (Argentina, UTC-3) la app crea
  // que ya es "mañana".
  hoyLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // Muestra el spinner de un botón y lo devuelve al estado original al terminar
  btnLoading(btn, loading) {
    if (loading) {
      btn._txt = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    } else {
      btn.disabled = false;
      btn.textContent = btn._txt || 'Guardar';
    }
  },

  // Nombre de un alumno en formato "Apellido, Nombre", como exige el ministerio
  // en planillas (asistencia, actas de examen, listados). Si el alumno todavía
  // no tiene nombre/apellido separados (registro viejo), muestra full_name tal
  // cual viene — no se puede partir un string a ciegas sin arriesgar un error.
  nombrePlanilla(alumno) {
    if (!alumno) return '';
    if (alumno.last_name && alumno.first_name) return `${alumno.last_name}, ${alumno.first_name}`;
    return alumno.full_name || '';
  },

  // Descarga un CSV: headers = ['Col1','Col2',...], filas = [[v1,v2,...], ...]
  descargarCsv(nombreArchivo, headers, filas) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...filas.map(f => f.map(esc).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Nota final de un resultado de examen: la corrección del profesor manda si
  // existe, si no se usa la nota automática. Redondeada a un decimal sobre /10
  // (score/professor_score se guardan en escala 0-100).
  notaFinal(resultado) {
    const raw = resultado.professor_score ?? resultado.score;
    const score = Math.round(raw / 10 * 10) / 10;
    return { score, label: `${score}/10` };
  },

  // Convierte una nota 0-10 a palabras ("Siete con cinco"), para actas impresas.
  numeroALetras(n) {
    const PALABRAS = ['Cero', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'];
    const entero  = Math.floor(n);
    const decimal = Math.round((n - entero) * 10);
    const base = PALABRAS[entero] ?? String(entero);
    if (!decimal) return base;
    return `${base} con ${(PALABRAS[decimal] ?? String(decimal)).toLowerCase()}`;
  },

  // Abre una ventana e imprime un acta con el formato estándar (encabezado +
  // meta + tabla + resumen + firmas) usado por calificaciones y exámenes.
  // meta y firmas son opcionales; firmas es un array de leyendas ("Firma y
  // aclaración — Docente") y se reparten lado a lado si hay más de una.
  imprimirActa({ titulo, institucion, lineasHeader = [], meta = '', bodyHtml, resumen = '', firmas = [] }) {
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 36px; color: #111; }
        .header { text-align: center; margin-bottom: 18px; }
        .header h1 { font-size: 1.15rem; margin-bottom: 2px; }
        .header p { font-size: .85rem; color: #444; margin: 1px 0; }
        .meta { font-size: .85rem; margin: 18px 0 10px; border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 8px 0; }
        .meta-flex { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #999; padding: 6px 10px; font-size: .85rem; text-align: left; }
        th { background: #eee; }
        .resumen { margin-top: 14px; font-size: .82rem; }
        .firmas { display: flex; justify-content: center; gap: 24px; margin-top: 90px; flex-wrap: wrap; }
        .firma { width: 260px; text-align: center; font-size: .82rem; }
        .firma .linea { border-top: 1px solid #333; margin-bottom: 4px; padding-top: 4px; }
      </style></head><body>
        <div class="header">
          <h1>${institucion || 'Institución'}</h1>
          ${lineasHeader.map(l => `<p>${l}</p>`).join('')}
        </div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
        ${bodyHtml}
        ${resumen ? `<div class="resumen">${resumen}</div>` : ''}
        ${firmas.length ? `<div class="firmas">${firmas.map(f => `<div class="firma"><div class="linea">&nbsp;</div>${f}</div>`).join('')}</div>` : ''}
      </body></html>`);
    win.document.close();
    win.print();
  },

  // Par de <select> año/división usado en varios listados con filtro
  // "filtrar('anio', this.value)". handlerExpr es la llamada sin paréntesis
  // de argumentos, ej. "PreceptorAlumnos.filtrar" o "ProfesorTrabajos.filtrarEntregas".
  selectsAnioDivision(handlerExpr, filtroAnio, filtroDivision, anios = [1, 2, 3, 4]) {
    return `
      <select onchange="${handlerExpr}('anio', this.value)" style="width:auto;padding:5px 10px">
        <option value="">Todos los años</option>
        ${anios.map(y => `<option value="${y}" ${filtroAnio === String(y) ? 'selected' : ''}>${y}°</option>`).join('')}
      </select>
      <select onchange="${handlerExpr}('division', this.value)" style="width:auto;padding:5px 10px">
        <option value="">Ambas divisiones</option>
        <option value="A" ${filtroDivision === 'A' ? 'selected' : ''}>División A</option>
        <option value="B" ${filtroDivision === 'B' ? 'selected' : ''}>División B</option>
      </select>`;
  },

  // Renderiza <option> en un <select>
  fillSelect(selectId, items, valueKey, labelKey, placeholderText) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = `<option value="">${placeholderText}</option>`;
    items.forEach(i => {
      const o = document.createElement('option');
      o.value = i[valueKey];
      o.textContent = i[labelKey];
      sel.appendChild(o);
    });
  },
};
