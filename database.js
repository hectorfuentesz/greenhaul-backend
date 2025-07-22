// Archivo: database.js (Módulo robusto para conexión y migración con PostgreSQL para GreenHaul)

// --- Dependencias ---
const { Pool } = require('pg');

// --- Configuración de la conexión a PostgreSQL ---
const pool = new Pool({
  user: process.env.PGUSER || 'greenhaul_user', // Cambia por tu usuario de PostgreSQL real
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'greenhaul_db', // Cambia por tu base de datos real
  password: process.env.PGPASSWORD || 'greenhaul_password', // Cambia por tu contraseña real
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false
});

// --- Exportación básica para queries directas ---
const db = {
  query: (...args) => pool.query(...args),
  connect: () => pool.connect()
};

// --- Función para crear tablas si no existen ---
async function connectAndSetupDatabase() {
  await pool.connect();
  // --- Crear tabla users ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      surname VARCHAR(120) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      whatsapp VARCHAR(30),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- Crear tabla products ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      category VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- Crear tabla orders ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      total_amount NUMERIC(12,2) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'activo',
      order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      order_folio VARCHAR(50) UNIQUE NOT NULL
    );
  `);

  // --- Crear tabla order_items ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price NUMERIC(12,2) NOT NULL
    );
  `);

  // --- Crear tabla addresses ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS addresses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(120),
      street VARCHAR(255) NOT NULL,
      neighborhood VARCHAR(120),
      city VARCHAR(120) NOT NULL,
      state VARCHAR(120),
      postal_code VARCHAR(20),
      "references" TEXT,
      country VARCHAR(80) DEFAULT 'México',
      latitude NUMERIC(10,6),
      longitude NUMERIC(10,6),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- Crear tabla order_addresses ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_addresses (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      order_folio VARCHAR(50) NOT NULL REFERENCES orders(order_folio) ON DELETE CASCADE,
      delivery_address_id INTEGER REFERENCES addresses(id),
      pickup_address_id INTEGER REFERENCES addresses(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // --- Crear tabla contact_messages ---
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = {
  db,
  connectAndSetupDatabase
};