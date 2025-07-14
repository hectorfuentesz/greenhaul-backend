const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20)
  );
`;

const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    street VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'México',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function connectAndSetupDatabase() {
  try {
    await client.connect();
    console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    await client.query(createTableQueryUsers);
    console.log("Tabla 'users' lista y preparada.");
    await client.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' lista y preparada.");
  } catch (err) {
    console.error("Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1);
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};
