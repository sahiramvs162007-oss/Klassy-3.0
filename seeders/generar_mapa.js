/**
 * seeders/generar_mapa.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lee el Excel de usuarios (KLASSY_Usuarios_v2.xlsx) y cruza el correo
 * con los usuarios en MongoDB para generar mapa_usuarios.json.
 *
 * El JSON resultante contiene por cada estudiante:
 *   { correo, perfil, cohorte, nivelInicial, grupo, estudianteId }
 *
 * Todos los seeders de matrículas y notas leen este archivo.
 * Solo se corre UNA VEZ después de importar el Excel.
 *
 * REQUISITOS PREVIOS:
 *   npm install xlsx   (si no lo tienes)
 *   Excel importado en MongoDB.
 *
 * Uso:
 *   node seeders/generar_mapa.js [ruta-al-excel]
 *
 *   Ejemplo:
 *   node seeders/generar_mapa.js ./KLASSY_Usuarios_v2.xlsx
 *
 *   Si no se pasa ruta, busca ./KLASSY_Usuarios_v2.xlsx en la raíz del proyecto.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const mongoose = require('mongoose');
const XLSX     = require('xlsx');
const fs       = require('fs');
const path     = require('path');
const { Usuario } = require('../models');

const MONGO_URI   = process.env.MONGO_URI || 'mongodb://localhost:27017/klassy';
const EXCEL_PATH  = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../KLASSY_Usuarios_v2.xlsx');
const OUTPUT_PATH = path.resolve(__dirname, 'mapa_usuarios.json');

const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠  ${msg}`);
const sep  = (t)   => console.log(`\n── ${t} ${'─'.repeat(Math.max(2, 52 - t.length))}`);

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           KLASSY — generar_mapa.js                    ║');
  console.log('║  Lee el Excel y genera mapa_usuarios.json             ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // ── 1. Verificar que el Excel existe ───────────────────────────────────────
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`\n❌ No se encontró el Excel en: ${EXCEL_PATH}`);
    console.error('   Pasa la ruta como argumento:');
    console.error('   node seeders/generar_mapa.js ./ruta/al/KLASSY_Usuarios_v2.xlsx\n');
    process.exit(1);
  }
  log(`Excel encontrado: ${EXCEL_PATH}`);

  // ── 2. Leer Excel ──────────────────────────────────────────────────────────
  sep('LEYENDO EXCEL');
  const wb    = XLSX.readFile(EXCEL_PATH);
  const ws    = wb.Sheets['Usuarios'];
  if (!ws) {
    console.error('❌ No se encontró la hoja "Usuarios" en el Excel.');
    process.exit(1);
  }

  // raw:false para que los números no sean strings
  const filas = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
  log(`Filas leídas del Excel: ${filas.length}`);

  // Filtrar solo estudiantes con cohorte definida
  const estudiantesExcel = filas.filter(f =>
    f.rol === 'estudiante' && f.cohorte && f.ultimoNivelCursado && f.grupo
  );
  log(`Estudiantes en Excel: ${estudiantesExcel.length}`);

  // ── 3. Conectar a MongoDB ──────────────────────────────────────────────────
  sep('CONECTANDO A MONGODB');
  await mongoose.connect(MONGO_URI);
  log('Conexión establecida');

  // ── 4. Cargar todos los estudiantes de la BD ───────────────────────────────
  sep('CRUZANDO CON MONGODB');
  const estudiantesDB = await Usuario.find({ rol: 'estudiante' })
    .select('_id correo nombre apellido')
    .lean();
  log(`Estudiantes en BD: ${estudiantesDB.length}`);

  // Map: correo → _id
  const correoMap = {};
  for (const e of estudiantesDB) {
    correoMap[e.correo.toLowerCase().trim()] = e._id;
  }

  // ── 5. Cruzar Excel con BD ─────────────────────────────────────────────────
  const mapa      = [];
  let   noEncontrados = 0;

  for (const fila of estudiantesExcel) {
    const correo = (fila.correo || '').toLowerCase().trim();
    const id     = correoMap[correo];

    if (!id) {
      warn(`No encontrado en BD: ${correo}`);
      noEncontrados++;
      continue;
    }

    mapa.push({
      estudianteId:  id.toString(),
      correo,
      nombre:        fila.nombre        || '',
      apellido:      fila.apellido      || '',
      nivelInicial:  parseInt(fila.ultimoNivelCursado, 10),
      grupo:         (fila.grupo        || 'A').toString().trim().toUpperCase(),
      cohorte:       parseInt(fila.cohorte, 10),
      perfil:        (fila.perfil       || 'promedio').toString().trim().toLowerCase(),
    });
  }

  log(`Estudiantes mapeados: ${mapa.length}`);
  if (noEncontrados > 0) {
    warn(`${noEncontrados} estudiantes del Excel no se encontraron en BD`);
    warn('Verifica que el Excel fue importado correctamente');
  }

  // ── 6. Estadísticas del mapa ───────────────────────────────────────────────
  sep('ESTADÍSTICAS');
  const porCohorte = { 2024: 0, 2025: 0, 2026: 0 };
  const porPerfil  = { reprobador: 0, promedio: 0, bueno: 0 };
  const porNivel   = {};

  for (const e of mapa) {
    porCohorte[e.cohorte] = (porCohorte[e.cohorte] || 0) + 1;
    porPerfil[e.perfil]   = (porPerfil[e.perfil]   || 0) + 1;
    porNivel[e.nivelInicial] = (porNivel[e.nivelInicial] || 0) + 1;
  }

  log(`Cohorte 2024: ${porCohorte[2024]} estudiantes`);
  log(`Cohorte 2025: ${porCohorte[2025]} estudiantes (nuevos grado 1° en 2025)`);
  log(`Cohorte 2026: ${porCohorte[2026]} estudiantes (nuevos grado 1° en 2026)`);
  log(`Perfiles → reprobador: ${porPerfil.reprobador} | promedio: ${porPerfil.promedio} | bueno: ${porPerfil.bueno}`);

  const nivelesOrdenados = Object.keys(porNivel).sort((a, b) => +a - +b);
  log(`Distribución por nivel: ${nivelesOrdenados.map(n => `${n}°: ${porNivel[n]}`).join(' | ')}`);

  // ── 7. Guardar JSON ────────────────────────────────────────────────────────
  sep('GUARDANDO mapa_usuarios.json');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(mapa, null, 2), 'utf8');
  log(`Guardado en: ${OUTPUT_PATH}`);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  generar_mapa.js completado ✓                         ║');
  console.log(`║  ${String(mapa.length + ' estudiantes mapeados').padEnd(52)}║`);
  console.log('║                                                        ║');
  console.log('║  Siguiente paso:                                       ║');
  console.log('║    node seeders/seed_matriculas_2024.js                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error en generar_mapa.js:', err.message);
  console.error(err.stack);
  mongoose.disconnect().finally(() => process.exit(1));
});
