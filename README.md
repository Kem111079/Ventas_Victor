# Ventas de Víctor · PWA Multiusuario V2.2

Aplicación web instalable para ventas de una pequeña empresa, con sincronización entre usuarios, inventario, costos, gastos e informes financieros sencillos para no financieros.

## Nueva función V2.2: carga masiva por Excel

La app incorpora en **Más → Carga masiva por Excel** un flujo completo para:

- Descargar una plantilla oficial.
- Cargar trabajadores y productos en bloque.
- Crear registros nuevos.
- Actualizar registros existentes por código sin cambiar su ID interno.
- Actualizar precio de compra y precio de venta.
- Reemplazar la existencia de la app con la existencia física indicada en Excel.
- Revisar una vista previa antes de guardar.
- Detectar duplicados y datos inválidos.
- Descargar un reporte de revisión.
- Generar un respaldo JSON automático antes de importar.
- Sincronizar la actualización con todos los usuarios.

### Regla de inventario

`EXISTENCIA_FISICA` es el conteo real disponible y **reemplaza** el inventario actual de la app. No se suma.

### Protección histórica

Cada venta conserva el precio de venta y el costo usados al registrarla. Por lo tanto, una actualización posterior del catálogo no cambia ventas, costos ni márgenes históricos.

## Funciones principales

- Sincronización multiusuario mediante Supabase.
- Inicio de sesión individual y roles.
- Ventas al contado y crédito.
- Carrito con varios productos por comprobante.
- Abonos, ajustes y cuentas por cobrar.
- Edición con motivo y comparación antes/después.
- Anulación reversible y auditoría.
- Inventario, costo, precio, margen y alertas de mínimo.
- Gastos y egresos.
- Estado de resultados estimado.
- Flujo de caja.
- Cierre diario de caja.
- Exportaciones Excel y respaldos JSON.
- Funcionamiento temporal sin conexión.

## Plantilla incluida

La plantilla está disponible en dos ubicaciones:

- `Plantilla_Carga_Masiva_Ventas_Victor_V2_2.xlsx`
- `assets/templates/Plantilla_Carga_Masiva_Ventas_Victor_V2_2.xlsx`

La segunda es la utilizada por el botón de descarga dentro de la app.

## Publicación en GitHub Pages

1. Haz un respaldo JSON desde la versión actual.
2. Extrae el ZIP.
3. Sube todos los archivos y carpetas a la raíz del repositorio.
4. Reemplaza los archivos existentes.
5. Espera que GitHub Pages publique.
6. Cierra y vuelve a abrir la app en los tres teléfonos.

## Supabase

La URL y la Publishable key ya están configuradas en `supabase-config.js`. La V2.2 no requiere tablas nuevas ni un parche SQL adicional cuando la sincronización actual ya funciona.

Nunca coloques una secret key, `service_role` o contraseña de base de datos en GitHub o en el navegador.

## Archivos principales

- `index.html`: interfaz y aplicación base.
- `app-v2.js`: multiusuario, seguridad, carrito, inventario y sincronización.
- `app-v2.1.js`: gastos e informes financieros.
- `app-v2.2.js`: lectura de Excel, validación, vista previa y carga masiva.
- `service-worker.js`: PWA y caché sin conexión.
- `supabase-config.js`: conexión pública con Supabase.
