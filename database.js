// Archivo: database.js (Versión con Bloque de Migración TEMPORAL)

const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- Definiciones de tablas ---
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

const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'activo'
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
    console.log('✅ Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    
    // Ejecutar la creación de tablas.
    await client.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await client.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await client.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await client.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");

    // --- INICIO: BLOQUE DE MIGRACIÓN TEMPORAL ---
    // ESTE CÓDIGO DEBE SER ELIMINADO DESPUÉS DE QUE LA MIGRACIÓN SE EJECUTE CON ÉXITO UNA VEZ.
    console.log('🔄 Ejecutando migraciones de columna TEMPORALES...');
    try {
      await client.query('ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);');
      console.log("Columna 'name' en 'addresses' verificada/creada.");
      await client.query('ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);');
      console.log("Columna 'neighborhood' en 'addresses' verificada/creada.");
      await client.query('ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT;');
      console.log("Columna 'references' en 'addresses' verificada/creada.");
      await client.query('ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);');
      console.log("Columna 'latitude' en 'addresses' verificada/creada.");
      await client.query('ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);');
      console.log("Columna 'longitude' en 'addresses' verificada/creada.");
      await client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'activo\';');
      console.log("Columna 'status' en 'orders' verificada/creada.");
      console.log('✅ Migraciones de columna TEMPORALES completadas.');
    } catch (migrationErr) {
      console.error('❌ Error durante la ejecución de migraciones de columna TEMPORALES:', migrationErr.message);
      // No salir del proceso aquí, ya que el error podría ser que la columna ya existe
      // y estamos usando IF NOT EXISTS, pero puede haber otros problemas.
    }
    // --- FIN: BLOQUE DE MIGRACIÓN TEMPORAL ---


  } catch (err) {
    console.error("❌ Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1);
  }
}

module.exports = {
  db: client,
  connectAndSetupDatabase
};