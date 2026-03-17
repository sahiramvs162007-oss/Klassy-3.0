# KLASSY — Gestor Académico

Sistema de gestión académica para colegios de primaria y secundaria.

## Requisitos

- Node.js 18+
- MongoDB corriendo en localhost:27017
- npm

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo de entorno
cp .env.example .env
# Edita .env con tus datos si es necesario

# 3. Iniciar en modo desarrollo
npm run dev

# 4. Abrir en el navegador
# http://localhost:3000
```

## Estructura del proyecto

```
klassy/
├── config/          # Configuración (base de datos, etc.)
├── controllers/     # Lógica de negocio por módulo
├── middlewares/     # Middlewares de Express
├── models/          # Esquemas de Mongoose
├── public/          # Archivos estáticos
│   ├── css/         # Hojas de estilo
│   ├── js/          # Scripts del cliente
│   └── uploads/     # Archivos subidos por usuarios
├── routes/          # Definición de rutas
├── views/           # Plantillas EJS
│   ├── layouts/     # Layouts base
│   ├── partials/    # Componentes reutilizables
│   └── paginas/     # Vistas de cada módulo
├── .env.example     # Variables de entorno (plantilla)
├── app.js           # Entrada del servidor
└── package.json
```

## Sprints

| Sprint | Módulo                   | Estado     |
|--------|--------------------------|------------|
| 1      | Base del sistema         | ✅ Listo   |
| 2      | Diseño de base de datos  | ⏳ Pendiente |
| 3      | Gestión de usuarios      | ⏳ Pendiente |
| 4      | Grados y materias        | ⏳ Pendiente |
| 5      | Periodos académicos      | ⏳ Pendiente |
| 6      | Matrículas               | ⏳ Pendiente |
| 7      | Asignación de docentes   | ⏳ Pendiente |
| 8      | Autenticación            | ⏳ Pendiente |
| 9      | Actividades              | ⏳ Pendiente |
| 10     | Notas                    | ⏳ Pendiente |
| 11     | Boletines                | ⏳ Pendiente |
| 12     | Dashboard y noticias     | ⏳ Pendiente |
| 13     | Analítica académica      | ⏳ Pendiente |
=======
# Klassy-3.0
desarrollo del proyecto alfa klassy v3.0
>>>>>>> 58c6bc8c0635d7fe6e03f70b93e3af1cf814baf5
