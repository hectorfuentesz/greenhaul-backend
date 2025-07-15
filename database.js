// Archivo: database.js

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- DEFINICIONES DE TABLAS EXISTENTES ---
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

// --- INICIO: NUEVAS TABLAS PARA ÓRDENES ---
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY, -- Este será nuestro folio base
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Si se borra el user, la orden no se pierde
    total_amount NUMERIC(10, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
`;

const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, -- Vinculado a la orden
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL -- Precio al momento de la compra
  );
`;
// --- FIN: NUEVAS TABLAS PARA ÓRDENES ---


async function connectAndSetupDatabase() {
  try {
    await client.connect();
    console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    
    // Tablas existentes
    await client.query(createTableQueryUsers);
    console.log("Tabla 'users' lista.");
    await client.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' lista.");

    // --- INICIO: Crear las nuevas tablas ---
    await client.query(createTableQueryOrders);
    console.log("Tabla 'orders' lista.");
    await client.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' lista.");
    // --- FIN: Crear las nuevas tablas ---

  } catch (err) {
    console.error("Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1);
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};