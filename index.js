// 1. Importar paquetes
const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcryptjs');

// 2. Crear la aplicación de Express
const app = express();
const PORT = 3000;

// 3. Middlewares (muy importantes para la conexión)
app.use(cors());          // Permite que tu front-end se comunique con este servidor
app.use(express.json());  // Permite al servidor entender los datos JSON de los formularios

// 4. Ruta de bienvenida para verificar que el servidor está vivo
app.get('/', (req, res) => {
  res.send('¡Servidor de GreenHaul funcionando y listo para recibir peticiones!');
});

// 5. RUTAS DE API PARA USUARIOS

/**
 * @route   POST /api/register
 * @desc    Registra un nuevo usuario
 */
app.post('/api/register', (req, res) => {
    try {
        const { name, email, password, whatsapp } = req.body;
        if (!name || !email || !password) {
          return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }
    
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error("Error de Bcrypt:", err);
                return res.status(500).json({ message: 'Error al encriptar la contraseña.' });
            }
            
            const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES (?, ?, ?, ?)';
            db.run(sql, [name, email, hashedPassword, whatsapp], function(err) {
                if (err) {
                    console.error("Error de Base de Datos:", err);
                    return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
                }
                res.status(201).json({ 
                    message: 'Usuario registrado con éxito',
                    userId: this.lastID 
                });
            });
        });

    } catch (error) {
        console.error("Error inesperado en /api/register:", error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


// 6. Poner el servidor a escuchar
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});