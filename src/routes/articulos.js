// src/routes/articulos.js - Módulo de Artículos Robusto
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Conexión a la BBDD

// GET /api/articulos - Consultar artículos con filtro de búsqueda
router.get('/', async (req, res) => {
  try {
    const buscar = (req.query.buscar || '').trim();

    let sql = `
      SELECT a.*, r.descripcion AS rubro_desc 
      FROM articulos a 
      LEFT JOIN articulos_rubros r ON a.rubro = r.codigo
    `;
    const params = [];

    if (buscar) {
      sql += ` WHERE a.codigo LIKE ? OR a.descripcion LIKE ? OR r.descripcion LIKE ?`;
      const termino = `%${buscar}%`;
      params.push(termino, termino, termino);
    }

    sql += ` ORDER BY a.descripcion ASC, a.codigo ASC`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al consultar artículos:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar artículos en la base de datos.' });
  }
});

// 2. GET /api/articulos/:codigo - Obtener un artículo por código para edición
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await db.query(
      `SELECT codigo, codigo_prefijo, codigo_sufijo, descripcion, rubro, precio_venta, 
              llevar_stock, stock_critico, ancho, alto, superficie, tiempo_maquina, obs 
       FROM articulos WHERE codigo = ?`, 
      [codigo]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }

    res.json({ success: true, dato: rows });
  } catch (error) {
    console.error('❌ Error al obtener artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener datos del artículo.' });
  }
});

// 3. POST /api/articulos - Crear nuevo artículo
router.post('/', async (req, res) => {
  try {
    const {
      codigo, codigo_prefijo, codigo_sufijo, descripcion,
      rubro, precio_venta, llevar_stock, stock_critico,
      ancho, alto, tiempo_maquina, obs
    } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({ success: false, mensaje: 'El código y la descripción son obligatorios.' });
    }

    const anchoNum = parseFloat(ancho || 0);
    const altoNum = parseFloat(alto || 0);
    const superficie = (anchoNum * altoNum).toFixed(4);
    const rubroVal = parseInt(rubro) || 0;

    const sql = `
      INSERT INTO articulos 
      (codigo, codigo_prefijo, codigo_sufijo, descripcion, rubro, alicuota, precio_venta, llevar_stock, stock_critico, ancho, alto, superficie, tiempo_maquina, obs)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      codigo.trim(),
      (codigo_prefijo || '').trim().toUpperCase(),
      (codigo_sufijo || '').trim().toUpperCase(),
      descripcion.trim().toUpperCase(),
      rubroVal,
      parseFloat(precio_venta || 0),
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

    res.status(500).json({ success: false, mensaje: 'Error al guardar el artículo en la base de datos.' });
  }
});

// 4. PUT /api/articulos/:codigo - Actualizar artículo existente
router.put('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const {
      descripcion, rubro, precio_venta, llevar_stock, stock_critico,
      ancho, alto, tiempo_maquina, obs
    } = req.body;

    const anchoNum = parseFloat(ancho || 0);
    const altoNum = parseFloat(alto || 0);
    const superficie = (anchoNum * altoNum).toFixed(4);

    const sql = `
      UPDATE articulos SET 
        descripcion = ?, 
        rubro = ?, 
        precio_venta = ?, 
        llevar_stock = ?, 
        stock_critico = ?, 
        ancho = ?, 
        alto = ?, 
        superficie = ?, 
        tiempo_maquina = ?, 
        obs = ?
      WHERE codigo = ?
    `;

    await db.query(sql, [
      (descripcion || '').trim().toUpperCase(),
      parseInt(rubro) || 0,
      parseFloat(precio_venta || 0),
      llevar_stock || 'S',
      parseInt(stock_critico || 0),
      anchoNum,
      altoNum,
      superficie,
      parseFloat(tiempo_maquina || 0),
      (obs || '').trim().toUpperCase(),
      codigo
    ]);

    res.json({ success: true, mensaje: 'Artículo actualizado correctamente.' });
  } catch (error) {
    console.error('❌ Error al actualizar artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar el artículo.' });
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