// Archivo: database.js (Versión Final, con tabla contact_messages incluida)

const { Pool } = require('pg');

// Configuración de la Pool de conexiones a PostgreSQL.
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Definiciones de tablas SQL ---

// Tabla 'users'
const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabla 'addresses'
const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    street VARCHAR(255) NOT NULL,
    neighborhood VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    "references" TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    country VARCHAR(100) DEFAULT 'México',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabla 'orders'
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'activo',
    order_folio VARCHAR(50) UNIQUE NOT NULL
  );
`;

// Tabla 'order_items'
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
  );
`;

// Tabla 'order_addresses'
const createTableQueryOrderAddresses = `
  CREATE TABLE IF NOT EXISTS order_addresses (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_folio VARCHAR(50) NOT NULL REFERENCES orders(order_folio) ON DELETE CASCADE,
    delivery_address_id INTEGER REFERENCES addresses(id),
    pickup_address_id INTEGER REFERENCES addresses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabla 'contact_messages'
const createTableQueryContactMessages = `
  CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Función para crear todas las tablas al iniciar el backend.
async function connectAndSetupDatabase() {
  let clientForSetup;
  try {
    clientForSetup = await pool.connect();
    await clientForSetup.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await clientForSetup.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await clientForSetup.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await clientForSetup.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");
    await clientForSetup.query(createTableQueryOrderAddresses);
    console.log("Tabla 'order_addresses' verificada/creada.");
    await clientForSetup.query(createTableQueryContactMessages);
    console.log("Tabla 'contact_messages' verificada/creada.");
    console.log('✅ Base de datos PostgreSQL en Railway verificada/configurada.');
  } catch (err) {
    console.error("❌ Error CRÍTICO al conectar o configurar la base de datos (setup):", err.stack);
    process.exit(1);
  } finally {
    if (clientForSetup) {
      clientForSetup.release();
    }
  }
}

module.exports = {
  db: pool,
  connectAndSetupDatabase
};