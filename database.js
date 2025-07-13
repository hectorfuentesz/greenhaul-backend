const sqlite3 = require('sqlite3').verbose();

// Se conecta a un archivo de base de datos local. Si no existe, lo crea.
const db = new sqlite3.Database('./greenhaul.db', (err) => {
  if (err) {
    console.error("Error al abrir la base de datos:", err.message);
  } else {
    console.log("Conectado a la base de datos SQLite.");
    
    // Crea la tabla de usuarios si no existe, incluyendo el campo para WhatsApp
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        whatsapp TEXT
      )`;

    db.run(sql, (err) => {
      if (err) {
        console.error("Error al crear la tabla 'users':", err.message);
      } else {
        console.log("Tabla 'users' lista y preparada.");
      }
    });
  }
});

module.exports = db;