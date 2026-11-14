# Control de Tarea

Aplicación web para organizar tareas escolares, entregas y calificaciones. Está preparada para Vite, Vercel y Supabase.

## Estructura

- `index.html`: panel principal y acceso.
- `crear.html`: formulario de publicación para profesores.
- `editar.html`: edición de actividades.
- `src/main.js`: interfaz y eventos.
- `src/api.js`: operaciones de autenticación y datos.
- `src/config.js`: configuración pública de Supabase.
- `public/css/`: estilos responsive.
- `public/img/`: logo.
- `supabase/schema.sql`: tablas, trigger y políticas RLS.
- `supabase/habilitar-profesor.sql`: promoción controlada de una cuenta a profesor.

## Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Para comprobar el paquete de producción:

```bash
npm run build
npm run preview
```

## Supabase

1. Abrí el proyecto de Supabase y entrá a **SQL Editor**.
2. Ejecutá el contenido completo de `supabase/schema.sql`.
3. En **Authentication → Sign In / Providers → Email**, desactivá la confirmación de correo si vas a usar DNI con correo interno `DNI@controldetarea.com`.
4. En Vercel configurá las variables:
   - `VITE_SUPABASE_URL`: URL del proyecto.
   - `VITE_SUPABASE_ANON_KEY`: clave publishable (o anon legacy).
   - `VITE_USE_LOCAL_DEMO`: `false`.
5. Volvé a desplegar para que Vite incorpore las variables.

La clave publishable/anon es pública y está diseñada para el navegador. **Nunca** agregues `service_role` al frontend ni a variables `VITE_`.

### Habilitar el primer profesor

1. Registrá primero su cuenta desde la pantalla de registro como alumno.
2. Abrí `supabase/habilitar-profesor.sql`.
3. Reemplazá el DNI de ejemplo por el DNI del profesor y ejecutá la consulta.
4. Cerrá sesión y volvé a ingresar seleccionando Profesor.

El formulario público no permite crear cuentas con rol profesor. El rol se concede desde el panel SQL de Supabase.

## Vercel

- Importá el repositorio.
- **Root Directory:** `control-de-tarea`.
- **Framework Preset:** Vite.
- **Build Command:** `npm run build`.
- **Output Directory:** `dist`.
- No configures otro root directory ni apuntes el proyecto a `public`.

## Importante

El modo Supabase utiliza datos compartidos en la nube. El modo local de demostración guarda los datos solamente en el navegador y no debe usarse como almacenamiento real multiusuario.
