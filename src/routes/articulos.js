// src/routes/articulos.js - Módulo de Artículos Robusto
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Conexión a la BBDD
const fs = require('fs');
const path = require('path');

// GET /api/articulos - Listar catálogo con precio de Lista Minorista
router.get('/', async (req, res) => {
  try {
    const { buscar } = req.query;
    
    // Asignamos alias y realizamos el JOIN con la lista de precio Minorista (orden = 1)
    let sql = `
      SELECT 
        a.codigo, 
        a.descripcion, 
        a.rubro, 
        r.descripcion AS rubro_desc,
        a.ancho, 
        a.alto, 
        a.superficie,
        COALESCE(lp.precio, a.precio_venta, 0) AS precio_venta
      FROM articulos a
      LEFT JOIN articulos_rubros r ON r.codigo = a.rubro
      LEFT JOIN listas_precios lp ON lp.articulo = a.codigo AND lp.lista_precios = 7
    `;
    let params = [];

    if (buscar && buscar.trim() !== '') {
      sql += ` WHERE a.codigo LIKE ? OR a.descripcion LIKE ?`;
      const termino = `%${buscar.trim()}%`;
      params.push(termino, termino);
    }

    sql += ` ORDER BY a.codigo ASC LIMIT 100`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al consultar artículos:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar catálogo de artículos.' });
  }
});

// 2. GET /api/articulos/:codigo/precio?lista_precios=X
// Obtiene el precio cotizado en la lista del cliente o el precio de referencia
router.get('/:codigo/precio', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { lista_precios } = req.query;

    const sql = `
      SELECT 
        a.codigo, 
        a.descripcion, 
        a.precio_venta AS precio_referencia,
        lp.precio AS precio_lista
      FROM articulos a
      LEFT JOIN listas_precios lp 
        ON lp.articulo = a.codigo AND lp.lista_precios = ?
      WHERE a.codigo = ?
    `;

    const [rows] = await db.query(sql, [parseInt(lista_precios) || 0, codigo]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }

    const art = rows;

    // Si existe cotización explícita en la lista de precios del cliente, la usa.
    // De lo contrario, utiliza el precio de referencia del artículo.
    const tienePrecioLista = art.precio_lista !== null && art.precio_lista !== undefined;
    const precioCalculado = tienePrecioLista ? parseFloat(art.precio_lista) : parseFloat(art.precio_referencia || 0);

    res.json({
      success: true,
      codigo: art.codigo,
      descripcion: art.descripcion,
      precio: precioCalculado,
      origen_precio: tienePrecioLista ? 'LISTA_PRECIOS' : 'PRECIO_REFERENCIA'
    });
  } catch (error) {
    console.error('❌ Error al consultar precio cotizado:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener precio del artículo.' });
  }
});

// 🟢 GET /api/articulos/catalogo - Verifica existencia de fotos en servidor
router.get('/catalogo', async (req, res) => {
  try {
    const { rubro, buscar, lista_precios } = req.query;
    const idLista = parseInt(lista_precios) || 7;

    let sql = `
      SELECT 
        a.codigo, 
        a.codigo_prefijo,
        a.codigo_sufijo,
        a.descripcion, 
        a.rubro, 
        r.descripcion AS rubro_desc,
        a.ancho,
        a.alto,
        a.superficie,
        COALESCE(lp.precio, a.precio_venta, 0) AS precio_venta
      FROM articulos a
      LEFT JOIN articulos_rubros r ON r.codigo = a.rubro
      LEFT JOIN listas_precios lp ON lp.articulo = a.codigo AND lp.lista_precios = ?
      WHERE a.rubro != 0
    `;
    let params = [idLista];

    if (rubro && parseInt(rubro) > 0) {
      sql += ` AND a.rubro = ?`;
      params.push(parseInt(rubro));
    }

    if (buscar && buscar.trim() !== '') {
      sql += ` AND (a.codigo LIKE ? OR a.codigo_prefijo LIKE ? OR a.descripcion LIKE ?)`;
      const termino = `%${buscar.trim()}%`;
      params.push(termino, termino, termino);
    }

    sql += ` ORDER BY COALESCE(NULLIF(a.codigo_prefijo, ''), a.codigo) ASC, a.codigo_sufijo ASC`;

    const [rows] = await db.query(sql, params);

    // 🟢 Validar archivos físicamente en la carpeta uploads
    const dirUploads = path.join(__dirname, '../../public/uploads/articulos');

    const productosConFoto = rows.map(art => {
      // Limpiar puntos sobrantes al final del código/prefijo
      const prefijo = (art.codigo_prefijo || art.codigo).trim().toUpperCase().replace(/\.+$/, '');
      const codigoInd = art.codigo.trim().toUpperCase().replace(/\.+$/, '');

      let fotoUrl = '/uploads/articulos/sin-foto.png'; // Por defecto

      if (fs.existsSync(path.join(dirUploads, `${prefijo}.png`))) {
        fotoUrl = `/uploads/articulos/${encodeURIComponent(prefijo)}.png`;
      } else if (fs.existsSync(path.join(dirUploads, `${codigoInd}.png`))) {
        fotoUrl = `/uploads/articulos/${encodeURIComponent(codigoInd)}.png`;
      }

      return { ...art, fotoUrl };
    });

    res.json({ success: true, datos: productosConFoto });
  } catch (error) {
    console.error('❌ Error al consultar catálogo visual:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar el catálogo.' });
  }
});

// 🟢 GET /api/articulos/:codigo - Obtener datos de un artículo (valida si tiene foto real)
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const codigoLimpio = codigo.trim().toUpperCase();

    const sql = `
      SELECT 
        a.codigo, 
        a.codigo_prefijo, 
        a.codigo_sufijo, 
        a.descripcion, 
        a.rubro, 
        a.ancho, 
        a.alto, 
        a.superficie, 
        a.precio_venta, 
        a.obs 
      FROM articulos a
      WHERE a.codigo = ?
    `;

    const [rows] = await db.query(sql, [codigoLimpio]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }

    const articulo = rows[0];

    // Comprobar existencia física del archivo .png en disco
    const dirUploads = path.join(__dirname, '../../public/uploads/articulos');
    const rutaImagen = path.join(dirUploads, `${codigoLimpio}.png`);
    const tieneFoto = fs.existsSync(rutaImagen);

    res.json({ 
      success: true, 
      datos: {
        ...articulo,
        tieneFoto,
        fotoUrl: tieneFoto ? `/uploads/articulos/${encodeURIComponent(codigoLimpio)}.png` : null
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener datos del artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar datos del artículo.' });
  }
});

// 🟢 DELETE /api/articulos/:codigo - Borrado seguro de artículo e imagen
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const codigoLimpio = codigo.trim().toUpperCase();

    // 1. Validar que no tenga pedidos asociados en la base de datos
    const [pedidos] = await db.query('SELECT COUNT(*) AS cant FROM pedidos_deta WHERE articulo = ?', [codigoLimpio]);
    if (pedidos[0].cant > 0) {
      return res.status(400).json({ 
        success: false, 
        mensaje: `No se puede eliminar el artículo #${codigoLimpio} porque está asociado a ${pedidos[0].cant} pedido(s).` 
      });
    }

    // 2. Eliminar el registro en MySQL
    await db.query('DELETE FROM articulos WHERE codigo = ?', [codigoLimpio]);

    // 3. Eliminar el archivo físico de la imagen si existe (evita imágenes huérfanas)
    const dirUploads = path.join(__dirname, '../../public/uploads/articulos');
    const rutaImagen = path.join(dirUploads, `${codigoLimpio}.png`);

    if (fs.existsSync(rutaImagen)) {
      fs.unlinkSync(rutaImagen);
    }

    res.json({ success: true, mensaje: 'Artículo e imagen eliminados correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al eliminar el artículo.' });
  }
});

// 3. POST /api/articulos - Crear nuevo artículo
router.post('/', async (req, res) => {
  try {
    // Extraemos explícitamente codigo_prefijo y codigo_sufijo de req.body
    const { 
      codigo, 
      codigo_prefijo, 
      codigo_sufijo, 
      descripcion, 
      rubro, 
      alicuota, 
      precio_venta, 
      llevar_stock, 
      stock_critico, 
      ancho, 
      alto, 
      tiempo_maquina, 
      obs 
    } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({ success: false, mensaje: 'El código y la descripción son obligatorios.' });
    }

    const anchoNum = parseFloat(ancho || 0);
    const altoNum = parseFloat(alto || 0);
    const superficie = (anchoNum * altoNum / 10000).toFixed(4);
    const rubroVal = parseInt(rubro) || 0;

    const sql = `
      INSERT INTO articulos 
      (codigo, codigo_prefijo, codigo_sufijo, descripcion, rubro, alicuota, precio_venta, llevar_stock, stock_critico, ancho, alto, superficie, tiempo_maquina, obs)
      VALUES (?, ?, ?, ?, ?, 7, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      codigo.trim().toUpperCase(),
      (codigo_prefijo || '').trim().toUpperCase(),
      (codigo_sufijo || '').trim().toUpperCase(),
      descripcion.trim().toUpperCase(),
      rubroVal,
      Math.round(parseFloat(precio_venta || 0)),
      llevar_stock || 'S',
      parseInt(stock_critico || 0),
      anchoNum,
      altoNum,
      superficie,
      parseFloat(tiempo_maquina || 0),
      (obs || '').trim().toUpperCase()
    ]);

    res.json({ success: true, mensaje: 'Artículo creado exitosamente.' });
  } catch (error) {
    console.error('❌ Error al guardar artículo en BBDD:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: 'El código de artículo ya existe.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, mensaje: 'El rubro seleccionado no existe en la base de datos.' });
    }
    res.status(500).json({ success: false, mensaje: 'Error al guardar el artículo en la base de datos: ' + error.message });
  }
});

// 🟢 POST /api/articulos/:codigo/foto - Guardar o reemplazar imagen en formato PNG
router.post('/:codigo/foto', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { imagenBase64 } = req.body;

    if (!imagenBase64) {
      return res.status(400).json({ success: false, mensaje: 'No se envió ninguna imagen.' });
    }

    const codigoLimpio = codigo.trim().toUpperCase().replace(/\.+$/, '');
    const dirUploads = path.join(__dirname, '../../public/uploads/articulos');

    if (!fs.existsSync(dirUploads)) {
      fs.mkdirSync(dirUploads, { recursive: true });
    }

    // Convertir string Base64 a buffer binario
    const base64Data = imagenBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Guardar archivo estandarizado a PNG
    const rutaDestino = path.join(dirUploads, `${codigoLimpio}.png`);
    fs.writeFileSync(rutaDestino, buffer);

    res.json({ success: true, mensaje: 'Imagen guardada correctamente.' });
  } catch (error) {
    console.error('❌ Error al guardar la foto:', error);
    res.status(500).json({ success: false, mensaje: 'Error al procesar la imagen.' });
  }
});

// 4. PUT /api/articulos/:codigo - Actualizar artículo existente
router.put('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const { rubro, descripcion, ancho, alto, superficie, precio_venta, obs } = req.body;

    const sql = `
      UPDATE articulos 
      SET rubro = ?, 
          descripcion = ?, 
          ancho = ?, 
          alto = ?, 
          superficie = ?, 
          precio_venta = ?, 
          obs = ?
      WHERE codigo = ?
    `;

    const params = [
      parseInt(rubro) || 0,
      (descripcion || '').trim().toUpperCase(),
      parseFloat(ancho) || 0,
      parseFloat(alto) || 0,
      parseFloat(superficie) || 0,
      Math.round(parseFloat(precio_venta || 0)),
      (obs || '').trim().toUpperCase(),
      codigo
    ];

    const [result] = await db.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }

    res.json({ success: true, mensaje: 'Artículo actualizado correctamente.' });
  } catch (error) {
    console.error('❌ Error al actualizar artículo:', error);
    res.status(500).json({ success: false, mensaje: `Error en la base de datos: ${error.message}` });
  }
});

// 5. DELETE /api/articulos/:codigo - Eliminar artículo
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    await db.query('DELETE FROM articulos WHERE codigo = ?', [codigo]);
    res.json({ success: true, mensaje: 'Artículo eliminado correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al eliminar el artículo.' });
  }
});

module.exports = router;