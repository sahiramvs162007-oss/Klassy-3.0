/**
 * controllers/usuarioControlador.js
 * CRUD de usuarios para Admin y Director.
 * Reglas de negocio aplicadas aquí, no en el modelo.
 */

const { Usuario } = require('../models');
const XLSX = require('xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// LISTAR  GET /usuarios
// ─────────────────────────────────────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
  try {
    const { rol: rolActual } = req.session.usuario;

    // Filtros opcionales desde query string
    const { buscar = '', filtroRol = '' } = req.query;

    const filtro = {};

    // Director no puede ver ni gestionar admins
    if (rolActual === 'director') {
      filtro.rol = { $ne: 'admin' };
    }

    // Filtro por rol seleccionado en la vista
    if (filtroRol && filtroRol !== '') {
      // Si es director y trata de filtrar admins, ignorar
      if (rolActual === 'director' && filtroRol === 'admin') {
        filtro.rol = { $ne: 'admin' };
      } else if (rolActual === 'director') {
        filtro.rol = filtroRol;
      } else {
        filtro.rol = filtroRol;
      }
    }

    // Búsqueda por nombre, apellido o correo
    if (buscar.trim() !== '') {
      const regex = new RegExp(buscar.trim(), 'i');
      filtro.$or = [
        { nombre:   regex },
        { apellido: regex },
        { correo:   regex },
      ];
    }

    const usuarios = await Usuario.find(filtro)
      .select('-contrasena')
      .sort({ apellido: 1, nombre: 1 });

    res.render('paginas/usuarios', {
      titulo:      'Gestión de Usuarios',
      paginaActual:'usuarios',
      usuarios,
      buscar,
      filtroRol,
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    req.flash('error', 'Error al cargar los usuarios.');
    res.redirect('/dashboard');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREAR  POST /usuarios
// ─────────────────────────────────────────────────────────────────────────────
const crearUsuario = async (req, res) => {
  try {
    const { rol: rolActual } = req.session.usuario;
    const {
      nombre, apellido, correo, contrasena,
      rol, profesion, ultimoNivelCursado, documentoIdentidad,
    } = req.body;

    // Regla: solo admin puede crear admins
    if (rol === 'admin' && rolActual !== 'admin') {
      req.flash('error', 'No tienes permiso para crear administradores.');
      return res.redirect('/usuarios');
    }

    // Verificar correo duplicado
    const existe = await Usuario.findOne({ correo: correo.toLowerCase().trim() });
    if (existe) {
      req.flash('error', `El correo ${correo} ya está registrado.`);
      return res.redirect('/usuarios');
    }

    // Para estudiantes: la contraseña es el documento de identidad (obligatorio)
    if (rol === 'estudiante' && !documentoIdentidad?.trim()) {
      req.flash('error', 'El documento de identidad es obligatorio para estudiantes, ya que se usa como contraseña.');
      return res.redirect('/usuarios');
    }

    const contrasenaFinal = (rol === 'estudiante')
      ? documentoIdentidad.trim()
      : contrasena;

    // Construir documento
    const nuevoUsuario = new Usuario({
      nombre:             nombre.trim(),
      apellido:           apellido.trim(),
      correo:             correo.toLowerCase().trim(),
      contrasena:         contrasenaFinal,
      rol,
      documentoIdentidad: documentoIdentidad ? documentoIdentidad.trim() : null,
      activo:             true,
    });

    // Campos según rol
    if (rol === 'docente' || rol === 'admin' || rol === 'director') {
      nuevoUsuario.profesion          = profesion ? profesion.trim() : null;
      nuevoUsuario.ultimoNivelCursado = 11; // por defecto para no-estudiantes
    }

    if (rol === 'estudiante') {
      nuevoUsuario.ultimoNivelCursado = ultimoNivelCursado
        ? parseInt(ultimoNivelCursado, 10)
        : 0;
      nuevoUsuario.profesion = null;
    }

    await nuevoUsuario.save();

    const mensajeExtra = (rol === 'estudiante')
      ? ` Su contraseña es su documento de identidad: ${documentoIdentidad.trim()}`
      : '';
    req.flash('exito', `Usuario ${nuevoUsuario.nombreCompleto} creado correctamente.${mensajeExtra}`);
    res.redirect('/usuarios');
  } catch (error) {
    console.error('Error al crear usuario:', error);
    req.flash('error', 'Error al crear el usuario. Verifica los datos.');
    res.redirect('/usuarios');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR  PUT /usuarios/:id
// ─────────────────────────────────────────────────────────────────────────────
const editarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol: rolActual } = req.session.usuario;
    const {
      nombre, apellido, correo, contrasena,
      rol: rolNuevo, profesion, ultimoNivelCursado, activo, documentoIdentidad,
    } = req.body;

    const usuario = await Usuario.findById(id).select('+contrasena');
    if (!usuario) {
      req.flash('error', 'Usuario no encontrado.');
      return res.redirect('/usuarios');
    }

    // Regla: director no puede editar admins
    if (usuario.rol === 'admin' && rolActual !== 'admin') {
      req.flash('error', 'No tienes permiso para editar administradores.');
      return res.redirect('/usuarios');
    }

    // Regla: solo admin puede asignar rol admin
    if (rolNuevo === 'admin' && rolActual !== 'admin') {
      req.flash('error', 'No tienes permiso para asignar el rol administrador.');
      return res.redirect('/usuarios');
    }

    const rolAnterior = usuario.rol;

    // Actualizar campos básicos
    usuario.nombre             = nombre.trim();
    usuario.apellido           = apellido.trim();
    usuario.correo             = correo.toLowerCase().trim();
    usuario.rol                = rolNuevo;
    usuario.activo             = activo === 'true' || activo === true;
    usuario.documentoIdentidad = documentoIdentidad ? documentoIdentidad.trim() : null;

    // Cambio de rol: ajustar campos específicos
    if (rolNuevo === 'estudiante') {
      // Si venía de docente/admin/director → limpiar profesión
      if (rolAnterior !== 'estudiante') {
        usuario.profesion = null;
      }
      usuario.ultimoNivelCursado = ultimoNivelCursado
        ? parseInt(ultimoNivelCursado, 10)
        : 0;
    } else {
      // Docente, director, admin: nivel 11 si viene de estudiante
      if (rolAnterior === 'estudiante') {
        usuario.ultimoNivelCursado = 11;
      }
      usuario.profesion = profesion ? profesion.trim() : null;
    }

    // Cambiar contraseña solo si se envió una nueva
    if (contrasena && contrasena.trim() !== '') {
      usuario.contrasena = contrasena.trim();
      // El pre-save hook de bcrypt re-hashea automáticamente
    }

    await usuario.save();

    req.flash('exito', `Usuario ${usuario.nombreCompleto} actualizado correctamente.`);
    res.redirect('/usuarios');
  } catch (error) {
    console.error('Error al editar usuario:', error);
    req.flash('error', 'Error al actualizar el usuario.');
    res.redirect('/usuarios');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ELIMINAR  DELETE /usuarios/:id
// ─────────────────────────────────────────────────────────────────────────────
const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol: rolActual, _id: idActual } = req.session.usuario;

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      req.flash('error', 'Usuario no encontrado.');
      return res.redirect('/usuarios');
    }

    // Regla: director no puede eliminar admins
    if (usuario.rol === 'admin' && rolActual !== 'admin') {
      req.flash('error', 'No tienes permiso para eliminar administradores.');
      return res.redirect('/usuarios');
    }

    // Regla: no puede auto-eliminarse
    if (id === idActual.toString()) {
      req.flash('error', 'No puedes eliminar tu propia cuenta.');
      return res.redirect('/usuarios');
    }

    const nombre = usuario.nombreCompleto;
    await Usuario.findByIdAndDelete(id);

    req.flash('exito', `Usuario ${nombre} eliminado correctamente.`);
    res.redirect('/usuarios');
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    req.flash('error', 'Error al eliminar el usuario.');
    res.redirect('/usuarios');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// OBTENER UNO  GET /usuarios/:id/datos  (para cargar el drawer de edición)
// ─────────────────────────────────────────────────────────────────────────────
const obtenerUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id).select('-contrasena');
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTAR DESDE EXCEL  POST /usuarios/importar
// ─────────────────────────────────────────────────────────────────────────────
const importarUsuariosExcel = async (req, res) => {
  try {
    const { rol: rolActual } = req.session.usuario;

    if (!req.file) {
      req.flash('error', 'No se recibió ningún archivo Excel.');
      return res.redirect('/usuarios');
    }

    // Leer el workbook desde el buffer en memoria
    const workbook  = XLSX.read(req.file.buffer, { type: 'buffer' });
    const hoja      = workbook.Sheets[workbook.SheetNames[0]];
    const filas     = XLSX.utils.sheet_to_json(hoja, { defval: '' });

    if (!filas.length) {
      req.flash('error', 'El archivo Excel está vacío o no tiene datos.');
      return res.redirect('/usuarios');
    }

    // Columnas esperadas (insensible a mayúsculas y espacios)
    // nombre | apellido | correo | rol | documentoIdentidad | profesion | ultimoNivelCursado
    const rolesValidos = ['admin', 'director', 'docente', 'estudiante'];

    let creados   = 0;
    let omitidos  = 0;
    const errores = [];

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      const fNum = i + 2; // número de fila real en Excel (encabezado = 1)

      // Normalizar claves (quitar espacios y pasar a minúscula)
      const f = {};
      for (const key of Object.keys(fila)) {
        f[key.trim().toLowerCase()] = String(fila[key]).trim();
      }

      const nombre              = f['nombre']               || '';
      const apellido            = f['apellido']             || '';
      const correo              = f['correo']               || '';
      const rol                 = (f['rol']                 || '').toLowerCase();
      const documentoIdentidad  = f['documentoidentidad']   || f['documento_identidad'] || f['documento'] || null;
      const profesion           = f['profesion']            || f['profesión'] || null;
      const ultimoNivelCursado  = f['ultimonivelcursado']   || f['ultimo_nivel_cursado'] || f['nivel'] || '0';

      // Validaciones básicas por fila
      if (!nombre || !apellido || !correo) {
        errores.push(`Fila ${fNum}: faltan nombre, apellido o correo.`);
        omitidos++;
        continue;
      }
      if (!rolesValidos.includes(rol)) {
        errores.push(`Fila ${fNum}: rol "${rol}" no válido. Use: admin, director, docente, estudiante.`);
        omitidos++;
        continue;
      }
      if (rol === 'admin' && rolActual !== 'admin') {
        errores.push(`Fila ${fNum}: sin permiso para crear administradores.`);
        omitidos++;
        continue;
      }

      // Verificar correo duplicado
      const existe = await Usuario.findOne({ correo: correo.toLowerCase() });
      if (existe) {
        errores.push(`Fila ${fNum}: el correo "${correo}" ya está registrado.`);
        omitidos++;
        continue;
      }

      // Validar que estudiantes tengan documento
      if (rol === 'estudiante' && !documentoIdentidad) {
        errores.push(`Fila ${fNum}: el documento de identidad es obligatorio para estudiantes (se usa como contraseña).`);
        omitidos++;
        continue;
      }

      // Contraseña: estudiantes → documento de identidad; otros → documento o "klassy" + nº fila
      const contrasenaFinal = rol === 'estudiante'
        ? documentoIdentidad
        : (documentoIdentidad || `klassy${fNum}`);

      const nuevoUsuario = new Usuario({
        nombre:             nombre,
        apellido:           apellido,
        correo:             correo.toLowerCase(),
        contrasena:         contrasenaFinal,
        rol,
        documentoIdentidad: documentoIdentidad || null,
        activo:             true,
      });

      if (rol === 'estudiante') {
        nuevoUsuario.ultimoNivelCursado = parseInt(ultimoNivelCursado, 10) || 0;
        nuevoUsuario.profesion          = null;
      } else {
        nuevoUsuario.profesion          = profesion || null;
        nuevoUsuario.ultimoNivelCursado = 11;
      }

      await nuevoUsuario.save();
      creados++;
    }

    let mensaje = `Importación completada: ${creados} usuario(s) creado(s).`;
    if (omitidos > 0) mensaje += ` ${omitidos} fila(s) omitida(s).`;
    if (errores.length) {
      req.flash('error', errores.slice(0, 5).join(' | ') + (errores.length > 5 ? ` ... y ${errores.length - 5} más.` : ''));
    }
    req.flash('exito', mensaje);
    res.redirect('/usuarios');

  } catch (error) {
    console.error('Error al importar usuarios desde Excel:', error);
    req.flash('error', 'Error al procesar el archivo Excel.');
    res.redirect('/usuarios');
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  obtenerUsuario,
  importarUsuariosExcel,
};
