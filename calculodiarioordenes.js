const dayjs = require('dayjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const fecha = process.argv[2];

if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    console.error("❌ Debes ingresar una fecha válida en formato AAAA-MM-DD");
    process.exit(1);
}

async function sumarRecibido(fechaStr) {
    let connection;
    const fechaActual = dayjs(fechaStr);
    const fechaAnterior = fechaActual.subtract(7, 'day').format('YYYY-MM-DD');

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // Total del día actual
        const [rows] = await connection.execute(
            'SELECT SUM(recibidoNeto) AS total FROM orden WHERE fechaCierre = ?',
            [fechaStr]
        );
        const total = rows[0].total ?? 0;

        // Total del mismo día hace 7 días
        const [rowsPrev] = await connection.execute(
            'SELECT SUM(recibidoNeto) AS total FROM orden WHERE fechaCierre = ?',
            [fechaAnterior]
        );
        const totalAnterior = rowsPrev[0].total ?? 0;

        // Insertar o actualizar el total del día actual
        await connection.execute(
            `INSERT INTO totalordenesdia (tordenes_fecha, tordenes_total, tordenes_total7dias)
             VALUES (?, ?, ?)
             `,/*ON DUPLICATE KEY UPDATE 
             tordenes_total = VALUES(tordenes_total),
             tordenes_total7dias = VALUES(tordenes_total7dias)*/
            [fechaStr, total, totalAnterior]
        );
        console.log(`✅ Total insertado/actualizado para ${fechaStr}`);

        await connection.end();
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (connection) await connection.end();
    }
}

sumarRecibido(fecha);