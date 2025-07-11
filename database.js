const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./greenhaul.db', (err) => {
  if (err) {
    console.error("Error al abrir la base de datos:", err.message);
  } else {
    console.log("Conectado a la base de datos SQLite.");
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      whatsapp TEXT
    )`, (err) => {
      if (err) console.error("Error al crear la tabla:", err.message);
      else console.log("Tabla 'users' lista y preparada.");
    });
  }
});
module.exports = db;