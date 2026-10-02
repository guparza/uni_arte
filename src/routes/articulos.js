// src/routes/articulos.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Configuración de Multer (almacenamiento en memoria para procesamiento con Sharp)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Máximo 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Carpeta donde se guardan las imágenes procesadas
const dirUploads = path.join(__dirname, '../../public/uploads/articulos');
if (!fs.existsSync(dirUploads)) {
  fs.mkdirSync(dirUploads, { recursive: true });
}

// Función auxiliar para optimizar y guardar la foto con Sharp
async function procesarYGuardarFoto(buffer, codigo) {
  const codigoLimpio = String(codigo).trim().replace(/[/\\?%*:|"<>]/g, '-');
  const filePath = path.join(dirUploads, `${codigoLimpio}.png`);
  await sharp(buffer)
    .resize(300, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ quality: 80 })
    .toFile(filePath);
}

// 1. Obtener todos los artículos (Consulta optimizada de alto rendimiento)
router.get('/', async (req, res) => {
  try {
    const sql = `
      SELECT a.*, r.descripcion AS rubro_nombre 
      FROM articulos a 
      LEFT JOIN articulos_rubros r ON a.rubro = r.codigo 
      ORDER BY a.descripcion ASC
    `;
    const [rows] = await db.query(sql);

    // Cargar nombres de archivos del directorio en memoria de una sola vez
    let archivosEnDisco = new Set();
    if (fs.existsSync(dirUploads)) {
      archivosEnDisco = new Set(fs.readdirSync(dirUploads));
    }

    // Mapeo ultrarrápido en memoria RAM sin bloqueos I/O
    const dataVerificada = rows.map(a => {
      const codigoLimpio = String(a.codigo || '').trim().replace(/[/\\?%*:|"<>]/g, '-');
      return {
        ...a,
        tiene_foto: archivosEnDisco.has(`${codigoLimpio}.png`)
      };
    });

    res.json({ success: true, data: dataVerificada });
  } catch (error) {
    console.error('Error al obtener artículos:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar la base de datos.' });
  }
});

// 2. Buscar un artículo específico por código
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await db.query('SELECT * FROM articulos WHERE codigo = ?', [codigo]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al buscar artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor.' });
  }
});

// 3. Crear nuevo artículo
router.post('/', upload.single('foto'), async (req, res) => {
  try {
    const codigo_prefijo = (req.body.codigo_prefijo || '').trim().toUpperCase();
    const codigo_sufijo  = (req.body.codigo_sufijo || '').trim().toUpperCase();
    const codigo         = (req.body.codigo || '').trim().toUpperCase();
    const descripcion    = (req.body.descripcion || '').trim().toUpperCase();
    const obs            = (req.body.obs || '').trim().toUpperCase();

    const { 
      rubro, alicuota, precio_venta, llevar_stock, stock_critico, 
      ancho, alto, tiempo_maquina 
    } = req.body;

    // 🔹 Validaciones obligatorias
    if (!codigo || !descripcion) {
      return res.status(400).json({ success: false, mensaje: 'El código y la descripción son obligatorios.' });
    }

    if (!rubro || parseInt(rubro) === 0) {
      return res.status(400).json({ success: false, mensaje: 'Debes seleccionar un Rubro / Categoría válido.' });
    }

    const sup = (parseFloat(ancho || 0) * parseFloat(alto || 0)).toFixed(4);

    const sql = `
      INSERT INTO articulos 
      (codigo, codigo_prefijo, codigo_sufijo, descripcion, rubro, alicuota, precio_venta, llevar_stock, stock_critico, ancho, alto, superficie, tiempo_maquina, obs) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      codigo,
      codigo_prefijo,
      codigo_sufijo,
      descripcion,
      parseInt(rubro),
      alicuota || 1,
      precio_venta || 0,
      (llevar_stock || 'S').toUpperCase(),
      stock_critico || 0,
      ancho || 0,
      alto || 0,
      sup,
      tiempo_maquina || 0,
      obs
    ]);

    if (req.file) {
      await procesarYGuardarFoto(req.file.buffer, codigo);
    }

    res.json({ success: true, mensaje: 'Artículo creado exitosamente.' });
  } catch (error) {
    console.error('Error al guardar artículo:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: 'El código ingresado ya existe.' });
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ success: false, mensaje: 'El rubro seleccionado no existe en la base de datos.' });
    }
    res.status(500).json({ success: false, mensaje: 'Error al insertar en la base de datos: ' + error.message });
  }
});

// 4. Actualizar un artículo existente (con conversión a MAYÚSCULAS)
router.put('/:codigo', upload.single('foto'), async (req, res) => {
  try {
    const { codigo } = req.params;

    const descripcion = (req.body.descripcion || '').trim().toUpperCase();
    const obs         = (req.body.obs || '').trim().toUpperCase();

    const { 
      rubro, alicuota, precio_venta, llevar_stock, 
      stock_critico, ancho, alto, tiempo_maquina 
    } = req.body;

    if (!descripcion) {
      return res.status(400).json({ success: false, mensaje: 'La descripción es obligatoria.' });
    }

    const sup = (parseFloat(ancho || 0) * parseFloat(alto || 0)).toFixed(4);

    const sql = `
      UPDATE articulos 
      SET descripcion = ?, rubro = ?, alicuota = ?, precio_venta = ?, llevar_stock = ?, 
          stock_critico = ?, ancho = ?, alto = ?, superficie = ?, tiempo_maquina = ?, obs = ?
      WHERE codigo = ?
    `;

    const [result] = await db.query(sql, [
      descripcion,
      rubro || 0,
      alicuota || 1,
      precio_venta || 0,
      (llevar_stock || 'S').toUpperCase(),
      stock_critico || 0,
      ancho || 0,
      alto || 0,
      sup,
      tiempo_maquina || 0,
      obs,
      codigo.trim().toUpperCase()
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado para actualizar.' });
    }

    if (req.file) {
      await procesarYGuardarFoto(req.file.buffer, codigo);
    }

    res.json({ success: true, mensaje: 'Artículo actualizado exitosamente.' });
  } catch (error) {
    console.error('Error al actualizar artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar en la base de datos.' });
  }
});

// 5. Eliminar un artículo y su foto física del servidor
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const [result] = await db.query('DELETE FROM articulos WHERE codigo = ?', [codigo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'El artículo no existe o ya fue eliminado.' });
    }

    const codigoLimpio = String(codigo).trim().replace(/[/\\?%*:|"<>]/g, '-');
    const filePath = path.join(dirUploads, `${codigoLimpio}.png`);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (errFile) {
        console.error('Error al borrar foto:', errFile);
      }
    }

    res.json({ success: true, mensaje: 'Artículo y foto eliminados exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar artículo:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'No se puede eliminar este artículo porque posee registros asociados en ventas o stock.' 
      });
    }
    res.status(500).json({ success: false, mensaje: 'Error interno en el servidor: ' + error.message });
  }
});

module.exports = router;