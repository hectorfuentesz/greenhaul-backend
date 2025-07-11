const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20)
  );
`;

async function connectAndSetupDatabase() {
  try {
    await client.connect();
    console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    await client.query(createTableQuery);
    console.log("Tabla 'users' lista y preparada.");
  } catch (err) {
    console.error("Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1);
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};