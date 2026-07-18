# Configuración de Supabase · Ventas de Víctor V2

## 1. Crear el proyecto

Cree un proyecto en Supabase y espere a que la base de datos quede disponible.

## 2. Crear la estructura

Abra **SQL Editor**, copie todo el contenido de:

```text
supabase/schema.sql
```

y ejecútelo una sola vez. El script es reejecutable y crea:

- Negocio.
- Perfiles.
- Miembros y roles.
- Estado compartido de la aplicación.
- Secuencias de documentos.
- Auditoría de sincronización.
- Funciones seguras de guardado y numeración.
- Políticas RLS.
- Publicación Realtime.

## 3. Crear los tres usuarios

En **Authentication → Users**, cree las tres cuentas con correo y contraseña.

Ejemplo:

- Administrador: su correo.
- Vendedor 1: correo de Víctor.
- Vendedor 2 o consulta: correo del tercer usuario.

## 4. Asignar los roles

Después de crear las cuentas, ejecute en SQL Editor sustituyendo los correos:

```sql
insert into public.business_members (business_slug, user_id, role)
select 'ventas-victor', id, 'admin'
from auth.users
where email = 'administrador@correo.com'
on conflict (business_slug, user_id)
do update set role = excluded.role, active = true;

insert into public.business_members (business_slug, user_id, role)
select 'ventas-victor', id, 'seller'
from auth.users
where email in ('vendedor1@correo.com', 'vendedor2@correo.com')
on conflict (business_slug, user_id)
do update set role = excluded.role, active = true;
```

Para una cuenta que solo puede consultar:

```sql
update public.business_members
set role = 'viewer'
where business_slug = 'ventas-victor'
  and user_id = (select id from auth.users where email = 'consulta@correo.com');
```

## 5. Configurar la app

En Supabase abra la configuración del proyecto y copie:

- **Project URL**.
- **Publishable key** o la clave pública `anon` del proyecto.

Abra `supabase-config.js` y complete:

```javascript
window.VV_SUPABASE_CONFIG = {
  url: "https://SU-PROYECTO.supabase.co",
  publishableKey: "SU_CLAVE_PUBLICA",
  businessSlug: "ventas-victor"
};
```

No use `service_role` ni una secret key.

## 6. Publicar en GitHub

Suba todos los archivos al repositorio. El flujo incluido en `.github/workflows/deploy-pages.yml` publica la app en GitHub Pages.

## 7. Validación rápida

1. Abra la app publicada.
2. Inicie sesión con la cuenta administradora.
3. Registre una venta de prueba.
4. Abra la app en otro dispositivo con otra cuenta.
5. Confirme que la venta aparezca automáticamente.
6. Anule la venta desde la cuenta administradora.
7. Confirme que el segundo dispositivo muestre el registro como anulado.

## 8. Migrar registros anteriores

El dispositivo que tenga la base maestra debe iniciar sesión primero. La app detecta los datos locales y los envía a Supabase. Después de verificar la sincronización, los demás usuarios pueden ingresar.

## 9. Solución de problemas

### “La cuenta no está asignada al negocio”

La cuenta existe en Authentication, pero falta una fila en `business_members`.

### “Guardado local · pendiente”

Revise internet, sesión y políticas. Use **Más → Usuarios y sincronización → Sincronizar**.

### Los datos no aparecen en otro teléfono

Confirme que ambos usuarios usan:

- La misma dirección de GitHub Pages.
- El mismo `businessSlug`.
- Cuentas incluidas en `business_members`.
- Conexión activa.

### Se cambió la configuración y el teléfono mantiene una versión anterior

Cierre completamente la PWA y vuelva a abrirla. También puede borrar únicamente la caché del sitio, pero genere antes un respaldo JSON.
