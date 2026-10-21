// public/js/rubros.js - Módulo de Rubros UniArte

let rubrosData = [];
let timerBusquedaRubro = null;

document.addEventListener('DOMContentLoaded', () => {
  cargarRubrosTabla();

  const inputBuscarRubro = document.getElementById('inputBuscarRubro');
  if (inputBuscarRubro) {
    inputBuscarRubro.addEventListener('input', (e) => {
      clearTimeout(timerBusquedaRubro);
      timerBusquedaRubro = setTimeout(() => {
        const valor = e.target.value.trim().toLowerCase();
        if (!valor) {
          renderizarTablaRubros(rubrosData);
          return;
        }
        const filtrados = rubrosData.filter(r => 
          String(r.codigo).toLowerCase().includes(valor) || 
          String(r.descripcion || '').toLowerCase().includes(valor)
        );
        renderizarTablaRubros(filtrados);
      }, 200);
    });
  }
});

// 📁 Abrir Modal para Nuevo Rubro
function abrirModalCrearRubro() {
  limpiarFormRubro();

  const modalEl = document.getElementById('modalRubro') || document.getElementById('modalRubros');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
    setTimeout(() => document.getElementById('inputCodigoRubro')?.focus(), 350);
  }
}

// 📋 Cargar catálogo de rubros desde la API
async function cargarRubrosTabla() {
  const tbody = document.getElementById('tbodyRubros') || document.getElementById('tablaRubros');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Cargando rubros...</td></tr>';
    const res = await fetch('/api/rubros');
    const resultado = await res.json();
    const lista = resultado.data || resultado.datos || [];

    if (resultado.success && Array.isArray(lista)) {
      rubrosData = lista.sort((a, b) => Number(a.codigo) - Number(b.codigo));
      renderizarTablaRubros(rubrosData);
    } else {
      rubrosData = [];
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No hay rubros registrados.</td></tr>';
    }
  } catch (error) {
    console.error('❌ Error al cargar tabla de rubros:', error);
  }
}

// 🎨 Renderizar filas
function renderizarTablaRubros(lista) {
  const tbody = document.getElementById('tbodyRubros') || document.getElementById('tablaRubros');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No se encontraron rubros.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(r => `
    <tr>
      <td class="fw-bold align-middle">${r.codigo}</td>
      <td class="align-middle fw-semibold">${r.descripcion || '-'}</td>
      <td class="text-end align-middle">
        <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" onclick="prepararEdicionRubro('${r.codigo}')" title="Editar">✏️</button>
        <button class="btn btn-sm btn-outline-danger px-2 py-0" onclick="eliminarRubro('${r.codigo}')" title="Eliminar">🗑️</button>
      </td>
    </tr>
  `).join('');
}

// ✏️ Cargar rubro en el modal desde la memoria local
function prepararEdicionRubro(codigo) {
  // Buscar el rubro directamente en la lista local ya cargada
  const r = rubrosData.find(item => item.codigo == codigo);

  if (!r) {
    console.error('❌ No se encontró el rubro en la lista local:', codigo);
    return;
  }

  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');
  const inputEdicion = document.getElementById('rubroEsEdicion');
  const alertaDiv = document.getElementById('alertaRubroModal') || document.getElementById('alertaRubro');

  if (alertaDiv) alertaDiv.innerHTML = '';

  if (inputCodigo) {
    inputCodigo.value = r.codigo;
    inputCodigo.readOnly = true; // Bloquea la clave primaria al editar
  }
  if (inputNombre) inputNombre.value = r.descripcion || '';
  if (inputEdicion) inputEdicion.value = 'true'; // Activa el modo edición (PUT)

  const modalEl = document.getElementById('modalRubro') || document.getElementById('modalRubros');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
    setTimeout(() => inputNombre?.focus(), 350);
  }
}

// 💾 Guardar o Actualizar Rubro
async function guardarRubro() {
  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');
  const inputEdicion = document.getElementById('rubroEsEdicion');
  const alertaDiv = document.getElementById('alertaRubroModal') || document.getElementById('alertaRubro');

  const esEdicion = inputEdicion?.value === 'true';
  const codigoVal = inputCodigo?.value.trim();
  const descripcionVal = inputNombre?.value.trim().toUpperCase();
  const codigo = parseInt(codigoVal);

  if (!codigoVal || isNaN(codigo) || codigo < 0) {
    if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-warning py-1 small">Ingresá un código numérico válido.</div>';
    return;
  }
  if (!descripcionVal) {
    if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-warning py-1 small">Ingresá la descripción del rubro.</div>';
    return;
  }

  // Define la URL y método HTTP según corresponda (PUT para actualizar, POST para crear)
  const url = esEdicion ? `/api/rubros/${codigo}` : '/api/rubros';
  const metodo = esEdicion ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, descripcion: descripcionVal, nombre: descripcionVal })
    });

    const resultado = await res.json();

    if (resultado.success) {
      const modalEl = document.getElementById('modalRubro') || document.getElementById('modalRubros');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.hide();
      }
      limpiarFormRubro();
      await cargarRubrosTabla();
    } else {
      if (alertaDiv) alertaDiv.innerHTML = `<div class="alert alert-danger py-1 small">${resultado.mensaje}</div>`;
    }
  } catch (error) {
    console.error('❌ Error al guardar rubro:', error);
  }
}

// ❌ Limpiar formulario
function limpiarFormRubro() {
  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');
  const inputEdicion = document.getElementById('rubroEsEdicion');
  const alertaDiv = document.getElementById('alertaRubroModal') || document.getElementById('alertaRubro');

  if (inputCodigo) {
    inputCodigo.value = '';
    inputCodigo.readOnly = false;
  }
  if (inputNombre) inputNombre.value = '';
  if (inputEdicion) inputEdicion.value = 'false';
  if (alertaDiv) alertaDiv.innerHTML = '';
}

// 🗑️ Eliminar Rubro
async function eliminarRubro(codigo) {
  if (!confirm(`¿Deseás eliminar el rubro #${codigo}?`)) return;

  try {
    const res = await fetch(`/api/rubros/${codigo}`, { method: 'DELETE' });
    const resultado = await res.json();

    if (resultado.success) {
      await cargarRubrosTabla();
    } else {
      alert(`⚠️ ${resultado.mensaje}`);
    }
  } catch (error) {
    console.error('❌ Error al eliminar rubro:', error);
  }
}

// Exposición global
window.abrirModalCrearRubro = abrirModalCrearRubro;
window.abrirModalRubros = abrirModalCrearRubro;
window.guardarRubro = guardarRubro;
window.prepararEdicionRubro = prepararEdicionRubro;
window.editarRubro = prepararEdicionRubro;
window.limpiarFormRubro = limpiarFormRubro;
window.eliminarRubro = eliminarRubro;
window.cargarRubrosTabla = cargarRubrosTabla;