const { MongoClient, ObjectId } = require('mongodb');

// Leer la URL de conexión desde las variables seguras de Vercel
const uri = process.env.MONGODB_URI;
let client;
let db;

async function conectarDB() {
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
        db = client.db('PresupuestoHogar'); // Nombre de tu Base de Datos
    }
    return db.collection('movimientos'); // Nombre de tu Colección
}

// Exportar la función controladora compatible con el entorno Serverless de Vercel
module.exports = async (req, res) => {
    // Habilitar CORS para que tu celular y PC puedan conectarse sin bloqueos
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
            const nuevoMovimiento = req.body;
            await coleccion.insertOne(nuevoMovimiento);
            return res.status(201).json({ mensaje: 'Movimiento guardado en MongoDB' });
        }

        // 3. ELIMINAR MOVIMIENTO (DELETE)
        if (req.method === 'DELETE') {
            const { id } = req.query; // Captura el id desde la URL
            await coleccion.deleteOne({ id: parseInt(id) });
            return res.status(200).json({ mensaje: 'Movimiento eliminado' });
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error("Error en el servidor:", error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
