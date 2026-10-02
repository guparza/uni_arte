// public/js/rubros.js (FILTRADO COMBINADO CÓDIGO + TEXTO)
let rubrosData = [];
let modalRubrosInstancia = null;

document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('modalRubros');
  if (modalEl && typeof bootstrap !== 'undefined') {
    modalRubrosInstancia = new bootstrap.Modal(modalEl);
  }

  const formRubro = document.getElementById('formRubro');
  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');

  if (formRubro) {
    // 🎯 Auto-seleccionar texto al recibir foco
    [inputCodigo, inputNombre].forEach(input => {
      if (input) {
        input.addEventListener('focus', () => {
          setTimeout(() => {
            if (typeof input.select === 'function') input.select();
          }, 50);
        });
      }
    });

    // ⌨️ Navegación con tecla Enter entre campos
    formRubro.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.target === inputCodigo) {
          inputNombre?.focus();
        } else if (e.target === inputNombre) {
          guardarRubro();
        }
      }
    });
  }

  // 🔍 FILTRADO DUAL EN TIEMPO REAL (Por código y por texto de descripción)
  const aplicarFiltroRubros = () => {
    const esEdicion = document.getElementById('rubroEsEdicion')?.value === 'true';
    if (esEdicion) return; // En modo edición no se filtra la tabla

    const codValor = inputCodigo?.value.trim() || '';
    const descValor = inputNombre?.value.trim().toLowerCase() || '';

    if (!codValor && !descValor) {
      renderizarTablaRubros(rubrosData);
      return;
    }

    const filtrados = rubrosData.filter(r => {
      const coincideCodigo = codValor ? String(r.codigo).startsWith(codValor) : true;
      const coincideDesc = descValor ? String(r.descripcion || '').toLowerCase().includes(descValor) : true;
      return coincideCodigo && coincideDesc;
    });

    renderizarTablaRubros(filtrados);
  };

  if (inputCodigo) inputCodigo.addEventListener('input', aplicarFiltroRubros);
  if (inputNombre) inputNombre.addEventListener('input', aplicarFiltroRubros);
});

// 📁 Abrir Modal de Rubros
function abrirModalRubros() {
  limpiarFormRubro();
  cargarRubrosTabla();

  if (!modalRubrosInstancia) {
    const modalEl = document.getElementById('modalRubros');
    if (modalEl && typeof bootstrap !== 'undefined') {
      modalRubrosInstancia = new bootstrap.Modal(modalEl);
    }
  }

  if (modalRubrosInstancia) {
    modalRubrosInstancia.show();
    setTimeout(() => {
      document.getElementById('inputCodigoRubro')?.focus();
    }, 400);
  }
}

// 📋 Cargar lista desde la API
async function cargarRubrosTabla() {
  const tbody = document.getElementById('tablaRubros');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">Cargando rubros...</td></tr>';
    const res = await fetch('/api/rubros');
    const resultado = await res.json();

    if (resultado.success && Array.isArray(resultado.data)) {
      // Ordenar por código numérico de menor a mayor
      rubrosData = resultado.data.sort((a, b) => Number(a.codigo) - Number(b.codigo));
      renderizarTablaRubros(rubrosData);
    } else {
      rubrosData = [];
      tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No hay rubros registrados.</td></tr>';
    }
  } catch (error) {
    console.error('Error al cargar tabla de rubros:', error);
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-3">Error de conexión.</td></tr>';
  }
}

// 🎨 Renderizar filas en la tabla garantizando visibilidad total de los botones
function renderizarTablaRubros(lista) {
  const tbody = document.getElementById('tablaRubros');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">No se encontraron códigos coincidentes.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(r => {
    const descEscapada = String(r.descripcion || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return `
      <tr>
        <td class="fw-bold text-secondary">${r.codigo}</td>
        <td>${r.descripcion}</td>
        <td class="text-center text-nowrap">
          <div class="d-flex justify-content-center gap-1">
            <button class="btn btn-sm btn-primary py-0 px-2" 
                    onclick="editarRubro(${r.codigo}, '${descEscapada}')"
                    title="Editar rubro">
              ✏️ Editar
            </button>
            <button class="btn btn-sm btn-danger py-0 px-2" 
                    onclick="eliminarRubro(${r.codigo})"
                    title="Eliminar rubro">
              🗑️ Eliminar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 💾 Guardar o Actualizar Rubro
async function guardarRubro() {
  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');
  const esEdicion = document.getElementById('rubroEsEdicion')?.value === 'true';
  const alertaDiv = document.getElementById('alertaRubro');

  const codigo = parseInt(inputCodigo?.value);
  const descripcion = (inputNombre?.value || '').trim().toUpperCase();

  if (isNaN(codigo) || codigo < 0) {
    if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-warning py-1 small">Ingresá un código numérico válido.</div>';
    inputCodigo?.focus();
    return;
  }
  if (!descripcion) {
    if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-warning py-1 small">Escribí la descripción del rubro.</div>';
    inputNombre?.focus();
    return;
  }

  const url = esEdicion ? `/api/rubros/${codigo}` : '/api/rubros';
  const metodo = esEdicion ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, descripcion })
    });
    const resultado = await res.json();

    if (resultado.success) {
      limpiarFormRubro();
      await cargarRubrosTabla();
      
      // Sincronizar el selector desplegable de artículos si la función existe
      if (typeof window.cargarRubrosSelect === 'function') {
        window.cargarRubrosSelect();
      }
      
      document.getElementById('inputCodigoRubro')?.focus();
    } else {
      if (alertaDiv) alertaDiv.innerHTML = `<div class="alert alert-danger py-1 small">${resultado.mensaje}</div>`;
    }
  } catch (error) {
    console.error('Error al guardar rubro:', error);
    if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-danger py-1 small">Error de conexión.</div>';
  }
}

// ✏️️ Cargar rubro para editar
function editarRubro(codigo, descripcion) {
  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');

  if (inputCodigo) {
    inputCodigo.value = codigo;
    inputCodigo.readOnly = true;
  }
  if (inputNombre) inputNombre.value = descripcion;
  
  const inputEdicion = document.getElementById('rubroEsEdicion');
  if (inputEdicion) inputEdicion.value = 'true';

  const btnGuardar = document.getElementById('btnGuardarRubro');
  const btnCancelar = document.getElementById('btnCancelarRubro');

  if (btnGuardar) btnGuardar.innerText = '💾 Guardar';
  if (btnCancelar) btnCancelar.classList.remove('d-none');

  renderizarTablaRubros(rubrosData);
  inputNombre?.focus();
}

// ❌ Limpiar formulario
function limpiarFormRubro() {
  const inputCodigo = document.getElementById('inputCodigoRubro');
  const inputNombre = document.getElementById('inputNombreRubro');

  if (inputCodigo) {
    inputCodigo.value = '';
    inputCodigo.readOnly = false;
  }
  if (inputNombre) inputNombre.value = '';
  
  const inputEdicion = document.getElementById('rubroEsEdicion');
  if (inputEdicion) inputEdicion.value = 'false';

  const alertaDiv = document.getElementById('alertaRubro');
  if (alertaDiv) alertaDiv.innerHTML = '';

  const btnGuardar = document.getElementById('btnGuardarRubro');
  const btnCancelar = document.getElementById('btnCancelarRubro');

  if (btnGuardar) btnGuardar.innerText = '➕ Agregar';
  if (btnCancelar) btnCancelar.classList.add('d-none');

  renderizarTablaRubros(rubrosData);
}

// 🗑️ Eliminar Rubro
async function eliminarRubro(codigo) {
  if (!confirm(`¿Deseás eliminar el rubro #${codigo}?`)) return;

  try {
    const res = await fetch(`/api/rubros/${codigo}`, { method: 'DELETE' });
    const resultado = await res.json();

    if (resultado.success) {
      await cargarRubrosTabla();
      if (typeof window.cargarRubrosSelect === 'function') {
        window.cargarRubrosSelect();
      }
    } else {
      alert(`⚠️ ${resultado.mensaje}`);
    }
  } catch (error) {
    console.error('Error al eliminar rubro:', error);
    alert('Error al conectar con el servidor.');
  }
}

// Exposición global de funciones
window.abrirModalRubros = abrirModalRubros;
window.guardarRubro = guardarRubro;
window.editarRubro = editarRubro;
window.limpiarFormRubro = limpiarFormRubro;
window.eliminarRubro = eliminarRubro;
window.cargarRubrosTabla = cargarRubrosTabla;