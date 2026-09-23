const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Conexión al pool de la base de datos MySQL
const db = require('./src/config/db'); 

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------------
// MIDDLEWARES DE PARSEO
// -------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Directorio físico para almacenar las imágenes subidas
const dirUploads = path.join(__dirname, 'public', 'uploads', 'articulos');
if (!fs.existsSync(dirUploads)) {
  fs.mkdirSync(dirUploads, { recursive: true });
}

// -------------------------------------------------------------
// 🛡️ INTERCEPTOR DE IMÁGENES (Evita errores 404 y desactiva caché)
// -------------------------------------------------------------
app.get('/uploads/articulos/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(dirUploads, fileName);

  // Desactivar caché para ver cambios de foto al instante
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="#ccc" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>`;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.status(200).send(svgPlaceholder);
});

// Servidor de archivos estáticos
app.use(express.static('public'));

// -------------------------------------------------------------
// CONFIGURACIÓN DE MULTER (Almacenamiento en memoria para Sharp)
// -------------------------------------------------------------
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // Permite fotos pesadas de hasta 15 MB antes de optimizarlas
});

// Helper para procesar, redimensionar y guardar la foto con Sharp
const procesarYGuardarFoto = async (fileBuffer, codigo) => {
  if (!fileBuffer || !codigo) return;
  
  const codigoLimpio = String(codigo).trim().replace(/[/\\?%*:|"<>]/g, '-');
  const rutaDestino = path.join(dirUploads, `${codigoLimpio}.png`);

  await sharp(fileBuffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true }) // Redimensiona manteniendo proporción
    .png({ quality: 80, compressionLevel: 8 })                  // Convierte a PNG liviano y optimizado
    .toFile(rutaDestino);
};

// -------------------------------------------------------------
// RUTAS DE LA API REST
// -------------------------------------------------------------

// 1. Diagnóstico del servidor
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', mensaje: 'Servidor UniArte funcionando' });
});

// 2. Obtener lista de rubros
app.get('/api/rubros', async (req, res) => {
  try {
    const sql = `
      SELECT ar.codigo, ar.descripcion, COALESCE(a.codigo_prefijo, '') AS codigo_prefijo
      FROM articulos_rubros ar
      LEFT JOIN (
        SELECT rubro, MAX(codigo_prefijo) AS codigo_prefijo
        FROM articulos
        WHERE codigo_prefijo IS NOT NULL AND codigo_prefijo != ''
        GROUP BY rubro
      ) a ON ar.codigo = a.rubro
      ORDER BY ar.descripcion ASC
    `;
    const [rows] = await db.query(sql);
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('Error al obtener rubros:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener rubros: ' + error.message });
  }
});

// 3. Obtener catálogo de artículos (con búsqueda)
app.get('/api/articulos', async (req, res) => {
  try {
    const { buscar } = req.query;
    let sql = `
      SELECT codigo, codigo_prefijo, codigo_sufijo, descripcion, rubro, 
             precio_venta, llevar_stock, stock_critico, ancho, alto, tiempo_maquina, obs
      FROM articulos
    `;
    let params = [];

    if (buscar && buscar.trim() !== '') {
      sql += ` WHERE codigo LIKE ? OR descripcion LIKE ?`;
      const termino = `%${buscar.trim()}%`;
      params.push(termino, termino);
    }

    sql += ` ORDER BY codigo ASC LIMIT 100`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('Error al consultar artículos:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor' });
  }
});

// 4. Obtener un artículo por su código
app.get('/api/articulos/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await db.query('SELECT * FROM articulos WHERE codigo = ?', [codigo]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado' });
    }
    
    res.json({ success: true, dato: rows[0] });
  } catch (error) {
    console.error('Error al obtener artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar el artículo' });
  }
});

// 5. Crear un nuevo artículo (con conversión a MAYÚSCULAS)
app.post('/api/articulos', upload.single('foto'), async (req, res) => {
  try {
    // 🔹 Normalizar texto a MAYÚSCULAS
    const codigo_prefijo = (req.body.codigo_prefijo || '').trim().toUpperCase();
    const codigo_sufijo  = (req.body.codigo_sufijo || '').trim().toUpperCase();
    const codigo         = (req.body.codigo || '').trim().toUpperCase();
    const descripcion    = (req.body.descripcion || '').trim().toUpperCase();
    const obs            = (req.body.obs || '').trim().toUpperCase();

    // Valores numéricos / selección
    const { 
      rubro, alicuota, precio_venta, llevar_stock, stock_critico, 
      ancho, alto, tiempo_maquina 
    } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({ success: false, mensaje: 'El código y la descripción son obligatorios.' });
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
      rubro || 0,
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

    // Procesar foto con Sharp
    if (req.file) {
      await procesarYGuardarFoto(req.file.buffer, codigo);
    }

    res.json({ success: true, mensaje: 'Artículo creado exitosamente.' });
  } catch (error) {
    console.error('Error al guardar artículo:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: 'El código ingresado ya existe.' });
    }
    res.status(500).json({ success: false, mensaje: 'Error al insertar en la base de datos: ' + error.message });
  }
});

// 6. Actualizar un artículo existente (con conversión a MAYÚSCULAS)
app.put('/api/articulos/:codigo', upload.single('foto'), async (req, res) => {
  try {
    const { codigo } = req.params;

    // 🔹 Normalizar texto a MAYÚSCULAS
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

    // Procesar nueva foto si se seleccionó una
    if (req.file) {
      await procesarYGuardarFoto(req.file.buffer, codigo);
    }

    res.json({ success: true, mensaje: 'Artículo actualizado exitosamente.' });
  } catch (error) {
    console.error('Error al actualizar artículo:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar en la base de datos.' });
  }
});

// 7. Eliminar un artículo (y su archivo de foto físico)
app.delete('/api/articulos/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    // 1. Eliminar de MySQL
    const [result] = await db.query('DELETE FROM articulos WHERE codigo = ?', [codigo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'El artículo no existe o ya fue eliminado.' });
    }

    // 2. Borrar foto física si existe
    const codigoLimpio = String(codigo).trim().replace(/[/\\?%*:|"<>]/g, '-');
    const filePath = path.join(dirUploads, `${codigoLimpio}.png`);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (errFile) {
        console.error('Error al borrar archivo de imagen:', errFile);
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

// -------------------------------------------------------------
// INICIO DEL SERVIDOR
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
