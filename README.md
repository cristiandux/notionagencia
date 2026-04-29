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

No subas `.env.local`; ya esta ignorado por Git.
