// src/routes/clientes.js - Módulo Completo de Clientes UniArte
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Conexión a la base de datos MySQL

// 1. GET /api/clientes/auxiliares - Obtener listas de Sit. IVA y Condición de Venta
router.get('/auxiliares', async (req, res) => {
  try {
    const [situaciones] = await db.query('SELECT codigo, descripcion FROM situacionesiva ORDER BY codigo ASC');
    const [condiciones] = await db.query('SELECT codigo, descripcion FROM condiciones_venta ORDER BY codigo ASC');

    res.json({
      success: true,
      situacionesIva: situaciones || [],
      condicionesVenta: condiciones || []
    });
  } catch (error) {
    console.error('❌ Error al obtener auxiliares de clientes:', error);
    res.status(500).json({ success: false, mensaje: 'Error al cargar datos auxiliares.' });
  }
});

// 2. GET /api/clientes - Obtener lista de clientes con búsqueda y LIMIT 50
router.get('/', async (req, res) => {
  try {
    const { buscar } = req.query;

    let sql = `
      SELECT 
        c.codigo, 
        c.nombre, 
        c.nombre_fantasia, 
        c.cuit, 
        c.telefono, 
        c.celular, 
        c.mail, 
        s.descripcion AS situacion_iva_desc,
        cv.descripcion AS condicion_venta_desc
      FROM clientes c
      LEFT JOIN situacionesiva s ON c.situacioniva = s.codigo
      LEFT JOIN condiciones_venta cv ON c.condicion_venta = cv.codigo
    `;
    let params = [];

    if (buscar && buscar.trim() !== '') {
      sql += ` WHERE c.nombre LIKE ? OR c.nombre_fantasia LIKE ? OR c.cuit LIKE ? OR c.codigo = ?`;
      const termino = `%${buscar.trim()}%`;
      const codigoNum = parseInt(buscar.trim()) || 0;
      params.push(termino, termino, termino, codigoNum);
    }

    sql += ` ORDER BY c.codigo ASC LIMIT 50`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al consultar catálogo de clientes:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener la lista de clientes.' });
  }
});

// 3. GET /api/clientes/:codigo - Obtener un cliente por código para edición
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await db.query('SELECT * FROM clientes WHERE codigo = ?', [codigo]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Cliente no encontrado.' });
    }

    res.json({ success: true, dato: rows });
  } catch (error) {
    console.error('❌ Error al consultar cliente:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar datos del cliente.' });
  }
});

// 4. POST /api/clientes - Crear nuevo cliente (Asignación automática de código)
router.post('/', async (req, res) => {
  try {
    const {
      codigo, nombre, nombre_fantasia, direccion, localidad,
      cod_postal, mail, web, situacioniva, cuit,
      condicion_venta, telefono, celular, contacto, obs
    } = req.body;

    const nombreLimpio = (nombre || '').trim().toUpperCase();
    if (!nombreLimpio) {
      return res.status(400).json({ success: false, mensaje: 'La Razón Social / Nombre es obligatoria.' });
    }

    // Generar código de cliente automático si no se envía uno manual
let codigoFinal = parseInt(codigo);
if (!codigo || isNaN(codigoFinal) || codigoFinal <= 0) {
  const [rows] = await db.query('SELECT COALESCE(MAX(codigo), 0) + 1 AS siguiente FROM clientes');
  codigoFinal = rows[0].siguiente; // 👈 rows[0] accede al primer objeto del arreglo
}
    // Fallbacks seguros para claves foráneas
    const sitIvaVal = (situacioniva !== undefined && situacioniva !== null && situacioniva !== '') 
      ? String(situacioniva).trim() 
      : '0';

    const condVentaVal = parseInt(condicion_venta) || 0;
    const localidadVal = parseInt(localidad) || 0;

    const sql = `
      INSERT INTO clientes 
      (codigo, nombre, nombre_fantasia, direccion, localidad, cod_postal, mail, web, situacioniva, cuit, condicion_venta, telefono, celular, contacto, obs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      codigoFinal,
      nombreLimpio,
      (nombre_fantasia || '').trim().toUpperCase(),
      (direccion || '').trim().toUpperCase(),
      localidadVal,
      (cod_postal || '').trim().toUpperCase(),
      (mail || '').trim().toLowerCase(),
      (web || '').trim().toLowerCase(),
      sitIvaVal,
      (cuit || '').trim(),
      condVentaVal,
      (telefono || '').trim(),
      (celular || '').trim(),
      (contacto || '').trim().toUpperCase(),
      (obs || '').trim().toUpperCase()
    ]);

    res.json({ success: true, mensaje: `Cliente #${codigoFinal} creado exitosamente.` });
  } catch (error) {
    console.error('❌ Error al guardar cliente en BBDD:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: 'El código de cliente ya existe.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, mensaje: 'La Situación IVA, Condición de Venta o Localidad seleccionada no existe en la base de datos.' });
    }

    res.status(500).json({ success: false, mensaje: 'Error interno al guardar el cliente.' });
  }
});

// 5. PUT /api/clientes/:codigo - Actualizar cliente existente
router.put('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const {
      nombre, nombre_fantasia, direccion, localidad,
      cod_postal, mail, web, situacioniva, cuit,
      condicion_venta, telefono, celular, contacto, obs
    } = req.body;

    const nombreLimpio = (nombre || '').trim().toUpperCase();
    if (!nombreLimpio) {
      return res.status(400).json({ success: false, mensaje: 'La Razón Social / Nombre es obligatoria.' });
    }

    const sitIvaVal = (situacioniva !== undefined && situacioniva !== null && situacioniva !== '') 
      ? String(situacioniva).trim() 
      : '0';

    const sql = `
      UPDATE clientes SET 
        nombre = ?, 
        nombre_fantasia = ?, 
        direccion = ?, 
        localidad = ?, 
        cod_postal = ?, 
        mail = ?, 
        web = ?, 
        situacioniva = ?, 
        cuit = ?, 
        condicion_venta = ?, 
        telefono = ?, 
        celular = ?, 
        contacto = ?, 
        obs = ?
      WHERE codigo = ?
    `;

    await db.query(sql, [
      nombreLimpio,
      (nombre_fantasia || '').trim().toUpperCase(),
      (direccion || '').trim().toUpperCase(),
      parseInt(localidad) || 0,
      (cod_postal || '').trim().toUpperCase(),
      (mail || '').trim().toLowerCase(),
      (web || '').trim().toLowerCase(),
      sitIvaVal,
      (cuit || '').trim(),
      parseInt(condicion_venta) || 0,
      (telefono || '').trim(),
      (celular || '').trim(),
      (contacto || '').trim().toUpperCase(),
      (obs || '').trim().toUpperCase(),
      codigo
    ]);

    res.json({ success: true, mensaje: 'Cliente actualizado correctamente.' });
  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar datos del cliente.' });
  }
});

// 6. DELETE /api/clientes/:codigo - Eliminar cliente
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    await db.query('DELETE FROM clientes WHERE codigo = ?', [codigo]);
    res.json({ success: true, mensaje: 'Cliente eliminado correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar cliente:', error);
    res.status(500).json({ success: false, mensaje: 'Error al eliminar el cliente.' });
  }
});

module.exports = router;