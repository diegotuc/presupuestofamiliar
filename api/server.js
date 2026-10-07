const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000; // Render usa el puerto 10000 por defecto
const uri = process.env.MONGODB_URI;

// 1. Configurar CORS sin restricciones para evitar bloqueos en celulares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 2. SERVIR ARCHIVOS ESTÁTICOS PRIMERO (Esto evita que se congele el app.js y style.css)
// Le indica a Express que busque index.html, app.js y style.css en la carpeta raíz del proyecto
const rootPath = path.join(__dirname, '../');
app.use(express.static(rootPath));

let client;
let db;

async function conectarDB() {
    if (client && db) {
        return db.collection('movimientos');
    }
    client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db('PresupuestoHogar');
    return db.collection('movimientos');
}

// 3. RUTAS DE LA API
// GET: Obtener movimientos
app.get('/api/server', async (req, res) => {
    try {
        const coleccion = await conectarDB();
        const movimientos = await coleccion.find({}).sort({ id: -1 }).toArray();
        return res.status(200).json({ movimientos });
    } catch (error) {
        console.error("Error en GET /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// POST: Guardar movimiento
app.post('/api/server', async (req, res) => {
    try {
        const coleccion = await conectarDB();
        const nuevoMovimiento = req.body;

        if (!nuevoMovimiento.monto || !nuevoMovimiento.descripcion) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        await coleccion.insertOne(nuevoMovimiento);
        return res.status(201).json({ mensaje: 'Movimiento guardado con éxito' });
    } catch (error) {
        console.error("Error en POST /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// DELETE: Eliminar movimiento
app.delete('/api/server', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ error: 'ID requerido' });
        }

        const coleccion = await conectarDB();
        await coleccion.deleteOne({ id: parseInt(id) });
        return res.status(200).json({ mensaje: 'Movimiento eliminado con éxito' });
    } catch (error) {
        console.error("Error en DELETE /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// DELETE: Eliminar movimiento
app.delete('/api/server', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ error: 'ID requerido' });
        }

        const coleccion = await conectarDB();
        await coleccion.deleteOne({ id: parseInt(id) });
        return res.status(200).json({ mensaje: 'Movimiento eliminado con éxito' });
    } catch (error) {
        console.error("Error en DELETE /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// 4. RUTA COMODÍN UNIVERSAL SEGURA (Reemplaza al app.get)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(rootPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==> Servidor corriendo en el puerto ${PORT}`);
});
