const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

function convertirFecha(excelDate) {
    if (!excelDate) {
        console.error("❌ Error: No se encontró la fecha en B1.");
        process.exit(1);
    } 

    if (typeof excelDate === 'number') {
        const fecha = XLSX.SSF.parse_date_code(excelDate);
        return `${fecha.y}-${String(fecha.m).padStart(2, '0')}-${String(fecha.d).padStart(2, '0')}`;
    }

    const partes = excelDate.split('/');
    if (partes.length === 3) {
        let [dia, mes, año] = partes.map(p => p.padStart(2, '0'));
        if (año.length === 2) año = `20${año}`;
        return `${año}-${mes}-${dia}`;
    }

    return null;
}

async function importarExcel(filePath) {
    try {
        // Conectar a MySQL
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log("Conectado a la base de datos MySQL.");

        // Leer el archivo Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convertir la hoja a un array de arrays y omitir las primeras 2 filas
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(3);

        // Columnas deseadas y sus índices
        const columnasDeseadas = ["F", "I", "AQ", "AU", "AO"];
        const indices = columnasDeseadas.map(col => XLSX.utils.decode_col(col));

        // Preparar datos para insertar en MySQL
        for (const fila of jsonData) {
            const valores = indices.map((i, idx) => {
                if (idx === 0) return convertirFecha(fila[i]); // Convertir fecha en la columna F
                return fila[i] || null;
            });

            // Insertar en la tabla "ordenes"
            const [ordenResult] = await connection.query(
                "INSERT INTO orden (fechaCierre, apodoVendedor, subtotalArticulos, recibidoNeto) VALUES (?, ?, ?, ?)",
                valores
            );

            const ordenId = ordenResult.insertId; // Obtener ID de la orden insertada

            // Manejar la columna AO (productos separados por coma)
            const productos = String(valores[4] || "").split(",").map(p => p.trim()); // valores[2] = col_AO

            for (const producto of productos) {
                if (producto) {
                    await connection.query(
                        "INSERT INTO productoxorden (idventa, sku) VALUES (?, ?)",
                        [ordenId, producto]
                    );
                }
            }
        }

        console.log("Datos insertados correctamente.");
        await connection.end();
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

// Obtener el archivo de los argumentos del script
const filePath = process.argv[2];

if (!filePath) {
    console.log("Debes especificar la ruta del archivo Excel.");
    process.exit(1);
}

importarExcel(filePath);