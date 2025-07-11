const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/register', (req, res) => {
    const { name, email, password, whatsapp } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }
    
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) return res.status(500).json({ message: 'Error al encriptar.' });
        
        const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES (?, ?, ?, ?)';
        db.run(sql, [name, email, hashedPassword, whatsapp], function(err) {
            if (err) {
                return res.status(400).json({ message: 'El correo ya está registrado.' });
            }
            res.status(201).json({ message: 'Usuario registrado con éxito', userId: this.lastID });
        });
    });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});