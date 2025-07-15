// Archivo: database.js (Con script de modificación temporal)

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Definiciones de tablas (sin cambios) ---
const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
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
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
  );
`;

async function connectAndSetupDatabase() {
  try {
    await client.connect();
    console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.');

    // ========================================================================
    // --- INICIO: SCRIPT ÚNICO PARA AÑADIR LA COLUMNA 'surname' ---
    // Este bloque intentará añadir la columna. Si ya existe, no hará nada.
    try {
      await client.query('ALTER TABLE users ADD COLUMN surname VARCHAR(100)');
      console.log("✅ ¡ÉXITO! Columna 'surname' añadida a la tabla 'users'.");
    } catch (err) {
      // El código '42701' significa que la columna ya existe. Lo ignoramos.
      if (err.code === '42701') {
        console.log("ℹ️ INFO: La columna 'surname' ya existía. No se realizó ninguna acción.");
      } else {
        // Si es otro error, sí lo mostramos para depurar.
        console.error("Error al intentar añadir la columna 'surname':", err.message);
      }
    }
    // --- FIN: SCRIPT ÚNICO ---
    // ========================================================================
    
    // El resto del código de setup continúa normalmente
    await client.query(createTableQueryUsers);
    console.log("Tabla 'users' lista.");
    await client.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' lista.");
    await client.query(createTableQueryOrders);
    console.log("Tabla 'orders' lista.");
    await client.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' lista.");

  } catch (err) {
    console.error("Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1);
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};