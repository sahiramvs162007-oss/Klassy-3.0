/**
 * seedUsuarios.js
 * Ejecutar desde la raíz del proyecto:
 *   node seedUsuarios.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const Usuario  = require('./models/Usuario'); // ajusta si la ruta es diferente

// ─── Datos ────────────────────────────────────────────────────────────────────

const admin = {
  nombre:    'Carlos',
  apellido:  'Ramírez',
  correo:    'admin@klassy.edu.co',
  contrasena: 'admin123',
  rol:       'admin',
  activo:    true,
};

const director = {
  nombre:    'Lucía',
  apellido:  'Fernández',
  correo:    'director@klassy.edu.co',
  contrasena: 'director123',
  rol:       'director',
  activo:    true,
};

const docentes = [
  { nombre: 'Andrés',    apellido: 'Mora',       correo: 'a.mora@klassy.edu.co',      profesion: 'Licenciado en Matemáticas' },
  { nombre: 'Patricia',  apellido: 'Suárez',     correo: 'p.suarez@klassy.edu.co',    profesion: 'Licenciada en Español y Literatura' },
  { nombre: 'Ricardo',   apellido: 'Peña',       correo: 'r.pena@klassy.edu.co',      profesion: 'Licenciado en Ciencias Naturales' },
  { nombre: 'Marcela',   apellido: 'Torres',     correo: 'm.torres@klassy.edu.co',    profesion: 'Licenciada en Ciencias Sociales' },
  { nombre: 'Hernando',  apellido: 'Castro',     correo: 'h.castro@klassy.edu.co',    profesion: 'Licenciado en Inglés' },
  { nombre: 'Diana',     apellido: 'Ospina',     correo: 'd.ospina@klassy.edu.co',    profesion: 'Licenciada en Educación Física' },
  { nombre: 'Jorge',     apellido: 'Salcedo',    correo: 'j.salcedo@klassy.edu.co',   profesion: 'Licenciado en Ética y Filosofía' },
  { nombre: 'Natalia',   apellido: 'Vargas',     correo: 'n.vargas@klassy.edu.co',    profesion: 'Licenciada en Artes' },
  { nombre: 'Fabián',    apellido: 'Ríos',       correo: 'f.rios@klassy.edu.co',      profesion: 'Ingeniero de Sistemas — Tecnología e Informática' },
  { nombre: 'Claudia',   apellido: 'Mendoza',    correo: 'c.mendoza@klassy.edu.co',   profesion: 'Licenciada en Química y Física' },
].map(d => ({ ...d, contrasena: 'docente123', rol: 'docente', activo: true }));

const estudiantes = [
  { nombre: 'Sofía',      apellido: 'Herrera',    correo: 'sofia.herrera@klassy.edu.co',    ultimoNivelCursado: 0  },
  { nombre: 'Miguel',     apellido: 'López',      correo: 'miguel.lopez@klassy.edu.co',     ultimoNivelCursado: 0  },
  { nombre: 'Valentina',  apellido: 'García',     correo: 'valentina.garcia@klassy.edu.co', ultimoNivelCursado: 1  },
  { nombre: 'Sebastián',  apellido: 'Martínez',   correo: 'sebastian.martinez@klassy.edu.co', ultimoNivelCursado: 1 },
  { nombre: 'Isabella',   apellido: 'Rodríguez',  correo: 'isabella.rodriguez@klassy.edu.co', ultimoNivelCursado: 2 },
  { nombre: 'Samuel',     apellido: 'González',   correo: 'samuel.gonzalez@klassy.edu.co',  ultimoNivelCursado: 2  },
  { nombre: 'Mariana',    apellido: 'Díaz',       correo: 'mariana.diaz@klassy.edu.co',     ultimoNivelCursado: 3  },
  { nombre: 'Daniel',     apellido: 'Ruiz',       correo: 'daniel.ruiz@klassy.edu.co',      ultimoNivelCursado: 3  },
  { nombre: 'Luciana',    apellido: 'Jiménez',    correo: 'luciana.jimenez@klassy.edu.co',  ultimoNivelCursado: 4  },
  { nombre: 'Mateo',      apellido: 'Vargas',     correo: 'mateo.vargas@klassy.edu.co',     ultimoNivelCursado: 4  },
  { nombre: 'Camila',     apellido: 'Sánchez',    correo: 'camila.sanchez@klassy.edu.co',   ultimoNivelCursado: 5  },
  { nombre: 'Nicolás',    apellido: 'Reyes',      correo: 'nicolas.reyes@klassy.edu.co',    ultimoNivelCursado: 5  },
  { nombre: 'Paula',      apellido: 'Morales',    correo: 'paula.morales@klassy.edu.co',    ultimoNivelCursado: 6  },
  { nombre: 'Alejandro',  apellido: 'Torres',     correo: 'alejandro.torres@klassy.edu.co', ultimoNivelCursado: 6 },
  { nombre: 'Laura',      apellido: 'Flores',     correo: 'laura.flores@klassy.edu.co',     ultimoNivelCursado: 7  },
  { nombre: 'Julián',     apellido: 'Castro',     correo: 'julian.castro@klassy.edu.co',    ultimoNivelCursado: 7  },
  { nombre: 'Gabriela',   apellido: 'Romero',     correo: 'gabriela.romero@klassy.edu.co',  ultimoNivelCursado: 8  },
  { nombre: 'Andrés',     apellido: 'Ortega',     correo: 'andres.ortega@klassy.edu.co',    ultimoNivelCursado: 8  },
  { nombre: 'Natalia',    apellido: 'Medina',     correo: 'natalia.medina@klassy.edu.co',   ultimoNivelCursado: 9  },
  { nombre: 'Felipe',     apellido: 'Aguilar',    correo: 'felipe.aguilar@klassy.edu.co',   ultimoNivelCursado: 9  },
  { nombre: 'Daniela',    apellido: 'Peña',       correo: 'daniela.pena@klassy.edu.co',     ultimoNivelCursado: 10 },
  { nombre: 'Tomás',      apellido: 'Ríos',       correo: 'tomas.rios@klassy.edu.co',       ultimoNivelCursado: 10 },
  { nombre: 'Sara',       apellido: 'Mendoza',    correo: 'sara.mendoza@klassy.edu.co',     ultimoNivelCursado: 11 },
  { nombre: 'Diego',      apellido: 'Suárez',     correo: 'diego.suarez@klassy.edu.co',     ultimoNivelCursado: 11 },
  { nombre: 'Valeria',    apellido: 'Mora',       correo: 'valeria.mora@klassy.edu.co',     ultimoNivelCursado: 1  },
  { nombre: 'Esteban',    apellido: 'Guerrero',   correo: 'esteban.guerrero@klassy.edu.co', ultimoNivelCursado: 2  },
  { nombre: 'María José', apellido: 'Salazar',    correo: 'mariajose.salazar@klassy.edu.co', ultimoNivelCursado: 3 },
  { nombre: 'Juan Pablo', apellido: 'Nieto',      correo: 'juanpablo.nieto@klassy.edu.co',  ultimoNivelCursado: 4 },
  { nombre: 'Manuela',    apellido: 'Parra',      correo: 'manuela.parra@klassy.edu.co',    ultimoNivelCursado: 5  },
  { nombre: 'Simón',      apellido: 'Estrada',    correo: 'simon.estrada@klassy.edu.co',    ultimoNivelCursado: 6  },
  { nombre: 'Catalina',   apellido: 'Orozco',     correo: 'catalina.orozco@klassy.edu.co',  ultimoNivelCursado: 7  },
  { nombre: 'Jerónimo',   apellido: 'Cárdenas',   correo: 'jeronimo.cardenas@klassy.edu.co', ultimoNivelCursado: 8 },
  { nombre: 'Ángela',     apellido: 'Quintero',   correo: 'angela.quintero@klassy.edu.co',  ultimoNivelCursado: 9  },
  { nombre: 'Rodrigo',    apellido: 'Bermúdez',   correo: 'rodrigo.bermudez@klassy.edu.co', ultimoNivelCursado: 10 },
  { nombre: 'Nathalia',   apellido: 'Castaño',    correo: 'nathalia.castano@klassy.edu.co', ultimoNivelCursado: 3  },
  { nombre: 'Iván',       apellido: 'Osorio',     correo: 'ivan.osorio@klassy.edu.co',      ultimoNivelCursado: 5  },
  { nombre: 'Paola',      apellido: 'Arbeláez',   correo: 'paola.arbelaez@klassy.edu.co',   ultimoNivelCursado: 7  },
  { nombre: 'Cristian',   apellido: 'Velásquez',  correo: 'cristian.velasquez@klassy.edu.co', ultimoNivelCursado: 9 },
  { nombre: 'Lina',       apellido: 'Pinzón',     correo: 'lina.pinzon@klassy.edu.co',      ultimoNivelCursado: 2  },
  { nombre: 'Gustavo',    apellido: 'Sarmiento',  correo: 'gustavo.sarmiento@klassy.edu.co', ultimoNivelCursado: 6 },
].map(e => ({ ...e, contrasena: 'estudiante123', rol: 'estudiante', activo: true }));

// ─── Función principal ────────────────────────────────────────────────────────

const ejecutar = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB\n');

    const todos = [admin, director, ...docentes, ...estudiantes];
    let creados = 0;
    let omitidos = 0;

    for (const datos of todos) {
      const existe = await Usuario.findOne({ correo: datos.correo });
      if (existe) {
        console.log(`⚠️  Ya existe: ${datos.correo}`);
        omitidos++;
        continue;
      }

      // Hash manual porque insertMany no dispara el pre('save')
      const hash = await bcrypt.hash(datos.contrasena, 10);
      await Usuario.create({ ...datos, contrasena: hash });
      console.log(`➕ Creado [${datos.rol.padEnd(10)}] ${datos.nombre} ${datos.apellido}`);
      creados++;
    }

    console.log(`\n📊 Resultado: ${creados} creados, ${omitidos} omitidos.`);
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Admin:      admin@klassy.edu.co       / admin123');
    console.log('   Director:   director@klassy.edu.co    / director123');
    console.log('   Docentes:   [correo]@klassy.edu.co    / docente123');
    console.log('   Estudiantes:[correo]@klassy.edu.co    / estudiante123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

ejecutar();
//admin@klassy.edu.co / admin123
//director@klassy.edu.co / 123456
//felipe.aguilar@klassy.edu.co / 123456
//h.castro@klassy.edu.co / 123456