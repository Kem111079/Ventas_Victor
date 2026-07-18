# Ventas de Víctor · PWA Multiusuario V2

Aplicación web instalable para ventas de una PYME, preparada para trabajar desde teléfonos y computadoras, compartir datos entre varios usuarios y seguir funcionando temporalmente sin conexión.

## Principales mejoras incluidas

- Sincronización entre los tres usuarios mediante Supabase.
- Inicio de sesión individual y roles: administrador, vendedor y consulta.
- Actualización automática de registros mediante Supabase Realtime.
- Respaldo local en IndexedDB/localStorage y sincronización pendiente cuando regresa internet.
- Carrito para varios productos dentro de un solo comprobante.
- Edición con comparación **antes/después** y motivo obligatorio.
- Anulación reversible en lugar de eliminación física.
- Auditoría con usuario, fecha, dispositivo, motivo y datos modificados.
- Numeración centralizada cuando existe conexión y numeración offline única por dispositivo.
- Relaciones por ID permanente para evitar romper historiales al cambiar nombres.
- Validación de nombres duplicados.
- Límite de crédito y plazo por trabajador.
- Antigüedad de cartera: 0–7, 8–15, 16–30 y más de 30 días.
- Inventario básico, costo, margen y alertas de existencia mínima.
- Cierre diario de caja.
- Comprobantes de venta y abono para imprimir, guardar como PDF o compartir.
- Respaldo automático antes de restaurar o limpiar movimientos.

## Estructura técnica

- **GitHub Pages:** publica la interfaz de la aplicación.
- **Supabase Auth:** autentica a los usuarios.
- **Supabase PostgreSQL:** mantiene el estado central compartido.
- **Supabase Realtime:** avisa a los demás dispositivos cuando hay cambios.
- **IndexedDB/localStorage:** conserva una copia local y permite continuar temporalmente sin conexión.


## Estado de esta entrega

La URL y la **Publishable key** del proyecto `ventas-victor` ya están colocadas en `supabase-config.js`. No es necesario editar ese archivo. Todavía debe ejecutar `supabase/schema.sql` en el SQL Editor y crear/asignar los tres usuarios antes de operar en modo compartido.

## Configuración inicial resumida

1. Cree un proyecto nuevo en Supabase.
2. Abra **SQL Editor** y ejecute completo `supabase/schema.sql`.
3. Cree los tres usuarios en **Authentication → Users**.
4. Asigne cada usuario al negocio usando las instrucciones de `CONFIGURACION_SUPABASE.md`.
5. La **Project URL** y la **Publishable key** ya están configuradas.
6. Suba todo el contenido de esta carpeta al repositorio de GitHub.
7. Active o verifique GitHub Pages.
8. Abra la dirección publicada e ingrese con cada cuenta.

> Nunca coloque la clave `service_role` o una secret key dentro de GitHub o del navegador. La app utiliza únicamente la clave pública junto con autenticación y políticas RLS.

## Publicación en GitHub Pages

1. Cree un repositorio nuevo.
2. Suba todos los archivos y carpetas de este ZIP sin cambiar la estructura.
3. Verifique que la rama principal sea `main`.
4. Entre a **Settings → Pages**.
5. En **Build and deployment → Source**, seleccione **GitHub Actions**.
6. Espere que la acción **Publicar Ventas de Víctor** finalice correctamente.

## Orden recomendado para migrar los datos existentes

1. Haga un respaldo JSON desde el dispositivo que contiene la información maestra.
2. Configure Supabase y publique la nueva versión.
3. Inicie sesión primero desde el dispositivo maestro.
4. Verifique que los registros aparezcan y que el indicador muestre **Sincronizado**.
5. Luego permita el ingreso de los otros dos usuarios.
6. Evite restaurar respaldos diferentes desde varios dispositivos, porque podrían mezclarse registros duplicados.

## Roles

| Rol | Registrar ventas/abonos | Editar propios | Anular | Catálogos/configuración | Consultar/exportar |
|---|---:|---:|---:|---:|---:|
| Administrador | Sí | Sí | Sí | Sí | Sí |
| Vendedor | Sí | Durante la primera hora | No | No | Sí |
| Consulta | No | No | No | No | Sí |

## Archivos principales

- `index.html`: aplicación base.
- `app-v2.js`: mejoras multiusuario, seguridad, carrito, caja, inventario y auditoría.
- `supabase-config.js`: configuración pública de conexión.
- `supabase/schema.sql`: tablas, funciones, RLS, secuencias y Realtime.
- `CONFIGURACION_SUPABASE.md`: instrucciones detalladas.
- `service-worker.js`: instalación PWA y funcionamiento sin conexión.
- `.github/workflows/deploy-pages.yml`: publicación automática en GitHub Pages.

## Uso sin conexión

Cuando no existe internet, la app guarda el cambio en el teléfono y muestra **Pendiente de sincronizar**. Al recuperar la conexión intenta enviar automáticamente la versión local. Si otro usuario modificó la base durante ese tiempo, la app combina los registros por ID y fecha de actualización antes de volver a guardar.

## Respaldo recomendado

Aunque exista Supabase, descargue periódicamente un respaldo JSON desde **Más → Guardar respaldo**. El respaldo incluye registros activos, anulados, catálogos, cierres, configuración y auditoría.
