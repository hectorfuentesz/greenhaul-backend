const { Client } = require('pg');

// Se conecta usando la URL que Railway te da automáticamente
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Define la estructura de la tabla de usuarios para PostgreSQL
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20)
  );
`;

// Función para conectar y preparar la base de datos
async function setupDatabase() {
  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos PostgreSQL en Railway.');
    await client.query(createTableQuery);
    console.log("👍 Tabla 'users' verificada y lista.");
  } catch (err) {
    console.error("❌ ERROR al conectar o configurar la base de datos:", err.stack);
    process.exit(1); // Detiene la aplicación si la base de datos falla
  }
}

module.exports = {
  db: client,
  setupDatabase
};