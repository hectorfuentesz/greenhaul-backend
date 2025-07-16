// Archivo: index.js

const express = require('express');
const cors = require('cors');
const { db, connectAndSetupDatabase } = require('./database.js');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
});

// --- 1. RUTA DE REGISTRO CORREGIDA ---
app.post('/api/register', async (req, res) => {
  // Ahora esperamos 'name' y 'surname' por separado
  const { name, surname, email, password, whatsapp } = req.body;
  
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ message: 'Nombre, apellido, correo y contraseña son obligatorios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // La consulta SQL ahora incluye la columna 'surname'
    const sql = 'INSERT INTO users (name, surname, email, password, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const values = [name, surname, email, hashedPassword, whatsapp];
    
    const result = await db.query(sql, values);
    res.status(201).json({ message: 'Usuario registrado.', userId: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ message: 'El correo ya está registrado.' });
  }
});

// --- 2. RUTA DE LOGIN CORREGIDA ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Correo no registrado.' });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    // El objeto de usuario ahora incluye el APELLIDO
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: { 
        id: user.id, 
        name: user.name, 
        surname: user.surname,
        email: user.email, 
        whatsapp: user.whatsapp 
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// --- 2.5. NUEVA RUTA: OBTENER USUARIO POR ID ---
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, surname, email, whatsapp FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("Error en GET /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// --- 3. RUTA DE ACTUALIZACIÓN DE PERFIL (YA ROBUSTA) ---
app.put('/api/users/:id', async (req, res) => {
  try {
    // Acepta cualquiera de estos campos para actualizar
    const { name, surname, email, whatsapp } = req.body;
    const { id } = req.params;

    const updates = [];
    const values = [];
    let queryIndex = 1;

    if (name) { updates.push(`name = $${queryIndex++}`); values.push(name); }
    if (surname) { updates.push(`surname = $${queryIndex++}`); values.push(surname); }
    if (email) { updates.push(`email = $${queryIndex++}`); values.push(email); }
    if (whatsapp) { updates.push(`whatsapp = $${queryIndex++}`); values.push(whatsapp); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar.' });
    }

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING *`;
    values.push(id);

    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    
    // Devuelve el usuario completo y actualizado
    const updatedUser = result.rows[0];
    res.status(200).json({
      message: 'Perfil actualizado con éxito.',
      user: {
          id: updatedUser.id,
          name: updatedUser.name,
          surname: updatedUser.surname,
          email: updatedUser.email,
          whatsapp: updatedUser.whatsapp
      }
    });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'El correo electrónico ya está en uso por otra cuenta.' });
    }
    console.error("Error en /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// ========================
// RUTAS PARA DIRECCIONES (Sin cambios)
// ========================
app.get('/api/users/:userId/addresses', async (req, res) => { /* ... tu código ... */ });
app.post('/api/users/:userId/addresses', async (req, res) => { /* ... tu código ... */ });
app.put('/api/addresses/:id', async (req, res) => { /* ... tu código ... */ });
app.delete('/api/addresses/:id', async (req, res) => { /* ... tu código ... */ });

// ========================
// RUTA PARA CREAR ÓRDENES (Sin cambios)
// ========================
app.post('/api/orders', async (req, res) => { /* ... tu código ... */ });

// --- Función para iniciar el servidor ---
async function startServer() {
  await connectAndSetupDatabase();
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

startServer();