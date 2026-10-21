// src/routes/rubros.js (BACKEND)
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/rubros - Obtener lista de rubros
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT codigo, descripcion FROM articulos_rubros ORDER BY codigo ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al consultar rubros:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno de la base de datos' });
  }
});

// POST /api/rubros - Crear un nuevo rubro
router.post('/', async (req, res) => {
  try {
    const { codigo, descripcion } = req.body;

    const codigoNum = parseInt(codigo);
    const descText = (descripcion || '').trim().toUpperCase();

    // Validar datos antes de consultar la BBDD para evitar el 400
    if (isNaN(codigoNum) || codigoNum < 0 || !descText) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'El código debe ser numérico y la descripción no puede estar vacía.' 
      });
    }

    await db.query(
      'INSERT INTO articulos_rubros (codigo, descripcion, imprimir_lista_precios, llevar_stock) VALUES (?, ?, "S", "S")',
      [codigoNum, descText]
    );

    res.json({ success: true, mensaje: 'Rubro creado correctamente.' });
  } catch (error) {
    console.error('Error al guardar rubro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: 'El código de rubro ya existe.' });
    }
    res.status(500).json({ success: false, mensaje: 'Error al insertar en la base de datos.' });
  }
});

// DELETE /api/rubros/:codigo - Eliminar rubro con protección de clave foránea
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const [result] = await db.query('DELETE FROM articulos_rubros WHERE codigo = ?', [codigo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'El rubro especificado no existe.' });
    }

    res.json({ success: true, mensaje: 'Rubro eliminado correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar rubro:', error);

    // Capturar si el rubro tiene artículos vinculados en la tabla 'articulos'
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'No se puede eliminar este rubro porque existen artículos asociados a él.' 
      });
    }

    res.status(500).json({ success: false, mensaje: 'Error interno al intentar eliminar el rubro.' });
  }
});

// PUT /api/rubros/:codigo - Modificar la descripción de un rubro existente
router.put('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const descripcion = (req.body.descripcion || req.body.nombre || '').trim().toUpperCase();

    if (!descripcion) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'La descripción del rubro es obligatoria.' 
      });
    }

    const [result] = await db.query(
      'UPDATE articulos_rubros SET descripcion = ? WHERE codigo = ?',
      [descripcion, codigo]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        mensaje: 'No se encontró el rubro para actualizar.' 
      });
    }

    res.json({ success: true, mensaje: 'Rubro actualizado correctamente.' });
  } catch (error) {
    console.error('❌ Error al actualizar rubro:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar el rubro en la base de datos.' });
  }
});

module.exports = router;