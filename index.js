// 1. Importar paquetes
const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcryptjs');

// 2. Crear la aplicación de Express
const app = express();
const PORT = 3000;

// 3. Middlewares
app.use(cors());
app.use(express.json());

// 4. Ruta de bienvenida
app.get('/', (req, res) => {
  res.send('¡Servidor de GreenHaul funcionando y listo para recibir peticiones!');
});

// 5. RUTAS DE API

/**
 * @route   POST /api/register
 * @desc    Registra un nuevo usuario
 */
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, whatsapp } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }
        
        // Encriptar la contraseña de forma asíncrona
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES (?, ?, ?, ?)';
        const params = [name, email, hashedPassword, whatsapp];

        // Usamos una Promise para manejar la base de datos de forma asíncrona
        db.run(sql, params, function(err) {
            if (err) {
                // Si el error es por email duplicado (código de error de SQLite)
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
                }
                // Para otros errores de base de datos
                console.error(err.message);
                return res.status(500).json({ message: 'Error al registrar el usuario en la base de datos.' });
            }
            // Si todo sale bien
            res.status(201).json({ 
                message: 'Usuario registrado con éxito',
                userId: this.lastID 
            });
        });

    } catch (error) {
        console.error("Error inesperado en /api/register:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

/**
 * @route   POST /api/login
 * @desc    Autentica (inicia sesión) un usuario
 */
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
          return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
        }

        const sql = 'SELECT * FROM users WHERE email = ?';
        db.get(sql, [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Error en el servidor al buscar usuario.' });
            }
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
        });
    } catch (error) {
        console.error("Error inesperado en /api/login:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


// 6. Poner el servidor a escuchar
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});