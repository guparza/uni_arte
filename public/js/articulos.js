let modalArticulo;
let modoEdicion = false;

// SVG de imagen por defecto (placeholder)
const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' fill='%23ccc' viewBox='0 0 16 16'><path d='M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z'/><path d='M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z'/></svg>";

// Función auxiliar global para manejar imágenes no encontradas
function manejarErrorImagen(img) {
  img.onerror = null;
  img.src = PLACEHOLDER_IMG;
}

document.addEventListener('DOMContentLoaded', () => {
  const inputBuscar = document.getElementById('inputBuscar');
  const btnNuevo = document.getElementById('btnNuevo');
  const formArticulo = document.getElementById('formArticulo');
  const inputPrefijo = document.getElementById('codigo_prefijo');
  const inputSufijo = document.getElementById('codigo_sufijo');
  const selectRubro = document.getElementById('rubro');
  const inputFoto = document.getElementById('inputFoto');
  const modalElement = document.getElementById('modalArticulo');

  if (modalElement) {
    modalArticulo = new bootstrap.Modal(modalElement);
  }

  cargarArticulos();
  cargarRubros();

  // Función para regenerar el Código Final con guion medio al tipear
  const actualizarCodigoFinal = () => {
    if (!modoEdicion) {
      const pref = inputPrefijo ? inputPrefijo.value.trim() : '';
      const suf = inputSufijo ? inputSufijo.value.trim() : '';
      const inputCodigo = document.getElementById('codigo');
      if (inputCodigo) {
        inputCodigo.value = (pref && suf) ? `${pref}-${suf}` : `${pref}${suf}`;
      }
    }
  };

  // Previsualización de imagen seleccionada localmente
  if (inputFoto) {
    inputFoto.addEventListener('change', (e) => {
      const archivos = e.target.files;
      const imgPreview = document.getElementById('imgPreview');
      if (archivos && archivos.length > 0 && imgPreview) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          imgPreview.src = evt.target.result;
        };
        reader.readAsDataURL(archivos);
      }
    });
  }

  if (formArticulo) {
    // Auto-selección total al enfocar campos
    formArticulo.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('focus', () => {
        setTimeout(() => {
          if (typeof input.select === 'function') {
            input.select();
          }
        }, 50);
      });
    });

    // Navegación Enter entre campos
    formArticulo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit' && e.target.type !== 'file') {
        e.preventDefault();
        
        const enfocables = Array.from(
          formArticulo.querySelectorAll('input:not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]')
        );
        
        const indiceActual = enfocables.indexOf(e.target);
        if (indiceActual > -1 && indiceActual < enfocables.length - 1) {
          const siguiente = enfocables[indiceActual + 1];
          siguiente.focus();
          
          if (typeof siguiente.select === 'function') {
            siguiente.select();
          }
        }
      }
    });
  }

  // Concatenación libre al tipear en Prefijo o Sufijo
  if (inputPrefijo) inputPrefijo.addEventListener('input', actualizarCodigoFinal);
  if (inputSufijo) inputSufijo.addEventListener('input', actualizarCodigoFinal);

  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => cargarArticulos(inputBuscar.value));
  }

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
      modoEdicion = false;
      if (formArticulo) formArticulo.reset();
      
      // Habilitar campos de código para nuevos registros
      if (inputPrefijo) inputPrefijo.disabled = false;
      if (inputSufijo) inputSufijo.disabled = false;
      const inputCodigo = document.getElementById('codigo');
      if (inputCodigo) inputCodigo.removeAttribute('readonly');

      if (inputFoto) inputFoto.value = '';
      
      if (document.getElementById('ancho')) document.getElementById('ancho').value = '0';
      if (document.getElementById('alto')) document.getElementById('alto').value = '0';
      if (document.getElementById('tiempo_maquina')) document.getElementById('tiempo_maquina').value = '0';

      const imgPreview = document.getElementById('imgPreview');
      if (imgPreview) imgPreview.src = PLACEHOLDER_IMG;

      const labelModal = document.getElementById('modalArticuloLabel');
      if (labelModal) labelModal.innerText = '➕ Nuevo Artículo';
      
      const alertaModal = document.getElementById('alertaModal');
      if (alertaModal) alertaModal.innerHTML = '';
      
      if (modalArticulo) {
        modalArticulo.show();
        setTimeout(() => {
          if (selectRubro) selectRubro.focus();
        }, 400);
      }
    });
  }

  if (formArticulo) {
    formArticulo.addEventListener('submit', async (e) => {
      e.preventDefault();
      await guardarArticulo();
    });
  }
});

async function cargarRubros() {
  try {
    const res = await fetch('/api/rubros');
    const data = await res.json();
    const selectRubro = document.getElementById('rubro');

    if (selectRubro && data.success) {
      selectRubro.innerHTML = '<option value="0">-- Sin Rubro --</option>';
      data.datos.forEach(r => {
        selectRubro.innerHTML += `<option value="${r.codigo}">${r.descripcion}</option>`;
      });
    }
  } catch (error) {
    console.error('Error al cargar rubros:', error);
  }
}

// Cargar catálogo de artículos con parámetro anti-caché en la imagen
async function cargarArticulos(filtro = '') {
  try {
    const tabla = document.getElementById('tablaArticulos');
    if (!tabla) return;

    const url = filtro ? `/api/articulos?buscar=${encodeURIComponent(filtro)}` : '/api/articulos';
    const respuesta = await fetch(url);
    const resultado = await respuesta.json();

    tabla.innerHTML = '';

    if (!resultado.success || !resultado.datos || resultado.datos.length === 0) {
      tabla.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">No se encontraron artículos.</td></tr>`;
      return;
    }

    resultado.datos.forEach(art => {
      const fila = document.createElement('tr');
      const precioFormateado = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS'
      }).format(art.precio_venta || 0);

      const urlFoto = `/uploads/articulos/${encodeURIComponent(art.codigo)}.png?v=${Date.now()}`;

      fila.innerHTML = `
        <td class="text-center">
          <img src="${urlFoto}" alt="${art.codigo}" class="rounded border bg-white" style="width: 40px; height: 40px; object-fit: contain;" onerror="manejarErrorImagen(this)">
        </td>
        <td><strong>${art.codigo}</strong></td>
        <td>${art.descripcion}</td>
        <td><span class="badge bg-secondary">${art.rubro}</span></td>
        <td>${precioFormateado}</td>
        <td>${art.llevar_stock === 'S' ? '<span class="badge bg-success">Sí</span>' : '<span class="badge bg-secondary">No</span>'}</td>
        <td>${art.stock_critico}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-warning me-1" onclick="prepararEdicion('${art.codigo}')" title="Editar">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarArticulo('${art.codigo}')" title="Eliminar">🗑️ Eliminar</button>
        </td>
      `;

      tabla.appendChild(fila);
    });

  } catch (error) {
    console.error('Error al cargar artículos:', error);
  }
}

// ✏️ Preparar Edición (Completar campos y foto correctamente)
async function prepararEdicion(codigo) {
  try {
    const respuesta = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`);
    const resultado = await respuesta.json();

    if (!resultado.success || !resultado.dato) {
      alert('Error al obtener los datos del artículo de la base de datos.');
      return;
    }

    const art = Array.isArray(resultado.dato) ? resultado.dato[0] : resultado.dato;

    if (!art) {
      alert('No se encontró el registro del artículo.');
      return;
    }

    modoEdicion = true;

    const inputFoto = document.getElementById('inputFoto');
    if (inputFoto) inputFoto.value = '';

    document.getElementById('codigo_prefijo').value = art.codigo_prefijo || '';
    document.getElementById('codigo_sufijo').value = art.codigo_sufijo || '';
    document.getElementById('codigo').value = art.codigo || '';
    document.getElementById('descripcion').value = art.descripcion || '';
    document.getElementById('rubro').value = art.rubro || 0;
    document.getElementById('precio_venta').value = art.precio_venta || 0;
    document.getElementById('llevar_stock').value = art.llevar_stock || 'S';
    document.getElementById('stock_critico').value = art.stock_critico || 0;
    document.getElementById('ancho').value = art.ancho || 0;
    document.getElementById('alto').value = art.alto || 0;
    document.getElementById('tiempo_maquina').value = art.tiempo_maquina || 0;
    document.getElementById('obs').value = art.obs || '';

    // Bloquear clave primaria en edición
    document.getElementById('codigo').setAttribute('readonly', true);
    document.getElementById('codigo_prefijo').setAttribute('disabled', true);
    document.getElementById('codigo_sufijo').setAttribute('disabled', true);

    const imgPreview = document.getElementById('imgPreview');
    if (imgPreview) {
      imgPreview.onerror = () => manejarErrorImagen(imgPreview);
      imgPreview.src = `/uploads/articulos/${encodeURIComponent(art.codigo)}.png?v=${Date.now()}`;
    }

    const labelModal = document.getElementById('modalArticuloLabel');
    if (labelModal) labelModal.innerText = `✏️ Editar Artículo: ${art.codigo}`;

    const alertaModal = document.getElementById('alertaModal');
    if (alertaModal) alertaModal.innerHTML = '';

    if (modalArticulo) {
      modalArticulo.show();
      setTimeout(() => {
        const inputDesc = document.getElementById('descripcion');
        if (inputDesc) {
          inputDesc.focus();
          inputDesc.select();
        }
      }, 400);
    }
  } catch (error) {
    console.error('Error al preparar edición:', error);
    alert('Ocurrió un error al conectar con el servidor para editar.');
  }
}

// 💾 Guardar Artículo (con conversión a MAYÚSCULAS en frontend)
async function guardarArticulo() {
  const alertaDiv = document.getElementById('alertaModal');
  if (alertaDiv) {
    alertaDiv.innerHTML = '<div class="alert alert-info py-1 mb-0 small">Procesando...</div>';
  }

  // 🔹 Normalizar código y componentes a mayúsculas
  const prefijo = (document.getElementById('codigo_prefijo')?.value || '').trim().toUpperCase();
  const sufijo  = (document.getElementById('codigo_sufijo')?.value || '').trim().toUpperCase();
  const codigo  = (document.getElementById('codigo')?.value || '').trim().toUpperCase();
  const inputFoto = document.getElementById('inputFoto');

  const formData = new FormData();
  formData.append('codigo_prefijo', prefijo);
  formData.append('codigo_sufijo', sufijo);
  formData.append('codigo', codigo);
  
  // 🔹 Convertir campos de texto descriptivos a MAYÚSCULAS
  formData.append('descripcion', (document.getElementById('descripcion')?.value || '').trim().toUpperCase());
  formData.append('obs', (document.getElementById('obs')?.value || '').trim().toUpperCase());

  // Campos numéricos y selecciones
  formData.append('rubro', document.getElementById('rubro') ? document.getElementById('rubro').value : 0);
  formData.append('precio_venta', document.getElementById('precio_venta') ? document.getElementById('precio_venta').value : 0);
  formData.append('llevar_stock', document.getElementById('llevar_stock') ? document.getElementById('llevar_stock').value : 'S');
  formData.append('stock_critico', document.getElementById('stock_critico') ? document.getElementById('stock_critico').value : 0);
  formData.append('ancho', document.getElementById('ancho') ? Math.round(parseFloat(document.getElementById('ancho').value || 0)) : 0);
  formData.append('alto', document.getElementById('alto') ? Math.round(parseFloat(document.getElementById('alto').value || 0)) : 0);
  formData.append('tiempo_maquina', document.getElementById('tiempo_maquina') ? Math.round(parseFloat(document.getElementById('tiempo_maquina').value || 0)) : 0);

  // Adjuntar foto si el usuario seleccionó un archivo nuevo
  if (inputFoto && inputFoto.files && inputFoto.files.length > 0) {
    formData.append('foto', inputFoto.files[0]);
  }

  const metodo = modoEdicion ? 'PUT' : 'POST';
  const url = modoEdicion ? `/api/articulos/${encodeURIComponent(codigo)}` : '/api/articulos';

  try {
    const respuesta = await fetch(url, {
      method: metodo,
      body: formData
    });

    const resultado = await respuesta.json();

    if (resultado.success) {
      if (alertaDiv) {
        alertaDiv.innerHTML = `<div class="alert alert-success py-1 mb-0 small">${resultado.mensaje}</div>`;
      }
      setTimeout(() => {
        if (modalArticulo) modalArticulo.hide();
        cargarArticulos();
      }, 1000);
    } else {
      if (alertaDiv) {
        alertaDiv.innerHTML = `<div class="alert alert-danger py-1 mb-0 small">${resultado.mensaje}</div>`;
      }
    }
  } catch (error) {
    console.error('Error al guardar:', error);
    if (alertaDiv) {
      alertaDiv.innerHTML = '<div class="alert alert-danger py-1 mb-0 small">Error de conexión con el servidor.</div>';
    }
  }
}

// 🗑️ Eliminar artículo
async function eliminarArticulo(codigo) {
  const confirmar = confirm(`¿Estás seguro de que deseas eliminar el artículo con código "${codigo}"?`);
  if (!confirmar) return;

  try {
    const respuesta = await fetch(`/api/articulos/${encodeURIComponent(codigo)}`, {
      method: 'DELETE'
    });

    const resultado = await respuesta.json();

    if (resultado.success) {
      alert(`✅ ${resultado.mensaje}`);
      cargarArticulos();
    } else {
      alert(`⚠️ ${resultado.mensaje || 'No se pudo eliminar el artículo.'}`);
    }
  } catch (error) {
    console.error('Error al eliminar:', error);
    alert('Error de conexión o el servidor no respondió adecuadamente.');
  }
}

// 🔹 EXPOSICIÓN GLOBAL PARA ATRIBUTOS onclick EN TABLA HTML
window.prepararEdicion = prepararEdicion;
window.eliminarArticulo = eliminarArticulo;