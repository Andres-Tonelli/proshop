const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();

function convertirFecha(fecha) {
    if (!fecha) return null;

    if (typeof fecha === 'number') {
        const parsedDate = XLSX.SSF.parse_date_code(fecha);
        return `${parsedDate.y}-${String(parsedDate.m).padStart(2, '0')}-${String(parsedDate.d).padStart(2, '0')}`;
    }

    if (typeof fecha === 'string' && fecha.includes('/')) {
        const partes = fecha.split('/');
        if (partes.length === 3) {
            let [dia, mes, año] = partes;
            if (año.length === 2) año = `20${año}`;
            return `${año}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        }
    }

    return null;
}

async function importarNuevoExcel(filePath) {
    try {
        // Conectar a MySQL
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log("Conectado a MySQL.");

        // Leer el archivo Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Obtener la fecha de la celda B1
        const fechaB1 = sheet["B1"] ? convertirFecha(sheet["B1"].v) : null;

        // Convertir la hoja a JSON y omitir la primera fila si es cabecera
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(3);

        // Columnas a extraer: A, C, D, K, P
        const columnasDeseadas = ["A", "C","D", "E", "F", "K", "P"];
        const indices = columnasDeseadas.map(col => XLSX.utils.decode_col(col));

        // Insertar datos en MySQL
        for (const fila of jsonData.slice(1)) { // Omitir la primera fila si es cabecera
            const valores = indices.map(i => fila[i] ?? null);

            await connection.query(
                "INSERT INTO venta (sku, nombre,skuVariante, stock, stockDisponible, vendidos,precioPromedio, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [...valores, fechaB1]
            );
        }

        console.log("Datos insertados correctamente.");
        await connection.end();
    } catch (error) {
        console.error("Error:", error.message);
    }
}

// Obtener archivo desde argumentos del script
const filePath = process.argv[2];

if (!filePath) {
    console.log("Debes especificar la ruta del archivo Excel.");
    process.exit(1);
}

importarNuevoExcel(filePath);