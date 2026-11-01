// public/js/articulos.js - Módulo de Gestión de Artículos UniArte

let modoEdicionArticulo = false;
let timerBusquedaArticulo = null;
let codigoOriginalArticulo = '';

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

// 🟢 Función para armar y mostrar dinámicamente el Código Final en tiempo real
function actualizarCodigoFinalModal() {
  const prefijo = getFieldValue(['articulo_prefijo', 'codigo_prefijo', 'prefijo']);
  const sufijo = getFieldValue(['articulo_sufijo', 'codigo_sufijo', 'sufijo']);

  let codigoCalculado = '';
  if (prefijo || sufijo) {
    // Une prefijo y sufijo sanitizando guiones dobles
    codigoCalculado = `${prefijo}-${sufijo}`.replace(/-+/g, '-').replace(/^-|-$/g, '').toUpperCase();
  }

  setFieldValue(['articulo_codigo', 'codigo'], codigoCalculado);
}

// 🟢 En la inicialización del DOM (dentro de document.addEventListener('DOMContentLoaded', ...))
document.addEventListener('DOMContentLoaded', () => {
  cargarArticulos();
  habilitarNavegacionEnterModal();

  // Escuchar escritura en Prefijo y Sufijo para armar el Código Final en vivo
  const inputPrefijo = getModalEl('articulo_prefijo') || getModalEl('prefijo');
  const inputSufijo = getModalEl('articulo_sufijo') || getModalEl('sufijo');

  if (inputPrefijo) inputPrefijo.addEventListener('input', actualizarCodigoFinalModal);
  if (inputSufijo) inputSufijo.addEventListener('input', actualizarCodigoFinalModal);
});

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

// 4. Cargar Tabla de Artículos (Sin columna Peso)
async function cargarArticulos(buscar = '') {
  const tbody = document.getElementById('tbodyArticulos');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/articulos?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        // 🟢 Colspan ajustado a 7 columnas
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">No se encontraron artículos registrados.</td></tr>';
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
        
        const valorPrecio = a.precio_venta !== undefined ? a.precio_venta : (a.precio !== undefined ? a.precio : 0);
        const precioFmt = Number(valorPrecio).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        html += `
          <tr>
            <td class="fw-bold align-middle">${cod}</td>
            <td class="align-middle fw-semibold">${desc}</td>
            <td class="align-middle small">${rub}</td>
            <td class="align-middle text-end small">${medidas}</td>
            <td class="align-middle text-end small text-muted">${supFmt} m²</td>
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

// 6. ✏️ Cargar Artículo para Edición
async function prepararEdicionArticulo(codigo) {
  try {
    modoEdicionArticulo = true;
    codigoOriginalArticulo = codigo.trim(); // 🟢 Guardamos el código original intacto

    await cargarRubrosAuxiliares();

    const res = await fetch(`/api/articulos/${encodeURIComponent(codigoOriginalArticulo)}`);
    const data = await res.json();

    const infoDB = data.datos || data.dato || data.data;

    if (data.success && infoDB) {
      const a = Array.isArray(infoDB) ? infoDB[0] : infoDB;

      if (!a || typeof a !== 'object') {
        alert('❌ No se encontraron los datos del artículo.');
        return;
      }

      // Al cargar los datos del artículo en el modal:
setFieldValue(['articulo_prefijo', 'codigo_prefijo', 'prefijo'], a.codigo_prefijo || '');
setFieldValue(['articulo_sufijo', 'codigo_sufijo', 'sufijo'], a.codigo_sufijo || '');
setFieldValue(['articulo_codigo', 'codigo'], a.codigo); 

      const inputCodigo = getModalEl('articulo_codigo') || getModalEl('codigo');
      if (inputCodigo) inputCodigo.readOnly = true;

      setFieldValue(['articulo_descripcion', 'descripcion'], a.descripcion);

      const selectRubro = getModalEl('articulo_rubro') || getModalEl('rubro');
      if (selectRubro) selectRubro.value = String(a.rubro !== undefined ? a.rubro : 0);

      setFieldValue(['articulo_ancho', 'ancho'], a.ancho);
      setFieldValue(['articulo_alto', 'alto'], a.alto);
      setFieldValue(['articulo_superficie', 'superficie'], a.superficie);
      setFieldValue(['articulo_precio', 'precio_venta', 'precio'], a.precio_venta || a.precio);
      setFieldValue(['articulo_obs', 'obs', 'observaciones'], a.obs || '');

      // Vista previa de imagen si existe
      if (a.tieneFoto && a.fotoUrl) {
        const imgPreview = document.getElementById('imgVistaPrevia') || getModalEl('articulo_img_preview');
        const contenedor = document.getElementById('contenedorPreview');
        if (imgPreview) {
          imgPreview.src = `${a.fotoUrl}?t=${Date.now()}`;
          if (contenedor) contenedor.classList.remove('d-none');
        }
      } else {
        quitarImagenSeleccionada();
      }

      const alerta = document.getElementById('alertaArticuloModal');
      if (alerta) alerta.innerHTML = '';

      const modalEl = document.getElementById('modalArticulo');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.show();
      }
    }
  } catch (error) {
    console.error('❌ Error al preparar edición de artículo:', error);
  }
}



// 🟢 1. Convertir cualquier formato de imagen a PNG en el navegador
function convertirImagenAPng(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject('Error al procesar la imagen.');
      img.src = e.target.result;
    };
    reader.onerror = () => reject('Error al leer el archivo.');
    reader.readAsDataURL(file);
  });
}

// 🟢 2. Subir la foto convertida al servidor
async function subirFotoArticulo(codigo) {
  const inputFoto = document.getElementById('articulo_foto') || getModalEl('foto');
  if (!inputFoto || !inputFoto.files || inputFoto.files.length === 0) {
    return true; // Si no seleccionó foto, continúa normalmente
  }

  try {
    const file = inputFoto.files[0];
    const pngBase64 = await convertirImagenAPng(file);

    const res = await fetch(`/api/articulos/${encodeURIComponent(codigo)}/foto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagenBase64: pngBase64 })
    });

    const data = await res.json();
    return data.success;
  } catch (err) {
    console.warn('⚠️ No se pudo subir la foto:', err);
    return false;
  }
}

// 7. 💾 Guardar Artículo (Alta o Edición)
async function guardarArticulo() {
  const alerta = document.getElementById('alertaArticuloModal');
  if (alerta) alerta.innerHTML = '';

  let codigo = getFieldValue(['articulo_codigo', 'codigo']);
  const prefijo = getFieldValue(['articulo_prefijo', 'codigo_prefijo', 'prefijo']);
  const sufijo = getFieldValue(['articulo_sufijo', 'codigo_sufijo', 'sufijo']);
  const descripcion = getFieldValue(['articulo_descripcion', 'descripcion']);

  // 🟢 Limpieza de guiones duplicados al armar el código
  if (!codigo && prefijo) {
    codigo = `${prefijo}-${sufijo}`.replace(/-+/g, '-').replace(/^-|-$/g, '').toUpperCase();
    setFieldValue(['articulo_codigo', 'codigo'], codigo);
  } else if (codigo) {
    codigo = codigo.replace(/-+/g, '-').toUpperCase();
  }

  if (!codigo || !descripcion) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">El código y la descripción son obligatorios.</div>';
    return;
  }

  const payload = {
    codigo,
    codigo_prefijo: prefijo.replace(/-+/g, '-').toUpperCase(),
    codigo_sufijo: sufijo.replace(/-+/g, '-').toUpperCase(),
    descripcion: descripcion.toUpperCase(),
    rubro: parseInt(getFieldValue(['articulo_rubro', 'rubro'])) || 0,
    ancho: parseFloat(getFieldValue(['articulo_ancho', 'ancho'])) || 0,
    alto: parseFloat(getFieldValue(['articulo_alto', 'alto'])) || 0,
    superficie: parseFloat(getFieldValue(['articulo_superficie', 'superficie'])) || 0,
    precio_venta: parseFloat(getFieldValue(['articulo_precio', 'precio_venta', 'precio'])) || 0,
    obs: getFieldValue(['articulo_obs', 'obs', 'observaciones']).toUpperCase()
  };

  // 🟢 En edición, enviamos la petición al código original exacto de la BBDD
  const claveEdicion = modoEdicionArticulo ? codigoOriginalArticulo : codigo;
  const url = modoEdicionArticulo ? `/api/articulos/${encodeURIComponent(claveEdicion)}` : '/api/articulos';
  const metodo = modoEdicionArticulo ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultado = await res.json();

    if (resultado.success) {
      try {
        await subirFotoArticulo(codigo);
      } catch (eFoto) {
        console.warn('⚠️ Error al procesar imagen:', eFoto);
      }

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