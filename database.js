const { Client } = require('pg');

const client = new Client({
  // Lee la variable de entorno que Railway inyecta automáticamente
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

// Creamos una función que podemos llamar para conectar y preparar todo
async function connectAndSetupDatabase() {
  try {
    await client.connect();
    console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    await client.query(createTableQuery);
    console.log("Tabla 'users' lista y preparada.");
  } catch (err) {
    console.error("Error al conectar o configurar la base de datos:", err.stack);
    // Si hay un error aquí, detenemos el proceso para que el log de Railway muestre el error
    process.exit(1);
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};