# Gonzo Agencia

Workspace interno para gestion de clientes, contenido, CRM, horas y roles con Next.js y Supabase.

## Desarrollo local

```bash
npm install
npm run dev
```

Crea `.env.local` a partir de `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## Supabase

Antes de usar la app en produccion, ejecuta el contenido de `supabase/schema.sql` en Supabase SQL Editor.

Flujo de acceso:

- Un usuario se registra con Supabase Auth.
- `ensure_my_profile()` crea o actualiza su fila en `profiles`.
- Si existe una fila en `invitations` para su email, se aplica automaticamente su rol y workspace.
- El admin gestiona roles desde `Usuarios y roles`.

Roles:

- `admin`: acceso completo y gestion de usuarios.
- `socio`: operaciones, clientes, CRM y reportes.
- `editor`: acceso orientado a material y clientes.
- `client`: acceso a su workspace asignado.

## Despliegue

En Vercel o el proveedor elegido, configura estas variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` para enviar invitaciones de Supabase Auth
- `SUPABASE_SECRET_KEY` opcional como clave elevada server-side para base de datos
- `RESEND_API_KEY` opcional para enviar el email directamente con Resend
- `RESEND_FROM` opcional, por ejemplo `Gonzo Agencia <hola@tu-dominio.com>`

No subas `.env.local`; ya esta ignorado por Git.

Las invitaciones de cliente se guardan desde el servidor usando una clave elevada de Supabase. Para generar enlaces de invitacion de Supabase Auth configura la clave legacy `service_role` en `SUPABASE_SERVICE_ROLE_KEY`. Si defines `RESEND_API_KEY` y `RESEND_FROM`, la app genera el enlace de invitacion y lo manda directamente con Resend; `RESEND_FROM` debe pertenecer a un dominio verificado en Resend. Si no defines Resend, se usa `supabase.auth.admin.inviteUserByEmail`.

Si usas `onboarding@resend.dev`, Resend solo permite enviar emails de prueba al email propietario/verificado de tu cuenta de Resend. Para enviar invitaciones a clientes reales necesitas verificar un dominio propio en Resend y usar ese dominio en `RESEND_FROM`.
