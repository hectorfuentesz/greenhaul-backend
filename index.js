const express = require('express');
const cors = require('cors');
const db = require('./database.js'); // Ahora es el cliente de PostgreSQL
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Campos obligatorios.' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // La sintaxis de SQL cambia de '?' a '$1, $2, etc.' para PostgreSQL
        const sql = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id';
        const values = [name, email, hashedPassword];
        
        const result = await db.query(sql, values);
        res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });

    } catch (err) {
        console.error("Error en /api/register:", err.message);
        res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
    }

    try {
        const sql = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(sql, [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        res.json({
            message: 'Inicio de sesión exitoso',
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error("Error en /api/login:", err.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});