const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function extraerFotos() {
  let connection;
  try {
    // Conexión usando las variables de entorno de tu archivo .env
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'uni_arte'
    });

    console.log('🔌 Conectado a la base de datos MySQL...');

    // Crear la carpeta física de destino si no existe
    const folderPath = path.join(__dirname, 'public', 'uploads', 'articulos');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`📁 Carpeta de destino creada: ${folderPath}`);
    }

    // Consultar todos los artículos con foto binaria cargada
    const [rows] = await connection.query(
      'SELECT codigo, foto FROM articulos WHERE foto IS NOT NULL AND LENGTH(foto) > 0'
    );

    console.log(`📸 Se encontraron ${rows.length} artículos con foto en la base de datos.`);

    let extraidas = 0;
    for (const row of rows) {
      if (row.foto && Buffer.isBuffer(row.foto)) {
        // Sanitizar el código para evitar caracteres no permitidos en nombres de archivo
        const codigoLimpio = String(row.codigo).trim().replace(/[/\\?%*:|"<>]/g, '-');
        const nombreArchivo = `${codigoLimpio}.png`;
        const filePath = path.join(folderPath, nombreArchivo);

        fs.writeFileSync(filePath, row.foto);
        extraidas++;
      }
    }

    console.log(`\n✅ ¡Extracción finalizada!`);
    console.log(`🖼️ Se crearon ${extraidas} imágenes físicas en "public/uploads/articulos/".`);

  } catch (error) {
    console.error('❌ Error durante la extracción de fotos:', error);
  } finally {
    if (connection) await connection.end();
  }
}

extraerFotos();