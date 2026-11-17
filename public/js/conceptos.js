let modoEdicionConcepto = false;

async function cargarTablaConceptos() {
  const tbody = document.getElementById('tbodyConceptos');
  if (!tbody) return;

  try {
    const res = await fetch('/api/conceptos-ventas');
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">No hay conceptos registrados.</td></tr>';
        return;
      }

      let html = '';
      data.datos.forEach(c => {
        html += `
          <tr>
            <td class="fw-bold">#${c.codigo}</td>
            <td class="fw-semibold text-uppercase">${c.descripcion}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary py-0 px-2 me-1" onclick="prepararEdicionConcepto(${c.codigo}, '${c.descripcion.replace(/'/g, "\\'")}')">✏️</button>
              <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="eliminarConcepto(${c.codigo})">🗑️</button>
            </td>
          </tr>`;
      });
      tbody.innerHTML = html;
    }
  } catch (err) {
    console.error('❌ Error al cargar conceptos:', err);
  }
}

async function abrirModalConceptos() {
  cancelarEdicionConcepto();
  
  // 1°. Mostrar el modal inmediatamente
  const modalEl = document.getElementById('modalConceptos');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }

  // 2°. Cargar o refrescar la lista de conceptos desde el backend
  await cargarTablaConceptos();
}

function prepararEdicionConcepto(codigo, descripcion) {
  modoEdicionConcepto = true;
  const inputCod = document.getElementById('concepto_codigo');
  const inputDesc = document.getElementById('concepto_descripcion');
  const btnGuardar = document.getElementById('btnGuardarConcepto');
  const btnCancelar = document.getElementById('btnCancelarConcepto');

  if (inputCod) {
    inputCod.value = codigo;
    inputCod.readOnly = true;
  }
  if (inputDesc) inputDesc.value = descripcion;
  if (btnGuardar) btnGuardar.innerHTML = '💾 Actualizar';
  if (btnCancelar) btnCancelar.classList.remove('d-none');
}

function cancelarEdicionConcepto() {
  modoEdicionConcepto = false;
  const form = document.getElementById('formConcepto');
  if (form) form.reset();

  const inputCod = document.getElementById('concepto_codigo');
  const btnGuardar = document.getElementById('btnGuardarConcepto');
  const btnCancelar = document.getElementById('btnCancelarConcepto');

  if (inputCod) inputCod.readOnly = false;
  if (btnGuardar) btnGuardar.innerHTML = '➕ Guardar';
  if (btnCancelar) btnCancelar.classList.add('d-none');
}

async function guardarConcepto(e) {
  e.preventDefault();
  const alerta = document.getElementById('alertaConceptosModal');
  if (alerta) alerta.innerHTML = '';

  const codigo = document.getElementById('concepto_codigo')?.value;
  const descripcion = document.getElementById('concepto_descripcion')?.value;

  const url = modoEdicionConcepto ? `/api/conceptos-ventas/${codigo}` : '/api/conceptos-ventas';
  const metodo = modoEdicionConcepto ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, descripcion })
    });

    const data = await res.json();

    if (data.success) {
      cancelarEdicionConcepto();
      await cargarTablaConceptos();
      if (typeof cargarAuxiliaresPedidos === 'function') {
        await cargarAuxiliaresPedidos();
      }
    } else {
      if (alerta) alerta.innerHTML = `<div class="alert alert-danger py-1 small">${data.mensaje}</div>`;
    }
  } catch (err) {
    console.error('❌ Error al guardar concepto:', err);
  }
}

async function eliminarConcepto(codigo) {
  if (!confirm(`¿Está seguro de eliminar el concepto #${codigo}?`)) return;

  try {
    const res = await fetch(`/api/conceptos-ventas/${codigo}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      await cargarTablaConceptos();
      if (typeof cargarAuxiliaresPedidos === 'function') {
        await cargarAuxiliaresPedidos();
      }
    } else {
      alert(data.mensaje || 'No se pudo eliminar el concepto.');
    }
  } catch (err) {
    console.error('❌ Error al eliminar concepto:', error);
  }
}

window.abrirModalConceptos = abrirModalConceptos;
window.prepararEdicionConcepto = prepararEdicionConcepto;
window.cancelarEdicionConcepto = cancelarEdicionConcepto;
window.guardarConcepto = guardarConcepto;
window.eliminarConcepto = eliminarConcepto;