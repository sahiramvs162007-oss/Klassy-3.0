/**
 * public/js/usuarios.js
 * Lógica del cliente para la gestión de usuarios.
 * Maneja el drawer de creación y edición.
 */

// ─── Abrir drawer para CREAR ──────────────────────────────────────────────────
function abrirDrawerCrear() {
  const cuerpo = construirFormulario();

  // Configurar como formulario de creación
  cuerpo.querySelector('#metodoPeticion').value = '';
  cuerpo.querySelector('#labelContrasena').textContent = '*';
  cuerpo.querySelector('#campoContrasena').required   = true;
  cuerpo.querySelector('#formUsuario').action          = '/usuarios';
  cuerpo.querySelector('#textoGuardar').textContent    = 'Crear usuario';

  document.getElementById('drawerTitulo').textContent = 'Nuevo usuario';
  document.getElementById('drawerCuerpo').innerHTML   = '';
  document.getElementById('drawerCuerpo').appendChild(cuerpo);

  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';

  lucide.createIcons();
}

// ─── Abrir drawer para EDITAR ─────────────────────────────────────────────────
async function abrirDrawerEditar(idUsuario) {
  document.getElementById('drawerTitulo').textContent = 'Cargando...';
  document.getElementById('drawer').classList.add('drawer--abierto');
  document.getElementById('drawerOverlay').classList.add('drawer-overlay--visible');
  document.body.style.overflow = 'hidden';

  try {
    const respuesta = await fetch(`/usuarios/${idUsuario}/datos`);
    if (!respuesta.ok) throw new Error('No se pudo obtener el usuario');
    const usuario = await respuesta.json();

    const cuerpo = construirFormulario();

    // Configurar como formulario de edición
    cuerpo.querySelector('#formUsuario').action       = `/usuarios/${idUsuario}?_method=PUT`;
    cuerpo.querySelector('#metodoPeticion').value     = 'PUT';
    cuerpo.querySelector('#idUsuario').value          = idUsuario;
    cuerpo.querySelector('#campoNombre').value        = usuario.nombre || '';
    cuerpo.querySelector('#campoApellido').value      = usuario.apellido || '';
    cuerpo.querySelector('#campoCorreo').value        = usuario.correo || '';
    cuerpo.querySelector('#campoDocumentoIdentidad').value = usuario.documentoIdentidad || '';
    cuerpo.querySelector('#campoContrasena').required = false;
    cuerpo.querySelector('#campoActivo').value        = usuario.activo ? 'true' : 'false';
    cuerpo.querySelector('#textoGuardar').textContent = 'Guardar cambios';

    // Asignar rol y disparar actualización de campos específicos
    const selectRol = cuerpo.querySelector('#campoRol');
    selectRol.value = usuario.rol;

    document.getElementById('drawerTitulo').textContent = `Editar: ${usuario.nombre} ${usuario.apellido}`;
    document.getElementById('drawerCuerpo').innerHTML   = '';
    document.getElementById('drawerCuerpo').appendChild(cuerpo);

    // Mostrar campos según rol y llenar valores
    actualizarCamposRol();

    if (usuario.rol === 'docente' || usuario.rol === 'admin' || usuario.rol === 'director') {
      document.getElementById('campoProfesion').value = usuario.profesion || '';
    }
    if (usuario.rol === 'estudiante') {
      document.getElementById('campoNivel').value = usuario.ultimoNivelCursado ?? 0;
    }

    lucide.createIcons();

  } catch (error) {
    console.error('Error al cargar usuario:', error);
    document.getElementById('drawerCuerpo').innerHTML =
      '<p class="texto-error">Error al cargar los datos del usuario.</p>';
    document.getElementById('drawerTitulo').textContent = 'Error';
  }
}

// ─── Construir formulario desde el template ───────────────────────────────────
function construirFormulario() {
  const template = document.getElementById('templateFormUsuario');
  const fragmento = template.content.cloneNode(true);
  const contenedor = document.createElement('div');
  contenedor.appendChild(fragmento);
  return contenedor;
}

// ─── Mostrar/ocultar campos según rol seleccionado ────────────────────────────
function actualizarCamposRol() {
  const rolSeleccionado       = document.getElementById('campoRol')?.value;
  const grupoProfesion        = document.getElementById('grupoProfesion');
  const grupoNivel            = document.getElementById('grupoNivel');
  const campoContrasena       = document.getElementById('campoContrasena');
  const ayudaEstudiante       = document.getElementById('ayudaContrasenaEstudiante');
  const labelContrasena       = document.getElementById('labelContrasena');
  const campoDocumento        = document.getElementById('campoDocumentoIdentidad');
  const ayudaDocumento        = document.getElementById('ayudaDocumentoEstudiante');
  const labelDocumento        = document.getElementById('labelDocumento');
  const esCreacion            = document.getElementById('metodoPeticion')?.value === '';

  if (!grupoProfesion || !grupoNivel) return;

  if (rolSeleccionado === 'docente' || rolSeleccionado === 'admin' || rolSeleccionado === 'director') {
    grupoProfesion.style.display = 'flex';
    grupoNivel.style.display     = 'none';
    // Contraseña normal
    if (campoContrasena) {
      campoContrasena.style.display = '';
      campoContrasena.placeholder   = 'Mínimo 6 caracteres';
      campoContrasena.required      = esCreacion;
    }
    if (ayudaEstudiante) ayudaEstudiante.style.display = 'none';
    if (labelContrasena) labelContrasena.textContent   = esCreacion ? '*' : '(dejar vacío para no cambiar)';
    // Documento opcional
    if (campoDocumento) campoDocumento.required = false;
    if (ayudaDocumento) ayudaDocumento.style.display = 'none';
    if (labelDocumento) labelDocumento.textContent    = '';

  } else if (rolSeleccionado === 'estudiante') {
    grupoProfesion.style.display = 'none';
    grupoNivel.style.display     = 'flex';
    // Ocultar contraseña — se usa el documento
    if (campoContrasena) {
      campoContrasena.style.display = 'none';
      campoContrasena.required      = false;
      campoContrasena.value         = '';
    }
    if (ayudaEstudiante) ayudaEstudiante.style.display = 'flex';
    if (labelContrasena) labelContrasena.textContent   = '(se usará el documento de identidad)';
    // Documento obligatorio para estudiantes
    if (campoDocumento) campoDocumento.required = esCreacion;
    if (ayudaDocumento) ayudaDocumento.style.display = esCreacion ? 'flex' : 'none';
    if (labelDocumento) labelDocumento.textContent    = esCreacion ? '*' : '';

  } else {
    // Sin rol
    grupoProfesion.style.display = 'none';
    grupoNivel.style.display     = 'none';
    if (campoContrasena) {
      campoContrasena.style.display = '';
      campoContrasena.required      = esCreacion;
    }
    if (ayudaEstudiante) ayudaEstudiante.style.display = 'none';
    if (campoDocumento) campoDocumento.required = false;
    if (ayudaDocumento) ayudaDocumento.style.display = 'none';
    if (labelDocumento) labelDocumento.textContent    = '';
  }
}

// ─── Confirmación de eliminación ─────────────────────────────────────────────
function confirmarEliminar(nombreUsuario) {
  return confirm(`¿Estás seguro de que deseas eliminar a "${nombreUsuario}"?\nEsta acción no se puede deshacer.`);
}

// ─── Paginación ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  iniciarPaginacion('tbodyUsuarios', { filasPorPagina: 10 });
});