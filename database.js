// Importamos el cliente de PostgreSQL
const { Client } = require('pg');

// Creamos una nueva instancia del cliente.
// Railway inyectará la URL de conexión automáticamente en esta variable de entorno.
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Necesario para las conexiones seguras en entornos de producción como Railway
    rejectUnauthorized: false
  }
});

// Definimos la estructura de nuestra tabla de usuarios en una constante para mayor claridad.
const createUsersTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(20)
  );
`;

/**
 * Función asíncrona para conectar a la base de datos y configurar la tabla.
 * Esto nos permite controlar el orden en que se ejecutan las cosas.
 */
async function setupDatabase() {
  try {
    // 1. Conectar el cliente a la base de datos de Railway
    await client.connect();
    console.log('✅ Conexión exitosa a la base de datos PostgreSQL en Railway.');

    // 2. Ejecutar la consulta para crear la tabla si no existe
    await client.query(createUsersTableQuery);
    console.log("👍 Tabla 'users' verificada y lista para usarse.");

  } catch (err) {
    console.error("❌ ERROR: No se pudo conectar o configurar la base de datos.");
    console.error(err.stack);
    // Si hay un error aquí, detenemos todo el proceso para que sea fácil de depurar.
    process.exit(1);
  }
}

// Exportamos tanto el cliente de la base de datos como la función de configuración
module.exports = {
  db: client,
  setupDatabase
};