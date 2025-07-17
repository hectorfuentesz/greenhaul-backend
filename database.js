// Archivo: database.js (Versión Simplificada de Tabla de Direcciones)

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Definiciones de tablas SQL ---

// Tabla 'users' (sin cambios, se mantiene como estaba)
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

// Tabla 'addresses': ¡SIMPLIFICADA! Solo los campos deseados.
const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),           -- Nombre descriptivo de la dirección
    street VARCHAR(255) NOT NULL, -- Calle y número
    neighborhood VARCHAR(255),   -- Colonia/Barrio
    city VARCHAR(100) NOT NULL,  -- Ciudad
    state VARCHAR(100),          -- Estado
    postal_code VARCHAR(20),     -- Código Postal
    "references" TEXT,           -- Referencias adicionales (escapado con comillas)
    country VARCHAR(100) DEFAULT 'México', -- País (opcional, si lo quieres mantener)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabla 'orders' (sin cambios, se mantiene como estaba)
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'activo'
  );
`;

// Tabla 'order_items' (sin cambios, se mantiene como estaba)
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
    console.log('✅ Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    
    // --- ATENCIÓN: PASO DE MIGRACIÓN CRUCIAL ---
    // Si tu tabla 'addresses' ya existe en Railway con columnas que NO quieres
    // (como 'latitude' y 'longitude'), DEBES eliminarlas manualmente ANTES de desplegar.
    // Railway no ofrece una consola SQL. Tus opciones son:
    // 1. Borrar y recrear la base de datos completamente en Railway (¡si no tienes datos importantes!)
    // 2. Conectarte con una herramienta externa (psql, DBeaver, pgAdmin) y ejecutar:
    //    ALTER TABLE addresses DROP COLUMN IF EXISTS latitude;
    //    ALTER TABLE addresses DROP COLUMN IF EXISTS longitude;
    //    Y asegurarte de que "references", name, neighborhood etc. existan con:
    //    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    //    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    //    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT;
    //    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    // ---------------------------------------------
    
    await client.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await client.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await client.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await client.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");

  } catch (err) {
    console.error("❌ Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1); 
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};