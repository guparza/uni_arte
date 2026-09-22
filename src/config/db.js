const mysql = require('mysql2');
require('dotenv').config();

// Crear el Pool de conexiones usando las variables del archivo .env
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uni_arte',
  waitForConnections: true,
  connectionLimit: 10, // Máximo de conexiones simultáneas
  queueLimit: 0
});

// Convertir el pool para usar Promesas (async/await), lo que hace el código más limpio
const promisePool = pool.promise();

module.exports = promisePool;