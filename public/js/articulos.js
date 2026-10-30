// public/js/articulos.js - Módulo de Gestión de Artículos UniArte

let modoEdicionArticulo = false;
let timerBusquedaArticulo = null;

// ==========================================
// 🛠️ HELPERS DE BÚSQUEDA Y ASIGNACIÓN
// ==========================================

function getModalEl(id) {
  return document.getElementById(id) || 
         document.querySelector(`#modalArticulo #${id}`) || 
         document.querySelector(`#modalArticulo [name="${id}"]`);
}

function getFieldValue(ids) {
  const lista = Array.isArray(ids) ? ids : [ids];
  for (const id of lista) {
    const el = getModalEl(id);
    if (el && el.value !== undefined) return el.value.trim();
  }
  return '';
}

function setFieldValue(ids, valor) {
  const lista = Array.isArray(ids) ? ids : [ids];
  const valLimpio = (valor !== null && valor !== undefined) ? valor : '';
  for (const id of lista) {
    const el = getModalEl(id);
    if (el) {
      el.value = valLimpio;
      return true;
    }
  }
  return false;
}

// ==========================================
// 🔤 GESTIÓN DE CÓDIGO (PREFIJO Y SUFIJO)
// ==========================================

// Armar Código Final en tiempo real (Prefijo + "-" + Sufijo) en MAYÚSCULAS
function actualizarCodigoFinal() {
  const inputPrefijo = getModalEl('codigo_prefijo') || getModalEl('articulo_codigo_prefijo');
  const inputSufijo = getModalEl('codigo_sufijo') || getModalEl('articulo_codigo_sufijo');
  const inputCodigo = getModalEl('codigo_articulo') || getModalEl('articulo_codigo') || getModalEl('codigo');

  if (inputCodigo && !modoEdicionArticulo) {
    const pref = inputPrefijo ? inputPrefijo.value.trim().toUpperCase() : '';
    const suf = inputSufijo ? inputSufijo.value.trim().toUpperCase() : '';

    if (pref && suf) {
      inputCodigo.value = `${pref}-${suf}`;
    } else if (pref) {
      inputCodigo.value = pref;
    } else {
      inputCodigo.value = suf;
    }
  }
}

// ==========================================
// 📋 AUXILIARES: RUBROS Y CÁLCULOS
// ==========================================

// Cargar desplegable de Rubros desde la API
async function cargarRubrosAuxiliares() {
  const selectRubro = getModalEl('articulo_rubro') || getModalEl('rubro_articulo') || getModalEl('rubro');
  if (!selectRubro) return;

  try {
    const res = await fetch('/api/rubros');
    if (!res.ok) return;
    const data = await res.json();

    const lista = data.datos || data.data || (Array.isArray(data) ? data : []);

    if (Array.isArray(lista) && lista.length > 0) {
      let html = '<option value="0">-- Seleccionar Rubro --</option>';
      lista.forEach(r => {
        const cod = r.codigo !== undefined ? r.codigo : r.id;
        const desc = r.descripcion || r.nombre || 'Sin Descripción';
        html += `<option value="${cod}">${cod} - ${desc}</option>`;
      });
      selectRubro.innerHTML = html;
    } else {
      selectRubro.innerHTML = '<option value="0">-- Sin Rubros Registrados --</option>';
    }
  } catch (error) {
    console.warn('⚠️ Error al cargar desplegable de rubros:', error);
  }
}

// Alias para evitar errores de referencia
const cargarRubrosSelect = cargarRubrosAuxiliares;

// Calcular Superficie Automáticamente (cm a m²)
function calcularSuperficie() {
  const ancho = parseFloat(getFieldValue(['articulo_ancho', 'ancho'])) || 0;
  const alto = parseFloat(getFieldValue(['articulo_alto', 'alto'])) || 0;
  const sup = (ancho * alto) / 10000;
  setFieldValue(['articulo_superficie', 'superficie'], sup.toFixed(4));
}

// Vista previa de la imagen al seleccionar un archivo nuevo
function mostrarVistaPreviaFoto(input) {
  const imgPreview = document.getElementById('imgVistaPrevia') || getModalEl('articulo_img_preview');
  const contenedor = document.getElementById('contenedorPreview');
  const btnQuitar = document.getElementById('btn_quitar_imagen');

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      if (imgPreview) imgPreview.src = e.target.result;
      if (contenedor) contenedor.classList.remove('d-none');
      if (btnQuitar) btnQuitar.style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Limpiar imagen seleccionada
function quitarImagenSeleccionada() {
  const inputFoto = getModalEl('articulo_foto') || getModalEl('foto');
  if (inputFoto) inputFoto.value = '';

  const imgPreview = document.getElementById('imgVistaPrevia') || getModalEl('articulo_img_preview');
  if (imgPreview) imgPreview.src = '';

  const contenedor = document.getElementById('contenedorPreview');
  if (contenedor) contenedor.classList.add('d-none');

  const btnQuitar = document.getElementById('btn_quitar_imagen');
  if (btnQuitar) btnQuitar.style.display = 'none';
}

// ==========================================
// ⌨️ NAVEGACIÓN TECLA ENTER
// ==========================================

function habilitarNavegacionEnterModalArticulo() {
  const modal = document.getElementById('modalArticulo');
  if (!modal) return;

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.tagName === 'TEXTAREA' || e.target.type === 'submit') return;

      e.preventDefault();

      const enfocables = Array.from(
        modal.querySelectorAll('input:not([readonly]):not([disabled]):not([type="hidden"]), select, textarea, button.btn-primary')
      ).filter(el => el.offsetParent !== null);

      const index = enfocables.indexOf(e.target);
      if (index > -1 && index < enfocables.length - 1) {
        const siguiente = enfocables[index + 1];
        siguiente.focus();
        if (typeof siguiente.select === 'function') siguiente.select();
      } else if (index === enfocables.length - 1 || e.target.tagName === 'BUTTON') {
        guardarArticulo();
      }
    }
  });
}

// ==========================================
// 📊 GRILLA PRINCIPAL DE ARTÍCULOS
// ==========================================

async function cargarArticulos(buscar = '') {
  const tbody = document.getElementById('tbodyArticulos');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/articulos?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No se encontraron artículos registrados.</td></tr>';
        return;
      }

      let html = '';
      data.datos.forEach(rawItem => {
        let a = Array.isArray(rawItem) ? rawItem[0] : rawItem;
        if (!a || typeof a !== 'object') return;

        const cod = a.codigo || '-';
        const desc = a.descripcion || 'Sin Descripción';
        const rub = a.rubro_desc || '-';
        const medidas = (a.ancho || a.alto) ? `${a.ancho} x ${a.alto}` : '-';
        const supFmt = Number(a.superficie || 0).toFixed(4);
        const pesoFmt = Number(a.peso || 0).toFixed(3);
        
        const valorPrecio = a.precio_venta !== undefined ? a.precio_venta : (a.precio !== undefined ? a.precio : 0);
        const precioFmt = Number(valorPrecio).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        html += `
          <tr>
            <td class="fw-bold align-middle">${cod}</td>
            <td class="align-middle fw-semibold">${desc}</td>
            <td class="align-middle small">${rub}</td>
            <td class="align-middle text-end small">${medidas}</td>
            <td class="align-middle text-end small text-muted">${supFmt} m²</td>
            <td class="align-middle text-end small fw-semibold text-secondary">${pesoFmt} kg</td>
            <td class="align-middle text-end fw-bold text-success">$ ${precioFmt}</td>
            <td class="text-end align-middle text-nowrap">
              <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" title="Editar" onclick="prepararEdicionArticulo('${cod}')">✏️</button>
              <button class="btn btn-sm btn-outline-danger px-2 py-0" title="Eliminar" onclick="eliminarArticulo('${cod}')">🗑️</button>
            </td>
          </tr>`;
      });
      tbody.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Error al cargar artículos:', error);
  }
}

// ==========================================
// ➕ CREAR / ✏️ EDITAR ARTÍCULO
// ==========================================

// Abrir Modal para Crear
async function abrirModalCrearArticulo() {
  modoEdicionArticulo = false;

  const form = document.getElementById('formArticulo') || document.querySelector('#modalArticulo form');
  if (form) form.reset();

  quitarImagenSeleccionada();

  // Desbloquear y habilitar cajas de código
  const inputPrefijo = getModalEl('codigo_prefijo') || getModalEl('articulo_codigo_prefijo');
  const inputSufijo = getModalEl('codigo_sufijo') || getModalEl('articulo_codigo_sufijo');
  const inputCodigo = getModalEl('codigo_articulo') || getModalEl('articulo_codigo') || getModalEl('codigo');

  if (inputPrefijo) { inputPrefijo.disabled = false; inputPrefijo.readOnly = false; inputPrefijo.value = ''; }
  if (inputSufijo) { inputSufijo.disabled = false; inputSufijo.readOnly = false; inputSufijo.value = ''; }
  if (inputCodigo) { inputCodigo.readOnly = false; inputCodigo.value = ''; }

  const alerta = document.getElementById('alertaArticuloModal');
  if (alerta) alerta.innerHTML = '';

  await cargarRubrosAuxiliares();

  const modalEl = document.getElementById('modalArticulo');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    bsModal.show();

    // Enfocar el primer campo accesible al terminar de abrir
    modalEl.addEventListener('shown.bs.modal', function () {
      const inputPref = document.getElementById('codigo_prefijo');
      const inputDesc = document.getElementById('articulo_descripcion') || document.getElementById('descripcion');
      if (modoEdicionArticulo && inputDesc) {
        inputDesc.focus();
        inputDesc.select();
      } else if (inputPref && !inputPref.disabled) {
        inputPref.focus();
      }
    }, { once: true });
  }
}

// Cargar Artículo para Edición
async function prepararEdicionArticulo(codigo) {
  try {
    modoEdicionArticulo = true;

    // 1. Limpieza previa del formulario e imagen
    const form = document.getElementById('formArticulo') || document.querySelector('#modalArticulo form');
    if (form) form.reset();
    if (typeof quitarImagenSeleccionada === 'function') quitarImagenSeleccionada();

    // 2. Cargar opciones del selector de Rubros
    await cargarRubrosAuxiliares();

    // 3. Consultar datos al servidor
    const res = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`);
    if (!res.ok) {
      alert('❌ Error de comunicación con el servidor.');
      return;
    }
    const data = await res.json();

    let info = data.dato || data.datos || data.data || data;
    if (Array.isArray(info)) info = info[0];

    if (!data.success || !info || typeof info !== 'object') {
      alert('❌ No se encontraron los datos del artículo.');
      return;
    }

    const cod = info.codigo || info.CODIGO || codigo;

    const setCampoSeguro = (ids, valor) => {
      const lista = Array.isArray(ids) ? ids : [ids];
      const valLimpio = (valor !== null && valor !== undefined) ? valor : '';
      for (const id of lista) {
        const el = document.getElementById(id) || 
                   document.querySelector(`#modalArticulo #${id}`) ||
                   document.querySelector(`#modalArticulo [name="${id}"]`);
        if (el) {
          el.value = valLimpio;
          return true;
        }
      }
      return false;
    };

    // 4. Asignación limpia de campos
    let pref = info.codigo_prefijo || info.CODIGO_PREFIJO || '';
    let suf = info.codigo_sufijo || info.CODIGO_SUFIJO || '';

    if (!pref && !suf) {
      if (cod.includes('-')) {
        const partes = cod.split('-');
        pref = partes[0];
        suf = partes.slice(1).join('-');
      } else {
        pref = cod;
        suf = '';
      }
    }

    setCampoSeguro(['codigo_prefijo', 'articulo_codigo_prefijo'], pref);
    setCampoSeguro(['codigo_sufijo', 'articulo_codigo_sufijo'], suf);
    setCampoSeguro(['codigo_articulo', 'articulo_codigo', 'codigo'], cod);

    setCampoSeguro(['articulo_descripcion', 'descripcion_articulo', 'descripcion'], info.descripcion || info.DESCRIPCION || '');

    const selectRubro = document.getElementById('articulo_rubro') || document.getElementById('rubro');
    if (selectRubro) {
      selectRubro.value = String(info.rubro !== undefined ? info.rubro : (info.RUBRO !== undefined ? info.RUBRO : 0));
    }

    setCampoSeguro(['articulo_ancho', 'ancho'], info.ancho !== undefined ? info.ancho : info.ANCHO);
    setCampoSeguro(['articulo_alto', 'alto'], info.alto !== undefined ? info.alto : info.ALTO);
    setCampoSeguro(['articulo_superficie', 'superficie'], info.superficie !== undefined ? info.superficie : info.SUPERFICIE);
    setCampoSeguro(['articulo_peso', 'peso'], info.peso !== undefined ? info.peso : info.PESO);
    setCampoSeguro(['articulo_precio', 'precio_venta', 'precio'], info.precio_venta !== undefined ? info.precio_venta : (info.PRECIO_VENTA !== undefined ? info.PRECIO_VENTA : info.precio));
    setCampoSeguro(['articulo_obs', 'obs', 'observaciones'], info.obs !== undefined ? info.obs : (info.OBS !== undefined ? info.OBS : ''));

    // Bloquear campos de clave primaria al editar
    ['codigo_articulo', 'articulo_codigo', 'codigo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.readOnly = true;
    });
    ['codigo_prefijo', 'articulo_codigo_prefijo', 'codigo_sufijo', 'articulo_codigo_sufijo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });

    // Cargar vista previa de imagen .png
    const imgPreview = document.getElementById('imgVistaPrevia') || document.getElementById('articulo_img_preview');
    const contenedor = document.getElementById('contenedorPreview');
    if (imgPreview) {
      imgPreview.src = `/uploads/articulos/${encodeURIComponent(cod)}.png?t=${Date.now()}`;
      imgPreview.onload = () => { if (contenedor) contenedor.classList.remove('d-none'); };
      imgPreview.onerror = () => { if (typeof quitarImagenSeleccionada === 'function') quitarImagenSeleccionada(); };
    }

    // 5. Abrir el modal de Bootstrap y posicionar foco
    const modalEl = document.getElementById('modalArticulo');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      bsModal.show();

      modalEl.addEventListener('shown.bs.modal', function () {
        const inputPref = document.getElementById('codigo_prefijo');
        const inputDesc = document.getElementById('articulo_descripcion') || document.getElementById('descripcion');
        if (modoEdicionArticulo && inputDesc) {
          inputDesc.focus();
          inputDesc.select();
        } else if (inputPref && !inputPref.disabled) {
          inputPref.focus();
        }
      }, { once: true });
    } else {
      console.error('❌ No se encontró el modal #modalArticulo en el DOM.');
    }
  } catch (error) {
    console.error('❌ Error al preparar edición de artículo:', error);
  }
}

// 💾 GUARDAR ARTÍCULO
async function guardarArticulo() {
  const alerta = document.getElementById('alertaArticuloModal');
  if (alerta) alerta.innerHTML = '';

  const codigo = getFieldValue(['codigo_articulo', 'articulo_codigo', 'codigo']);
  const descripcion = getFieldValue(['articulo_descripcion', 'descripcion']);

  if (!codigo || !descripcion) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">El código y la descripción son obligatorios.</div>';
    return;
  }

  const payload = {
    codigo: codigo.toUpperCase(),
    codigo_prefijo: getFieldValue(['codigo_prefijo', 'articulo_codigo_prefijo']).toUpperCase(),
    codigo_sufijo: getFieldValue(['codigo_sufijo', 'articulo_codigo_sufijo']).toUpperCase(),
    descripcion: descripcion.toUpperCase(),
    rubro: parseInt(getFieldValue(['articulo_rubro', 'rubro_articulo', 'rubro'])) || 0,
    ancho: parseFloat(getFieldValue(['articulo_ancho', 'ancho'])) || 0,
    alto: parseFloat(getFieldValue(['articulo_alto', 'alto'])) || 0,
    superficie: parseFloat(getFieldValue(['articulo_superficie', 'superficie'])) || 0,
    peso: parseFloat(getFieldValue(['articulo_peso', 'peso'])) || 0,
    precio_venta: Math.round(parseFloat(getFieldValue(['articulo_precio', 'precio_venta', 'precio'])) || 0),
    obs: getFieldValue(['articulo_obs', 'obs', 'observaciones']).toUpperCase()
  };

  const url = modoEdicionArticulo ? `/api/articulos/${encodeURIComponent(codigo)}` : '/api/articulos';
  const metodo = modoEdicionArticulo ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultado = await res.json();

    if (resultado.success) {
      const modalEl = document.getElementById('modalArticulo');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      await cargarArticulos();
    } else {
      if (alerta) alerta.innerHTML = `<div class="alert alert-danger py-1 small">${resultado.mensaje || 'Error al guardar.'}</div>`;
    }
  } catch (error) {
    console.error('❌ Error al guardar artículo:', error);
  }
}

// 🗑️ ELIMINAR ARTÍCULO
async function eliminarArticulo(codigo) {
  if (!confirm(`¿Está seguro de eliminar el artículo #${codigo}?`)) return;

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

// ==========================================
// 🚀 INICIALIZACIÓN DE EVENTOS (DOM)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  cargarArticulos();
  habilitarNavegacionEnterModalArticulo();

  // Escuchar tipeo en Prefijo y Sufijo
  const inputPrefijo = getModalEl('codigo_prefijo') || getModalEl('articulo_codigo_prefijo');
  const inputSufijo = getModalEl('codigo_sufijo') || getModalEl('articulo_codigo_sufijo');

  if (inputPrefijo) inputPrefijo.addEventListener('input', actualizarCodigoFinal);
  if (inputSufijo) inputSufijo.addEventListener('input', actualizarCodigoFinal);

  // Búsqueda con debounce
  const inputBuscar = document.getElementById('inputBuscarArticulo');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      clearTimeout(timerBusquedaArticulo);
      timerBusquedaArticulo = setTimeout(() => {
        cargarArticulos(inputBuscar.value.trim());
      }, 200);
    });
  }

  // Cálculo automático de superficie
  const inputAncho = getModalEl('articulo_ancho') || getModalEl('ancho');
  const inputAlto = getModalEl('articulo_alto') || getModalEl('alto');

  if (inputAncho) inputAncho.addEventListener('input', calcularSuperficie);
  if (inputAlto) inputAlto.addEventListener('input', calcularSuperficie);

  // Auto-selección en foco
  document.querySelectorAll('#modalArticulo input').forEach(input => {
    input.addEventListener('focus', function () { this.select(); });
  });
});

// ==========================================
// 🌐 EXPOSICIÓN GLOBAL
// ==========================================

window.actualizarCodigoFinal = actualizarCodigoFinal;
window.abrirModalCrearArticulo = abrirModalCrearArticulo;
window.prepararEdicionArticulo = prepararEdicionArticulo;
window.guardarArticulo = guardarArticulo;
window.eliminarArticulo = eliminarArticulo;
window.cargarArticulos = cargarArticulos;
window.quitarImagenSeleccionada = quitarImagenSeleccionada;
window.mostrarVistaPreviaFoto = mostrarVistaPreviaFoto;
window.cargarRubrosAuxiliares = cargarRubrosAuxiliares;
window.cargarRubrosSelect = cargarRubrosAuxiliares;