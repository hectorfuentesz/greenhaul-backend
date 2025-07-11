// 1. Importar paquetes
const express = require('express');
const cors = require('cors');
const db = require('./database.js'); // Conexión a la base de datos SQLite
const bcrypt = require('bcryptjs');   // Paquete para encriptar contraseñas

// 2. Crear la aplicación de Express
const app = express();
const PORT = 3000;

// 3. Middlewares
app.use(cors());          // Permite que tu front-end se comunique con este servidor
app.use(express.json());  // Permite al servidor entender los datos JSON

// 4. Ruta de bienvenida para probar que el servidor está vivo
app.get('/', (req, res) => {
  res.send('¡Servidor de GreenHaul funcionando y conectado a la base de datos!');
});

/**
 * @route   POST /api/register
 * @desc    Registra un nuevo usuario
 */
app.post('/api/register', (req, res) => {
    const { name, email, password, whatsapp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios.' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            return res.status(500).json({ message: 'Error al encriptar la contraseña.' });
        }
        
        const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES (?, ?, ?, ?)';
        db.run(sql, [name, email, hashedPassword, whatsapp], function(err) {
            if (err) {
                console.error(err.message);
                return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
            }
            res.status(201).json({ 
                message: 'Usuario registrado con éxito',
                userId: this.lastID 
            });
        });
    });
});

/**
 * @route   POST /api/login
 * @desc    Autentica (inicia sesión) un usuario
 */
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.get(sql, [email], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Error en el servidor al buscar usuario.' });
        }
        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ message: 'Error al comparar contraseñas.' });
            if (!isMatch) return res.status(400).json({ message: 'Credenciales inválidas.' });

            res.json({
                message: 'Inicio de sesión exitoso',
                user: { id: user.id, name: user.name, email: user.email }
            });
        });
    });
});

// 6. Poner el servidor a escuchar
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});