# Ventas de Víctor · PWA Multiusuario V2.1

Aplicación sencilla para controlar ventas, créditos, abonos, gastos, rentabilidad y flujo de caja de un pequeño negocio. Está diseñada para usuarios no contadores y para trabajar desde teléfonos o computadoras con una base compartida en Supabase.

## Novedades de la V2.1

- Corrección del filtro **Todos los trabajadores**.
- Informe global de movimientos por período.
- Precio de compra o costo unitario por producto.
- Costo histórico y margen bruto guardados en cada venta.
- Registro, edición, anulación y restauración de gastos.
- Estado de resultados estimado.
- Flujo de caja separado de la utilidad.
- Compras de inventario tratadas como salida de caja sin doble conteo en resultados.
- Exportación financiera completa a Excel.
- Sincronización multiusuario de gastos y resultados.
- Corrección de la función SQL `vv_save_state` para evitar el error de columna `version` ambigua.

## Informes disponibles

1. **Resumen:** ventas, cobros, costo, margen, gastos y resultado estimado.
2. **Movimientos:** ventas, abonos, ajustes y gastos en un solo libro global.
3. **Resultados:** ventas netas, costo de lo vendido, margen bruto, gastos y resultado neto estimado.
4. **Flujo de caja:** entradas cobradas, salidas pagadas y flujo neto.
5. **Estado de cuenta:** detalle individual por trabajador.

## Tratamiento sencillo de compras y gastos

- El **precio de compra** de cada producto se guarda en el catálogo.
- Cuando se registra una venta, ese costo se conserva en la venta para no alterar el margen histórico.
- Los gastos operativos reducen el resultado estimado.
- Las compras de mercadería o inventario se muestran como salida de caja, pero no se vuelven a restar como gasto operativo porque el costo se reconoce al vender el producto.

## Actualización desde V2.0.1

1. Descargue un respaldo JSON desde la app actual.
2. Extraiga el ZIP V2.1.
3. Suba todos los archivos y carpetas a la raíz de `Kem111079/Ventas_Victor`.
4. Reemplace los archivos existentes cuando GitHub lo solicite.
5. Espere la publicación de GitHub Pages.
6. Cierre completamente la PWA en cada teléfono y vuelva a abrirla.
7. Verifique que aparezca la pestaña **Resultados** en Informes.

No se requiere crear tablas nuevas en Supabase porque los gastos se guardan dentro del estado JSON compartido. El SQL incluido ya contiene la corrección de sincronización.

## Archivos principales

- `index.html`: aplicación base.
- `app-v2.js`: sincronización, seguridad, carrito, auditoría e inventario.
- `app-v2.1.js`: informes globales, gastos, rentabilidad y flujo de caja.
- `supabase-config.js`: conexión pública con Supabase.
- `EJECUTAR_EN_SUPABASE.sql`: instalación completa y función corregida.
- `PARCHE_SQL_SINCRONIZACION_V2_1.sql`: parche corto para corregir únicamente `vv_save_state`.
- `service-worker.js`: instalación y actualización de la PWA.

## Seguridad

La app usa únicamente la `Publishable key`. Nunca coloque en GitHub una clave `service_role`, `sb_secret_...` ni la contraseña de la base de datos.

## Respaldo recomendado

Aunque exista Supabase, descargue periódicamente un respaldo JSON desde **Más → Guardar respaldo**. El respaldo V2.1 incluye gastos, movimientos anulados, productos, trabajadores, cierres de caja, configuración y auditoría.
