const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
let client;
let db;

async function conectarDB() {
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db('PresupuestoHogar'); // Tu base de datos creada en Compass
    }
    return db.collection('movimientos'); // Tu tabla creada en Compass
}

// Función auxiliar para leer el cuerpo de la petición (body) en Vercel
async function leerBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => { resolve(JSON.parse(body || '{}')); });
    });
}

module.exports = async (req, res) => {
    // Habilitar CORS para evitar bloqueos entre celular y PC
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const coleccion = await conectarDB();

        // 1. OBTENER MOVIMIENTOS (GET)
        if (req.method === 'GET') {
            const movimientos = await coleccion.find({}).sort({ id: -1 }).toArray();
            return res.status(200).json({ movimientos });
        }

        // 2. GUARDAR MOVIMIENTO (POST)
        if (req.method === 'POST') {
            const nuevoMovimiento = await leerBody(req);
            await coleccion.insertOne(nuevoMovimiento);
            return res.status(201).json({ mensaje: 'Movimiento guardado' });
        }

        // 3. ELIMINAR MOVIMIENTO (DELETE)
        if (req.method === 'DELETE') {
            // Conseguir el ID desde los parámetros de la URL
            const urlParams = new URL(req.url, `http://${req.headers.host}`);
            const id = urlParams.searchParams.get('id');
            
            await coleccion.deleteOne({ id: parseInt(id) });
            return res.status(200).json({ mensaje: 'Movimiento eliminado' });
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error("Error crítico en servidor:", error);
        return res.status(500).json({ error: error.message });
    }
};
