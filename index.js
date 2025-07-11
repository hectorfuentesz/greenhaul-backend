const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL, // Usa la variable de entorno de Railway
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.'))
  .catch(err => console.error('Error en la conexión a la base de datos:', err.stack));

// Creamos la tabla de usuarios si no existe
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20)
  );
`;

client.query(createTableQuery)
  .then(() => console.log("Tabla 'users' lista y preparada."))
  .catch(err => console.error("Error al crear la tabla 'users':", err.stack));

module.exports = client;