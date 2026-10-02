// public/js/articulos.js
let articulosData = []; // Memoria RAM local
let modoEdicion = false;
let modalArticulo = null;
let timerBusqueda = null; // Timer para el debounce del buscador

const placeholderSvg = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNlOWVjZWYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSI3IiBmb250LWdlaWdodD0iYm9sZCIgZmlsbD0iIzZjNzVkIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+U0lOIEZPVE88L3RleHQ+PC9zdmc+";

document.addEventListener('DOMContentLoaded', () => {
  const modalEl = document.getElementById('modalArticulo');
  if (modalEl && typeof bootstrap !== 'undefined') {
    modalArticulo = new bootstrap.Modal(modalEl);
  }

  cargarArticulos();
  cargarRubrosSelect();

  const inputBuscar = document.getElementById('buscarInput') || document.getElementById('buscar');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', filtrarTabla);
  }

  const formArticulo = document.getElementById('formArticulo');
  if (formArticulo) {
    // Auto-seleccionar texto al recibir foco
    formArticulo.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('focus', () => {
        setTimeout(() => {
          if (typeof input.select === 'function') input.select();
        }, 50);
      });
    });

    // Navegación con tecla Enter entre campos
    formArticulo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
        e.preventDefault();
        const enfocables = Array.from(
          formArticulo.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])')
        );
        const index = enfocables.indexOf(e.target);
        if (index > -1 && index < enfocables.length - 1) {
          const siguiente = enfocables[index + 1];
          siguiente.focus();
          if (typeof siguiente.select === 'function') siguiente.select();
        }
      }
    });
  }

  // Auto-armado de código
  const inputPrefijo = document.getElementById('codigo_prefijo');
  const inputSufijo = document.getElementById('codigo_sufijo');

  const actualizarCodigoCompleto = () => {
    const prefijo = (inputPrefijo?.value || '').trim().toUpperCase();
    const sufijo = (inputSufijo?.value || '').trim().toUpperCase();
    const inputCodigo = document.getElementById('codigo');
    if (inputCodigo && !modoEdicion) {
      inputCodigo.value = (prefijo && sufijo) ? `${prefijo}-${sufijo}` : (prefijo || sufijo);
    }
  };

  if (inputPrefijo) inputPrefijo.addEventListener('input', actualizarCodigoCompleto);
  if (inputSufijo) inputSufijo.addEventListener('input', actualizarCodigoCompleto);
});

// 📋 Cargar lista completa desde la API a la memoria RAM
async function cargarArticulos() {
  const tbody = document.getElementById('tablaArticulos');
  if (!tbody) return;

  try {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">Cargando catálogo...</td></tr>';

    const res = await fetch('/api/articulos');
    const resultado = await res.json();

    if (resultado.success && Array.isArray(resultado.data)) {
      articulosData = resultado.data;
      renderizarTabla(articulosData);
    } else {
      articulosData = [];
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay artículos registrados.</td></tr>';
    }
  } catch (error) {
    console.error('Error al cargar artículos:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error de conexión con el servidor.</td></tr>';
  }
}

// 📋 Cargar selector de rubros
async function cargarRubrosSelect() {
  const selectRubro = document.getElementById('rubro');
  if (!selectRubro) return;

  try {
    const res = await fetch('/api/rubros');
    const resultado = await res.json();

    if (resultado.success && Array.isArray(resultado.data)) {
      let opciones = '<option value="0">-- Seleccionar Rubro --</option>';
      resultado.data.forEach(r => {
        opciones += `<option value="${r.codigo}">${r.descripcion}</option>`;
      });
      selectRubro.innerHTML = opciones;
    }
  } catch (error) {
    console.error('Error al cargar rubros en select:', error);
  }
}

// 🎨 Renderizar la tabla (LIMITADO A LAS PRIMERAS 50 FILAS EN PANTALLA)
function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaArticulos');
  if (!tbody) return;

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No se encontraron coincidencias.</td></tr>';
    return;
  }

  // ⚡ LÍMITE DE ALTO RENDIMIENTO: Solo se procesan las primeras 50 filas
  const vistaLimitada = lista.slice(0, 50);

  tbody.innerHTML = vistaLimitada.map(a => {
    const codigoLimpio = String(a.codigo || '').trim().replace(/[/\\?%*:|"<>]/g, '-');
    const fotoUrl = a.tiene_foto 
      ? `/uploads/articulos/${codigoLimpio}.png` 
      : placeholderSvg;

    return `
      <tr>
        <td class="text-center">
          <!-- ⚡ loading="lazy" evita descargar fotos fuera de pantalla -->
          <img src="${fotoUrl}" 
               alt="Foto" 
               class="rounded border" 
               loading="lazy"
               style="width: 40px; height: 40px; object-fit: contain;">
        </td>
        <td><strong>${a.codigo}</strong></td>
        <td>${a.descripcion}</td>
        <td>${a.rubro_nombre || 'SIN RUBRO'}</td>
        <td class="text-end">$ ${parseFloat(a.precio_venta || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-primary py-0 px-2 me-1" onclick="editarArticulo('${a.codigo}')">✏️ Editar</button>
          <button class="btn btn-sm btn-danger py-0 px-2" onclick="eliminarArticulo('${a.codigo}')">🗑️ Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 🔍 Filtrado con DEBOUNCE (espera 200ms al tipear antes de filtrar)
function filtrarTabla() {
  clearTimeout(timerBusqueda);

  timerBusqueda = setTimeout(() => {
    const inputBuscar = document.getElementById('buscarInput') || document.getElementById('buscar');
    const filtro = (inputBuscar?.value || '').toLowerCase().trim();

    if (!filtro) {
      renderizarTabla(articulosData);
      return;
    }

    const filtrados = articulosData.filter(a => {
      const codigo = String(a.codigo || '').toLowerCase();
      const descripcion = String(a.descripcion || '').toLowerCase();
      const rubro = String(a.rubro_nombre || '').toLowerCase();
      return codigo.includes(filtro) || descripcion.includes(filtro) || rubro.includes(filtro);
    });

    renderizarTabla(filtrados);
  }, 200);
}

// ➕ Abrir modal para crear
function abrirModalCrear() {
  modoEdicion = false;
  document.getElementById('formArticulo')?.reset();
  
  const inputCodigo = document.getElementById('codigo');
  if (inputCodigo) inputCodigo.readOnly = true;

  document.getElementById('modalTitulo').innerText = '➕ Nuevo Artículo';
  
  const alertaDiv = document.getElementById('alertaModal');
  if (alertaDiv) alertaDiv.innerHTML = '';

  if (!modalArticulo) {
    const modalEl = document.getElementById('modalArticulo');
    if (modalEl && typeof bootstrap !== 'undefined') modalArticulo = new bootstrap.Modal(modalEl);
  }
  if (modalArticulo) {
    modalArticulo.show();
    setTimeout(() => {
      document.getElementById('codigo_prefijo')?.focus();
    }, 400);
  }
}

// ✏️ Cargar datos para editar
async function editarArticulo(codigo) {
  modoEdicion = true;
  const alertaDiv = document.getElementById('alertaModal');
  if (alertaDiv) alertaDiv.innerHTML = '';

  try {
    const res = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`);
    const resultado = await res.json();

    if (resultado.success && resultado.data.length > 0) {
      const a = resultado.data[0] || resultado.data;

      document.getElementById('codigo_prefijo').value = a.codigo_prefijo || '';
      document.getElementById('codigo_sufijo').value  = a.codigo_sufijo || '';
      document.getElementById('codigo').value         = a.codigo || '';
      document.getElementById('codigo').readOnly       = true;
      document.getElementById('descripcion').value    = a.descripcion || '';
      document.getElementById('rubro').value          = a.rubro || 0;
      document.getElementById('precio_venta').value   = a.precio_venta || 0;
      document.getElementById('llevar_stock').value  = a.llevar_stock || 'S';
      document.getElementById('stock_critico').value = a.stock_critico || 0;
      document.getElementById('ancho').value         = a.ancho || 0;
      document.getElementById('alto').value          = a.alto || 0;
      document.getElementById('tiempo_maquina').value = a.tiempo_maquina || 0;
      document.getElementById('obs').value           = a.obs || '';

      document.getElementById('modalTitulo').innerText = `✏️ Editar Artículo: ${a.codigo}`;

      if (!modalArticulo) {
        const modalEl = document.getElementById('modalArticulo');
        if (modalEl && typeof bootstrap !== 'undefined') modalArticulo = new bootstrap.Modal(modalEl);
      }
      if (modalArticulo) modalArticulo.show();
    }
  } catch (error) {
    console.error('Error al obtener datos del artículo:', error);
    alert('No se pudieron obtener los datos para editar.');
  }
}

// 💾 Guardar
async function guardarArticulo() {
  const alertaDiv = document.getElementById('alertaModal');
  if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-info py-1 mb-0 small">Procesando...</div>';

  const prefijo = (document.getElementById('codigo_prefijo')?.value || '').trim().toUpperCase();
  const sufijo  = (document.getElementById('codigo_sufijo')?.value || '').trim().toUpperCase();
  const codigo  = (document.getElementById('codigo')?.value || '').trim().toUpperCase();
  const inputFoto = document.getElementById('inputFoto');

  const formData = new FormData();
  formData.append('codigo_prefijo', prefijo);
  formData.append('codigo_sufijo', sufijo);
  formData.append('codigo', codigo);
  formData.append('descripcion', (document.getElementById('descripcion')?.value || '').trim().toUpperCase());
  formData.append('obs', (document.getElementById('obs')?.value || '').trim().toUpperCase());

  formData.append('rubro', document.getElementById('rubro') ? document.getElementById('rubro').value : 0);
  formData.append('precio_venta', document.getElementById('precio_venta') ? document.getElementById('precio_venta').value : 0);
  formData.append('llevar_stock', document.getElementById('llevar_stock') ? document.getElementById('llevar_stock').value : 'S');
  formData.append('stock_critico', document.getElementById('stock_critico') ? document.getElementById('stock_critico').value : 0);
  formData.append('ancho', document.getElementById('ancho') ? parseFloat(document.getElementById('ancho').value || 0) : 0);
  formData.append('alto', document.getElementById('alto') ? parseFloat(document.getElementById('alto').value || 0) : 0);
  formData.append('tiempo_maquina', document.getElementById('tiempo_maquina') ? parseFloat(document.getElementById('tiempo_maquina').value || 0) : 0);

  if (inputFoto && inputFoto.files && inputFoto.files.length > 0) {
    formData.append('foto', inputFoto.files[0]);
  }

  const metodo = modoEdicion ? 'PUT' : 'POST';
  const url = modoEdicion ? `/api/articulos/${encodeURIComponent(codigo)}` : '/api/articulos';

  try {
    const respuesta = await fetch(url, { method: metodo, body: formData });
    const resultado = await respuesta.json();

    if (resultado.success) {
      if (alertaDiv) alertaDiv.innerHTML = `<div class="alert alert-success py-1 mb-0 small">${resultado.mensaje}</div>`;
      setTimeout(() => {
        if (modalArticulo) modalArticulo.hide();
        cargarArticulos();
      }, 1000);
    } else {
      if (alertaDiv) alertaDiv.innerHTML = `<div class="alert alert-danger py-1 mb-0 small">${resultado.mensaje}</div>`;
    }
  } catch (error) {
    console.error('Error al guardar:', error);
    if (alertaDiv) alertaDiv.innerHTML = '<div class="alert alert-danger py-1 mb-0 small">Error de conexión con el servidor.</div>';
  }
}

// 🗑️ Eliminar
async function eliminarArticulo(codigo) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el artículo "${codigo}"?`)) return;

  try {
    const respuesta = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
    const resultado = await respuesta.json();

    if (resultado.success) {
      cargarArticulos();
    } else {
      alert(`⚠️ ${resultado.mensaje || 'No se pudo eliminar el artículo.'}`);
    }
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error de conexión al intentar eliminar.');
  }
}

// Funciones globales
window.cargarArticulos = cargarArticulos;
window.filtrarTabla = filtrarTabla;
window.abrirModalCrear = abrirModalCrear;
window.editarArticulo = editarArticulo;
window.guardarArticulo = guardarArticulo;
window.eliminarArticulo = eliminarArticulo;
window.cargarRubrosSelect = cargarRubrosSelect;