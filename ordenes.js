const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
require('dotenv').config();
const { exec } = require('child_process');

var mensaje;

function convertirFecha(excelDate) {
    if (!excelDate) {
        mensaje = "❌ Error: No se encontró la fecha en B1.";
        return
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
      
        // Leer el archivo Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convertir la hoja a un array de arrays y omitir las primeras 2 filas
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(3);

        // Columnas deseadas y sus índices
        const columnasDeseadas = ["A", "F", "I", "AQ", "AU", "AO"];
        const indices = columnasDeseadas.map(col => XLSX.utils.decode_col(col));
        
        var fecha;

        // Preparar datos para insertar en MySQL
        for (const fila of jsonData) {
            const valores = indices.map((i, idx) => {
                if (idx === 0) return convertirFecha(fila[i]); // Convertir fecha en la columna F
                return fila[i] || null;
            });

            if (valores[0]){
            // Insertar en la tabla "ordenes"
                const [ordenResult] = await connection.query(
                    "INSERT INTO orden (idreporte, fechaCierre, apodoVendedor, subtotalArticulos, recibidoNeto) VALUES (?, ?, ?, ?, ?)",
                    valores
                );
            
                const ordenId = ordenResult.insertId; // Obtener ID de la orden insertada

            // Manejar la columna AO (productos separados por coma)
            const productos = String(valores[5] || "").split(",").map(p => p.trim()); // valores[2] = col_AO

                for (const producto of productos) {
                    if (producto) {
                        console.log(producto)
                        await connection.query(
                            "INSERT INTO productoxorden (idorden, sku) VALUES (?, ?)",
                            [ordenId, producto]
                        );
                    }
                 /*   else{
                        console.log(producto)
                        await connection.query(
                            "INSERT INTO productoxorden (idorden, sku) VALUES (?, ?)",
                            [ordenId, 0]
                        );
                    }*/
                }
            }
            fecha = valores[0];
        }

        console.log("Ordenes insertadas correctamente al ",fecha);
        mensaje = "Ordenes insertadas correctamente al " + String(fecha);
        await connection.end();
    } catch (error) {
        console.log("Error: "+ error.message);
        mensaje = error.message;
        process.exit(1);
    }

    exec(`node ${process.env.DIR_PROCCESS}/calculodiarioordenes.js ${fecha}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`❌ Error al ejecutar el script: ${error.message}`);
            return;
        }
    
        if (stderr) {
            console.error(`⚠️ STDERR: ${stderr}`);
            return;
        }
    
        console.log(`📤 Resultado del script:\n${stdout}`);
    });

    exec(`node ${process.env.DIR_PROCCESS}/enviarmensaje.js "${mensaje}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error al ejecutar script Twilio: ${error.message}`);
          return;
        }
        console.log(`Salida de Twilio:\n${stdout}`);
      });

}

// Obtener el archivo de los argumentos del script
const filePath = process.argv[2];

if (!filePath) {
    console.log("Debes especificar la ruta del archivo Excel.");
    process.exit(1);
}

importarExcel(filePath);