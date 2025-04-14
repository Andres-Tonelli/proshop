require('dotenv').config();
const mysql = require('mysql2/promise');

const fecha = process.argv[2];

if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    console.error("❌ Debes ingresar una fecha válida en formato AAAA-MM-DD");
    process.exit(1);
}

async function sumarRecibido(fecha) {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await connection.execute(
            'Select E.fecha, sum(E.valor) as totaldia from (SELECT fecha, (vendidos*precioPromedio)as valor FROM proshop.venta where fecha = ?) as E group by fecha',
            [fecha]
        );

        const total = rows[0].totaldia ?? 0;
        console.log(`✅ Total recibidoNeto para el ${fecha}: $${total}`);

        // Insertar o actualizar en totalordenesdia
        await connection.execute(
            `INSERT INTO totalventasdia (tventas_fecha, tventas_total)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE tventas_total = VALUES(tventas_total)`,
            [fecha, total]
        );

        console.log(`✅ Total insertado/actualizado en la tabla totalventasdia`);

        await connection.end();

    } catch (error) {
        console.error("❌ Error:", error.message);
        if (connection) await connection.end();
    }
}

sumarRecibido(fecha);
