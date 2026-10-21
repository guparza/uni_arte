// public/js/articulos.js - Módulo de Artículos UniArte

let modoEdicionArticulo = false;
let timerBusquedaArticulo = null;

// ⌨️ Función universal para saltar de campo en campo con ENTER
function habilitarSaltoEnter(formId, funcionGuardar) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
      e.preventDefault();

      const campos = Array.from(
        form.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled])')
      ).filter(el => el.type !== 'hidden' && el.style.display !== 'none');

      const index = campos.indexOf(e.target);

      if (index > -1 && index < campos.length - 1) {
        const siguiente = campos[index + 1];
        siguiente.focus();

        if (siguiente.tagName === 'INPUT' && typeof siguiente.select === 'function') {
          setTimeout(() => siguiente.select(), 50);
        }
      } else if (index === campos.length - 1 && typeof funcionGuardar === 'function') {
        funcionGuardar();
      }
    }
  });
}

// 1. 📋 Cargar rubros en el desplegable del modal
async function cargarRubrosSelect() {
  const selectRubro = document.getElementById('rubro_articulo');
  if (!selectRubro) return;

  try {
    const res = await fetch('/api/rubros');
    const data = await res.json();
    const lista = data.data || data.datos || [];

    if (data.success && Array.isArray(lista)) {
      let options = '<option value="0">-- Sin Rubro --</option>';
      lista.forEach(r => {
        options += `<option value="${r.codigo}">${r.descripcion}</option>`;
      });
      selectRubro.innerHTML = options;
    }
  } catch (error) {
    console.error('❌ Error al cargar desplegable de rubros:', error);
  }
}

// 2. 🔍 Cargar catálogo de artículos
async function cargarArticulos(buscar = '') {
  const tbody = document.getElementById('tbodyArticulos');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/articulos?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted py-3">No se encontraron artículos.</td>
          </tr>`;
        return;
      }

      let html = '';
      data.datos.forEach(a => {
        const precio = Number(a.precio_venta || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
        const medidas = (a.ancho && a.alto) ? `${a.ancho} x ${a.alto} cm` : '-';
        const sup = a.superficie ? `${a.superficie} cm²` : '-';

        html += `
          <tr>
            <td class="fw-bold align-middle">${a.codigo}</td>
            <td class="align-middle fw-semibold">${a.descripcion || '-'}</td>
            <td class="align-middle small text-muted">${a.rubro_desc || '-'}</td>
            <td class="align-middle text-end fw-bold">$ ${precio}</td>
            <td class="align-middle text-center small">${medidas}</td>
            <td class="align-middle text-center small">${sup}</td>
            <td class="text-end align-middle">
              <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" title="Editar" onclick="prepararEdicionArticulo('${a.codigo}')">✏️</button>
              <button class="btn btn-sm btn-outline-danger px-2 py-0" title="Eliminar" onclick="eliminarArticulo('${a.codigo}')">🗑️</button>
            </td>
          </tr>`;
      });
      tbody.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Error al cargar artículos:', error);
  }
}

// 3. 🔤 Concatenar código en MAYÚSCULAS
function actualizarCodigoFinal() {
  const prefijo = (document.getElementById('codigo_prefijo')?.value || '').trim().toUpperCase();
  const sufijo = (document.getElementById('codigo_sufijo')?.value || '').trim().toUpperCase();
  const inputFinal = document.getElementById('codigo_articulo');

  if (inputFinal && !modoEdicionArticulo) {
    inputFinal.value = prefijo && sufijo ? `${prefijo}-${sufijo}` : prefijo || sufijo;
  }
}

// 📐 Calcular superficie (cm²)
function calcularSuperficie() {
  const ancho = parseFloat(document.getElementById('ancho')?.value) || 0;
  const alto = parseFloat(document.getElementById('alto')?.value) || 0;
  const inputSup = document.getElementById('superficie');
  if (inputSup) {
    inputSup.value = (ancho * alto).toFixed(2);
  }
}

// 4. ➕ Abrir modal para nuevo artículo
async function abrirModalCrearArticulo() {
  modoEdicionArticulo = false;

  const form = document.getElementById('formArticulo');
  if (form) form.reset();

  quitarImagenSeleccionada();
  await cargarRubrosSelect();

  const inputCodigo = document.getElementById('codigo_articulo');
  if (inputCodigo) inputCodigo.readOnly = false;

  const modalEl = document.getElementById('modalArticulo');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
}

// 5. ✏️ Cargar artículo e imagen al editar
async function prepararEdicionArticulo(codigo) {
  try {
    modoEdicionArticulo = true;
    quitarImagenSeleccionada();
    await cargarRubrosSelect();

    const res = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`);
    const data = await res.json();

    if (data.success && data.dato) {
      const a = Array.isArray(data.dato) ? data.dato[0] : data.dato;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== null && val !== undefined ? val : '';
      };

      setVal('codigo_articulo', a.codigo);
      setVal('descripcion_articulo', a.descripcion);
      setVal('rubro_articulo', a.rubro);
      setVal('precio_venta', a.precio_venta);
      setVal('ancho', a.ancho);
      setVal('alto', a.alto);
      setVal('superficie', a.superficie);
      setVal('obs', a.obs);

      const inputCodigo = document.getElementById('codigo_articulo');
      if (inputCodigo) inputCodigo.readOnly = true;

// Cargar la foto usando la extensión .png y timestamp anti-caché
const imgPreview = document.getElementById('imgVistaPrevia');
const contenedor = document.getElementById('contenedorPreview');

if (imgPreview) {
  // 👈 Se cambió a .png para coincidir con las imágenes extraídas y las nuevas
  imgPreview.src = `/uploads/articulos/${encodeURIComponent(a.codigo)}.png?t=${Date.now()}`;
  
  if (contenedor) contenedor.classList.remove('d-none');
  imgPreview.style.display = 'block';

  imgPreview.onerror = () => {
    quitarImagenSeleccionada(); // Si el producto no tiene foto física, oculta el contenedor
  };
}

      const modalEl = document.getElementById('modalArticulo');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
      }
    }
  } catch (error) {
    console.error('❌ Error al preparar edición de artículo:', error);
  }
}

// 6. 💾 Guardar datos del artículo
async function guardarArticulo() {
  const alerta = document.getElementById('alertaArticuloModal');
  if (alerta) alerta.innerHTML = '';

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const codigoVal = getVal('codigo_articulo').toUpperCase();
  const descripcionVal = getVal('descripcion_articulo').toUpperCase();
  const rubroVal = parseInt(getVal('rubro_articulo')) || 0;

  if (!codigoVal || !descripcionVal) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">El código y la descripción son obligatorios.</div>';
    return;
  }

  if (rubroVal === 0) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">Por favor, seleccioná un rubro de la lista.</div>';
    document.getElementById('rubro_articulo').focus();
    return;
  }

  const payload = {
    codigo: codigoVal,
    descripcion: descripcionVal,
    rubro: parseInt(getVal('rubro_articulo')) || 0,
    precio_venta: parseFloat(getVal('precio_venta')) || 0,
    ancho: parseFloat(getVal('ancho')) || 0,
    alto: parseFloat(getVal('alto')) || 0,
    obs: getVal('obs').toUpperCase()
  };

  const url = modoEdicionArticulo ? `/api/articulos/${encodeURIComponent(codigoVal)}` : '/api/articulos';
  const metodo = modoEdicionArticulo ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resultado = await res.json();

    if (resultado.success) {
      const inputFoto = document.getElementById('inputFotoArticulo');
      if (inputFoto && inputFoto.files && inputFoto.files[0]) {
        const formData = new FormData();
        formData.append('codigo', codigoVal);
        formData.append('imagen', inputFoto.files[0]);

        await fetch('/api/articulos/upload', {
          method: 'POST',
          body: formData
        });
      }

      const modalEl = document.getElementById('modalArticulo');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      await cargarArticulos();
    } else {
      if (alerta) alerta.innerHTML = `<div class="alert alert-danger py-1 small">${resultado.mensaje}</div>`;
    }
  } catch (error) {
    console.error('❌ Error al guardar artículo:', error);
  }
}

// 7. 🗑️ Eliminar artículo
async function eliminarArticulo(codigo) {
  if (!confirm(`¿Está seguro de que desea eliminar el artículo "${codigo}"?`)) return;

  try {
    const res = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      await cargarArticulos();
    } else {
      alert(data.mensaje || 'No se pudo eliminar el artículo.');
    }
  } catch (error) {
    console.error('❌ Error al eliminar artículo:', error);
  }
}

// 🖼️ Vista previa instantánea
function mostrarVistaPreviaImagen(input) {
  const imgPreview = document.getElementById('imgVistaPrevia');
  const contenedor = document.getElementById('contenedorPreview');

  if (input && input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      if (imgPreview) imgPreview.src = e.target.result;
      if (contenedor) contenedor.classList.remove('d-none');
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    quitarImagenSeleccionada();
  }
}

// 🗑️ Quitar vista previa
function quitarImagenSeleccionada() {
  const inputFoto = document.getElementById('inputFotoArticulo');
  const imgPreview = document.getElementById('imgVistaPrevia');
  const contenedor = document.getElementById('contenedorPreview');

  if (inputFoto) inputFoto.value = '';
  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.onerror = null;
  }
  if (contenedor) contenedor.classList.add('d-none');
}

// Inicialización de escuchas
document.addEventListener('DOMContentLoaded', () => {
  cargarArticulos();
  habilitarSaltoEnter('formArticulo', guardarArticulo);

  const inputBuscar = document.getElementById('inputBuscarArticulo');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      clearTimeout(timerBusquedaArticulo);
      timerBusquedaArticulo = setTimeout(() => {
        cargarArticulos(inputBuscar.value.trim());
      }, 200);
    });
  }

  const inputSufijo = document.getElementById('codigo_sufijo');
  if (inputSufijo) {
    inputSufijo.addEventListener('input', () => {
      inputSufijo.value = inputSufijo.value.toUpperCase();
      actualizarCodigoFinal();
    });
  }

  document.getElementById('ancho')?.addEventListener('input', calcularSuperficie);
  document.getElementById('alto')?.addEventListener('input', calcularSuperficie);

  const inputFoto = document.getElementById('inputFotoArticulo');
  if (inputFoto) {
    inputFoto.addEventListener('change', function () {
      mostrarVistaPreviaImagen(this);
    });
  }

  document.querySelectorAll('#modalArticulo input[type="text"], #modalArticulo input[type="number"]').forEach(input => {
    input.addEventListener('focus', function () { this.select(); });
  });
});

window.cargarArticulos = cargarArticulos;
window.abrirModalCrearArticulo = abrirModalCrearArticulo;
window.prepararEdicionArticulo = prepararEdicionArticulo;
window.guardarArticulo = guardarArticulo;
window.eliminarArticulo = eliminarArticulo;
window.quitarImagenSeleccionada = quitarImagenSeleccionada;