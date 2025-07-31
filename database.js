// Archivo: database.js (GreenHaul, completo, incluye bundle_contents, columna type en products y tabla reservas por fechas)

const { Pool } = require('pg');

// Configuración de la Pool de conexiones a PostgreSQL.
// Cambia esta URL por la de producción cuando sea necesario.
const pool = new Pool({ 
  connectionString: 'postgresql://postgres:ITYRPvLotXzkvsAUUjEhlExxKxYPrMtN@ballast.proxy.rlwy.net:32833/railway',
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

// Tabla 'products'
const createTableQueryProducts = `
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// MODIFICACIÓN: Agregar columna "type" a products (si no existe)
const alterTableQueryProductsAddType = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name='products' AND column_name='type'
    ) THEN
      ALTER TABLE products ADD COLUMN type VARCHAR(20) DEFAULT 'individual';
    END IF;
  END
  $$;
`;

// Tabla 'bundle_contents' (productos que componen cada paquete)
const createTableQueryBundleContents = `
  CREATE TABLE IF NOT EXISTS bundle_contents (
    id SERIAL PRIMARY KEY,
    bundle_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );
`;

// Tabla 'reservas' (manejo de inventario por fechas)
const createTableQueryReservas = `
  CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    usuario_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    estado VARCHAR(20) DEFAULT 'activa', -- activa, cancelada, completada, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    await clientForSetup.query(createTableQueryProducts);
    console.log("Tabla 'products' verificada/creada.");
    await clientForSetup.query(alterTableQueryProductsAddType); // NUEVO: asegura columna "type"
    console.log("Columna 'type' verificada/agregada en 'products'.");
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
    await clientForSetup.query(createTableQueryBundleContents); // NUEVO: tabla de composición de paquetes
    console.log("Tabla 'bundle_contents' verificada/creada.");
    await clientForSetup.query(createTableQueryReservas); // NUEVO: tabla de reservas por fechas
    console.log("Tabla 'reservas' verificada/creada.");
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