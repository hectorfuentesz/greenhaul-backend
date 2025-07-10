// Importamos el paquete de sqlite3
const sqlite3 = require('sqlite3').verbose();

// Creamos y conectamos a la base de datos (se creará un archivo llamado 'greenhaul.db')
const db = new sqlite3.Database('./greenhaul.db', (err) => {
  if (err) {
    console.error("Error al abrir la base de datos:", err.message);
  } else {
    console.log("Conectado a la base de datos SQLite.");
    
    // Creamos la tabla de usuarios si no existe.
    // El campo 'email' es UNIQUE para evitar registros duplicados.
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )`, (err) => {
      if (err) {
        console.error("Error al crear la tabla 'users':", err.message);
      } else {
        console.log("Tabla 'users' lista y preparada.");
      }
    });
  }
});

// Exportamos la conexión a la base de datos para usarla en nuestro servidor
module.exports = db;