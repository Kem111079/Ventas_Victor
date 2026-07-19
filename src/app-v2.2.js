(() => {
  'use strict';

  const VV22_VERSION = '2.2.0';
  const TEMPLATE_URL = 'assets/templates/Plantilla_Carga_Masiva_Ventas_Victor_V2_2.xlsx';
  let installed22 = false;
  let preview22 = null;
  let parsedWorkbook22 = null;

  const norm22 = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const code22 = (value) => String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  const text22 = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
  const html22 = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const num22 = (value) => {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let raw = String(value).trim().replace(/C\$|US\$|\$/gi, '').replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
    if (!raw) return null;
    if (raw.includes(',') && !raw.includes('.')) {
      raw = /,\d{1,2}$/.test(raw) ? raw.replace(',', '.') : raw.replace(/,/g, '');
    } else {
      raw = raw.replace(/,/g, '');
    }
    const valueNumber = Number(raw);
    return Number.isFinite(valueNumber) ? valueNumber : null;
  };

  const boolStatus22 = (value, fallback = true) => {
    const normalized = norm22(value);
    if (!normalized) return fallback;
    if (['activo', 'activa', 'si', 'sí', 'true', '1'].includes(normalized)) return true;
    if (['inactivo', 'inactiva', 'no', 'false', '0'].includes(normalized)) return false;
    return null;
  };

  const clone22 = (value) => JSON.parse(JSON.stringify(value));
  const identity22 = () => window.vv2CurrentIdentity ? window.vv2CurrentIdentity() : { userId:'local', userName:'Usuario local', role:'local' };
  const canImport22 = () => ['admin', 'local'].includes(identity22().role || 'local');

  async function waitForApp22() {
    for (let i = 0; i < 240; i += 1) {
      if (typeof state !== 'undefined' && state && typeof save === 'function' && typeof refreshAll === 'function' && document.getElementById('more')) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('No fue posible enlazar la mejora V2.2 con la aplicación base.');
  }

  function installStyles22() {
    if (document.getElementById('vv22Styles')) return;
    const style = document.createElement('style');
    style.id = 'vv22Styles';
    style.textContent = `
      .vv22-import-card{border-color:#cadfd6;background:linear-gradient(180deg,#fff,#f8fbfa)}
      .vv22-import-card .vv22-rule{font-size:11px;line-height:1.55;color:var(--muted);margin-top:9px}
      .vv22-filebox{border:1px dashed #a8beb5;background:#f8fbfa;border-radius:15px;padding:14px;text-align:center}
      .vv22-filebox strong{display:block;color:var(--brand);font-size:13px}.vv22-filebox small{display:block;color:var(--muted);font-size:10px;margin-top:4px}
      .vv22-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
      .vv22-stat{border:1px solid var(--line);background:#fff;border-radius:13px;padding:10px}.vv22-stat span{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:850}.vv22-stat b{display:block;font-size:19px;margin-top:3px;color:var(--brand)}
      .vv22-stat.error b{color:var(--danger)}.vv22-stat.warn b{color:var(--warning)}
      .vv22-preview-section{margin-top:13px}.vv22-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 2px 7px}.vv22-preview-head h4{font-size:13px;margin:0}.vv22-preview-head small{color:var(--muted);font-size:9px}
      .vv22-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:13px;background:#fff}.vv22-table{width:100%;border-collapse:collapse;min-width:760px;font-size:10px}.vv22-table th{position:sticky;top:0;background:#edf4f1;color:#344740;text-align:left;padding:8px;font-weight:900;border-bottom:1px solid var(--line)}.vv22-table td{padding:8px;border-bottom:1px solid #edf1ef;vertical-align:top}.vv22-table tr:last-child td{border-bottom:0}
      .vv22-action{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:8px;font-weight:900;text-transform:uppercase}.vv22-action.create{background:var(--success-bg);color:var(--success)}.vv22-action.update{background:var(--info-bg);color:var(--info)}.vv22-action.same{background:#f0f2f1;color:#5f6c67}.vv22-action.error{background:var(--danger-bg);color:var(--danger)}
      .vv22-change{font-size:9px;line-height:1.45;color:#45564e}.vv22-change b{color:var(--brand)}
      .vv22-errors{max-height:180px;overflow:auto;display:grid;gap:6px}.vv22-error{border-left:4px solid var(--danger);background:var(--danger-bg);padding:8px 10px;border-radius:8px;font-size:10px;line-height:1.45}.vv22-warning{border-left-color:var(--warning);background:var(--warning-bg)}
      .vv22-code{display:inline-block;font-size:8px;font-weight:900;background:var(--brand-3);color:var(--brand);padding:3px 6px;border-radius:999px;margin-right:5px}
      .vv22-hidden{display:none!important}
      @media(min-width:720px){.vv22-summary{grid-template-columns:repeat(6,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function installUI22() {
    const more = document.getElementById('more');
    if (!more || document.getElementById('vv22ImportCard')) return;
    const catalogCard = more.querySelector('.card');
    const card = document.createElement('div');
    card.className = 'card vv22-import-card';
    card.id = 'vv22ImportCard';
    card.innerHTML = `
      <div class="card-head"><h2>Carga masiva por Excel</h2><small>Trabajadores, productos e inventario</small></div>
      <div class="btn-row">
        <a class="btn secondary" href="${TEMPLATE_URL}" download="Plantilla_Carga_Masiva_Ventas_Victor_V2_2.xlsx"><span data-icon="excel"></span>Descargar plantilla</a>
        <button class="btn primary" type="button" id="vv22OpenImport"><span data-icon="save"></span>Cargar Excel</button>
      </div>
      <div class="vv22-rule"><b>Regla de inventario:</b> EXISTENCIA_FISICA reemplaza la existencia de la app porque representa el conteo físico real. Los precios nuevos se aplican solo a futuras ventas.</div>
    `;
    catalogCard.insertAdjacentElement('afterend', card);
    card.querySelectorAll('[data-icon]').forEach((el) => { if (typeof ICONS !== 'undefined') el.innerHTML = ICONS[el.dataset.icon] || ''; });

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'vv22ImportModal';
    modal.innerHTML = `
      <div class="sheet">
        <div class="sheet-handle"></div>
        <div class="modal-head"><h3>Carga masiva y actualización</h3><button class="close" type="button" id="vv22CloseImport">×</button></div>
        <div class="notice success"><b>Protección histórica:</b> esta importación modifica únicamente trabajadores, productos, precios e inventario actual. No recalcula ni cambia ventas ya registradas.</div>
        <div class="vv22-filebox mt10" id="vv22FileBox">
          <strong id="vv22FileName">Seleccione la plantilla completada</strong>
          <small>Formato permitido: .xlsx · Hojas requeridas: Trabajadores y Productos</small>
          <label class="btn primary mt10" style="cursor:pointer">Elegir archivo Excel<input id="vv22FileInput" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
        </div>
        <div id="vv22PreviewArea" class="vv22-hidden">
          <div class="vv22-summary">
            <div class="vv22-stat"><span>Trab. nuevos</span><b id="vv22WorkersNew">0</b></div>
            <div class="vv22-stat"><span>Trab. actualizados</span><b id="vv22WorkersUpdated">0</b></div>
            <div class="vv22-stat"><span>Productos nuevos</span><b id="vv22ProductsNew">0</b></div>
            <div class="vv22-stat"><span>Prod. actualizados</span><b id="vv22ProductsUpdated">0</b></div>
            <div class="vv22-stat warn"><span>Inventarios</span><b id="vv22StocksUpdated">0</b></div>
            <div class="vv22-stat error"><span>Errores</span><b id="vv22ErrorsCount">0</b></div>
          </div>
          <div id="vv22WarningPanel" class="vv22-errors vv22-hidden"></div>
          <div class="vv22-preview-section">
            <div class="vv22-preview-head"><h4>Trabajadores</h4><small id="vv22WorkerRows"></small></div>
            <div class="vv22-table-wrap"><table class="vv22-table"><thead><tr><th>Fila</th><th>Código</th><th>Nombre</th><th>Acción</th><th>Cambios</th></tr></thead><tbody id="vv22WorkersBody"></tbody></table></div>
          </div>
          <div class="vv22-preview-section">
            <div class="vv22-preview-head"><h4>Productos e inventario físico</h4><small id="vv22ProductRows"></small></div>
            <div class="vv22-table-wrap"><table class="vv22-table"><thead><tr><th>Fila</th><th>Código</th><th>Producto</th><th>Acción</th><th>Precio compra</th><th>Precio venta</th><th>Existencia</th><th>Cambios</th></tr></thead><tbody id="vv22ProductsBody"></tbody></table></div>
          </div>
          <div class="btn-row mt10">
            <button class="btn secondary" type="button" id="vv22DownloadReport">Descargar revisión</button>
            <button class="btn primary" type="button" id="vv22ApplyImport">Confirmar actualización</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('vv22OpenImport').addEventListener('click', openImport22);
    document.getElementById('vv22CloseImport').addEventListener('click', closeImport22);
    document.getElementById('vv22FileInput').addEventListener('change', handleFile22);
    document.getElementById('vv22ApplyImport').addEventListener('click', applyImport22);
    document.getElementById('vv22DownloadReport').addEventListener('click', downloadReview22);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeImport22(); });
  }

  function openImport22() {
    if (!canImport22()) {
      alert('Solo un administrador puede cargar catálogos e inventario.');
      return;
    }
    preview22 = null;
    parsedWorkbook22 = null;
    document.getElementById('vv22FileInput').value = '';
    document.getElementById('vv22FileName').textContent = 'Seleccione la plantilla completada';
    document.getElementById('vv22PreviewArea').classList.add('vv22-hidden');
    document.getElementById('vv22ImportModal').classList.add('show');
  }

  function closeImport22() {
    document.getElementById('vv22ImportModal')?.classList.remove('show');
  }

  function setBusy22(busy, label = 'Procesando…') {
    const button = document.getElementById('vv22ApplyImport');
    const input = document.getElementById('vv22FileInput');
    if (button) {
      button.disabled = busy;
      button.dataset.original = button.dataset.original || button.textContent;
      button.textContent = busy ? label : button.dataset.original;
    }
    if (input) input.disabled = busy;
  }

  function findEocd22(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error('El archivo no parece ser un Excel .xlsx válido.');
  }

  async function unzip22(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const eocd = findEocd22(bytes);
    const entryCount = view.getUint16(eocd + 10, true);
    let pointer = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder('utf-8');
    const files = new Map();

    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error('La estructura interna del Excel está dañada.');
      const method = view.getUint16(pointer + 10, true);
      const compressedSize = view.getUint32(pointer + 20, true);
      const nameLength = view.getUint16(pointer + 28, true);
      const extraLength = view.getUint16(pointer + 30, true);
      const commentLength = view.getUint16(pointer + 32, true);
      const localOffset = view.getUint32(pointer + 42, true);
      const name = decoder.decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let content;
      if (method === 0) {
        content = compressed;
      } else if (method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador no permite leer Excel sin conexión. Actualice Chrome o Safari.');
        let stream;
        try {
          stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        } catch (_) {
          throw new Error('El navegador no admite la descompresión necesaria para leer el Excel.');
        }
        content = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        throw new Error(`El Excel utiliza un método de compresión no soportado (${method}).`);
      }
      files.set(name.replace(/^\//, ''), content);
      pointer += 46 + nameLength + extraLength + commentLength;
    }
    return files;
  }

  const xmlText22 = (files, path) => {
    const data = files.get(path);
    return data ? new TextDecoder('utf-8').decode(data) : '';
  };

  const parseXml22 = (text, name) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error(`No fue posible leer ${name} dentro del Excel.`);
    return doc;
  };

  function normalizePath22(baseDir, target) {
    if (target.startsWith('/')) return target.replace(/^\//, '');
    const parts = `${baseDir}/${target}`.split('/');
    const output = [];
    parts.forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') output.pop(); else output.push(part);
    });
    return output.join('/');
  }

  function columnIndex22(reference) {
    const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
    let result = 0;
    for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
    return result - 1;
  }

  function sharedStrings22(files) {
    const text = xmlText22(files, 'xl/sharedStrings.xml');
    if (!text) return [];
    const doc = parseXml22(text, 'las cadenas compartidas');
    return [...doc.getElementsByTagNameNS('*', 'si')].map((item) => [...item.getElementsByTagNameNS('*', 't')].map((node) => node.textContent || '').join(''));
  }

  function worksheetRows22(files, path, shared) {
    const text = xmlText22(files, path);
    if (!text) throw new Error(`No se encontró la hoja interna ${path}.`);
    const doc = parseXml22(text, path);
    const output = [];
    [...doc.getElementsByTagNameNS('*', 'row')].forEach((rowNode) => {
      const rowIndex = Math.max(0, Number(rowNode.getAttribute('r') || output.length + 1) - 1);
      const row = output[rowIndex] || [];
      [...rowNode.getElementsByTagNameNS('*', 'c')].forEach((cell) => {
        const ref = cell.getAttribute('r') || '';
        const col = columnIndex22(ref);
        const type = cell.getAttribute('t') || '';
        const valueNode = cell.getElementsByTagNameNS('*', 'v')[0];
        let value = valueNode?.textContent ?? '';
        if (type === 's') value = shared[Number(value)] ?? '';
        else if (type === 'inlineStr') value = [...cell.getElementsByTagNameNS('*', 't')].map((node) => node.textContent || '').join('');
        else if (type === 'b') value = value === '1';
        else if (!['str', 'e'].includes(type) && value !== '') {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) value = numeric;
        }
        row[col] = value;
      });
      output[rowIndex] = row;
    });
    return output;
  }

  async function readWorkbook22(file) {
    const files = await unzip22(await file.arrayBuffer());
    const workbookText = xmlText22(files, 'xl/workbook.xml');
    const relText = xmlText22(files, 'xl/_rels/workbook.xml.rels');
    if (!workbookText || !relText) throw new Error('El archivo no contiene una estructura de Excel reconocible.');
    const workbookDoc = parseXml22(workbookText, 'el libro');
    const relDoc = parseXml22(relText, 'las relaciones del libro');
    const rels = new Map([...relDoc.getElementsByTagNameNS('*', 'Relationship')].map((rel) => [rel.getAttribute('Id'), normalizePath22('xl', rel.getAttribute('Target') || '')]));
    const shared = sharedStrings22(files);
    const sheets = {};
    [...workbookDoc.getElementsByTagNameNS('*', 'sheet')].forEach((sheet) => {
      const id = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttribute('r:id');
      const path = rels.get(id);
      if (path) sheets[sheet.getAttribute('name')] = worksheetRows22(files, path, shared);
    });
    return sheets;
  }

  function findSheet22(workbook, wanted) {
    const key = Object.keys(workbook).find((name) => norm22(name) === norm22(wanted));
    return key ? workbook[key] : null;
  }

  function rowsToObjects22(rows) {
    if (!rows || !rows.length) return [];
    const headerRowIndex = rows.findIndex((row) => (row || []).some((value) => text22(value)));
    if (headerRowIndex < 0) return [];
    const headers = (rows[headerRowIndex] || []).map((value) => norm22(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    return rows.slice(headerRowIndex + 1).map((row, offset) => {
      const object = { _row: headerRowIndex + offset + 2 };
      headers.forEach((header, index) => { if (header) object[header] = row?.[index] ?? ''; });
      return object;
    }).filter((row) => Object.keys(row).some((key) => key !== '_row' && text22(row[key])));
  }

  const pick22 = (row, aliases) => {
    for (const alias of aliases) {
      const key = norm22(alias).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    }
    return '';
  };

  function indexExisting22(items) {
    const byCode = new Map();
    const byName = new Map();
    (items || []).forEach((item) => {
      const c = code22(item.code);
      const n = norm22(item.name);
      if (c) byCode.set(c, [...(byCode.get(c) || []), item]);
      if (n) byName.set(n, [...(byName.get(n) || []), item]);
    });
    return { byCode, byName };
  }

  function resolveExisting22(index, code, name) {
    const codeMatches = code ? (index.byCode.get(code) || []) : [];
    const nameMatches = name ? (index.byName.get(norm22(name)) || []) : [];
    if (codeMatches.length > 1) return { error:`El código ${code} está repetido en la app.` };
    if (nameMatches.length > 1 && !codeMatches.length) return { error:`El nombre ${name} está duplicado en la app.` };
    if (codeMatches.length && nameMatches.length && codeMatches[0].id !== nameMatches[0].id) return { error:`El código ${code} y el nombre ${name} corresponden a registros distintos.` };
    return { item: codeMatches[0] || nameMatches[0] || null };
  }

  function differences22(before, after, fields) {
    if (!before) return fields.map(([key, label]) => ({ key, label, before:'—', after:after[key] }));
    return fields.flatMap(([key, label]) => {
      const left = before[key] == null ? '' : before[key];
      const right = after[key] == null ? '' : after[key];
      return String(left) === String(right) ? [] : [{ key, label, before:left, after:right }];
    });
  }

  function buildPreview22(workbook, fileName) {
    const workerSheet = findSheet22(workbook, 'Trabajadores');
    const productSheet = findSheet22(workbook, 'Productos');
    const errors = [];
    const warnings = [];
    if (!workerSheet) errors.push({ sheet:'Libro', row:'—', message:'Falta la hoja Trabajadores.' });
    if (!productSheet) errors.push({ sheet:'Libro', row:'—', message:'Falta la hoja Productos.' });

    const workerRows = rowsToObjects22(workerSheet || []);
    const productRows = rowsToObjects22(productSheet || []);
    const workerIndex = indexExisting22(state.workers);
    const productIndex = indexExisting22(state.products);
    const excelWorkerCodes = new Set();
    const excelWorkerNames = new Set();
    const excelProductCodes = new Set();
    const excelProductNames = new Set();
    const workers = [];
    const products = [];

    workerRows.forEach((row) => {
      const rowNo = row._row;
      const code = code22(pick22(row, ['CODIGO', 'CÓDIGO', 'ID']));
      const name = text22(pick22(row, ['NOMBRE', 'TRABAJADOR']));
      const phone = text22(pick22(row, ['TELEFONO', 'TELÉFONO', 'CELULAR']));
      const creditLimit = num22(pick22(row, ['LIMITE_CREDITO', 'LÍMITE_CRÉDITO']));
      const term = num22(pick22(row, ['PLAZO_DIAS', 'PLAZO DÍAS']));
      const statusRaw = pick22(row, ['ESTADO']);
      const notes = text22(pick22(row, ['OBSERVACION', 'OBSERVACIÓN', 'NOTAS']));
      const rowErrors = [];
      if (!code && !name && !phone && creditLimit == null && term == null && !text22(statusRaw) && !notes) return;
      if (!code) rowErrors.push('Código obligatorio.');
      if (!name) rowErrors.push('Nombre obligatorio.');
      if (code && excelWorkerCodes.has(code)) rowErrors.push(`Código ${code} repetido en el Excel.`);
      if (name && excelWorkerNames.has(norm22(name))) rowErrors.push(`Nombre ${name} repetido en el Excel.`);
      if (creditLimit != null && creditLimit < 0) rowErrors.push('El límite de crédito no puede ser negativo.');
      if (term != null && (!Number.isInteger(term) || term < 0)) rowErrors.push('El plazo debe ser un número entero mayor o igual a cero.');
      const status = boolStatus22(statusRaw, true);
      if (text22(statusRaw) && status == null) rowErrors.push('ESTADO debe ser ACTIVO o INACTIVO.');
      if (code) excelWorkerCodes.add(code);
      if (name) excelWorkerNames.add(norm22(name));
      const resolution = resolveExisting22(workerIndex, code, name);
      if (resolution.error) rowErrors.push(resolution.error);
      const before = resolution.item;
      const after = {
        ...(before || {}),
        code,
        name,
        phone: phone || before?.phone || '',
        creditLimit: creditLimit == null ? Number(before?.creditLimit || 0) : creditLimit,
        paymentTermDays: term == null ? Number(before?.paymentTermDays || state.settings?.defaultPaymentTermDays || 15) : term,
        active: text22(statusRaw) ? status : before?.active !== false,
        notes: notes || before?.notes || ''
      };
      const changes = differences22(before, after, [['code','Código'],['name','Nombre'],['phone','Teléfono'],['creditLimit','Límite de crédito'],['paymentTermDays','Plazo'],['active','Estado'],['notes','Observación']]);
      const action = rowErrors.length ? 'error' : !before ? 'create' : changes.length ? 'update' : 'same';
      const record = { sheet:'Trabajadores', row:rowNo, code, name, before:before ? clone22(before) : null, after, existingId:before?.id || '', action, changes, errors:rowErrors };
      workers.push(record);
      rowErrors.forEach((message) => errors.push({ sheet:'Trabajadores', row:rowNo, message }));
    });

    productRows.forEach((row) => {
      const rowNo = row._row;
      const code = code22(pick22(row, ['CODIGO', 'CÓDIGO', 'ID']));
      const name = text22(pick22(row, ['PRODUCTO', 'NOMBRE']));
      const category = text22(pick22(row, ['CATEGORIA', 'CATEGORÍA']));
      const cost = num22(pick22(row, ['PRECIO_COMPRA', 'COSTO', 'PRECIO DE COMPRA']));
      const price = num22(pick22(row, ['PRECIO_VENTA', 'PRECIO', 'PRECIO DE VENTA']));
      const stock = num22(pick22(row, ['EXISTENCIA_FISICA', 'EXISTENCIA FÍSICA', 'INVENTARIO', 'EXISTENCIA']));
      const minStock = num22(pick22(row, ['EXISTENCIA_MINIMA', 'EXISTENCIA MÍNIMA', 'MINIMO', 'MÍNIMO']));
      const statusRaw = pick22(row, ['ESTADO']);
      const rowErrors = [];
      if (!name && code.startsWith('IMPORTANTE')) return;
      if (!code && !name && !category && cost == null && price == null && stock == null && minStock == null && !text22(statusRaw)) return;
      if (!code) rowErrors.push('Código obligatorio.');
      if (!name) rowErrors.push('Producto obligatorio.');
      if (code && excelProductCodes.has(code)) rowErrors.push(`Código ${code} repetido en el Excel.`);
      if (name && excelProductNames.has(norm22(name))) rowErrors.push(`Producto ${name} repetido en el Excel.`);
      if (cost == null || cost < 0) rowErrors.push('PRECIO_COMPRA debe ser un número mayor o igual a cero.');
      if (price == null || price < 0) rowErrors.push('PRECIO_VENTA debe ser un número mayor o igual a cero.');
      if (stock == null || stock < 0) rowErrors.push('EXISTENCIA_FISICA es obligatoria y no puede ser negativa.');
      if (stock != null && !Number.isInteger(stock)) rowErrors.push('EXISTENCIA_FISICA debe ser un número entero.');
      if (minStock != null && minStock < 0) rowErrors.push('EXISTENCIA_MINIMA no puede ser negativa.');
      const status = boolStatus22(statusRaw, true);
      if (text22(statusRaw) && status == null) rowErrors.push('ESTADO debe ser ACTIVO o INACTIVO.');
      if (code) excelProductCodes.add(code);
      if (name) excelProductNames.add(norm22(name));
      const resolution = resolveExisting22(productIndex, code, name);
      if (resolution.error) rowErrors.push(resolution.error);
      const before = resolution.item;
      const after = {
        ...(before || {}),
        code,
        name,
        category: category || before?.category || '',
        cost: cost == null ? Number(before?.cost || 0) : cost,
        price: price == null ? Number(before?.price || 0) : price,
        stock,
        minStock: minStock == null ? Number(before?.minStock || 0) : minStock,
        active: text22(statusRaw) ? status : before?.active !== false,
        notes: before?.notes || ''
      };
      const changes = differences22(before, after, [['code','Código'],['name','Producto'],['category','Categoría'],['cost','Precio compra'],['price','Precio venta'],['stock','Existencia física'],['minStock','Existencia mínima'],['active','Estado']]);
      const action = rowErrors.length ? 'error' : !before ? 'create' : changes.length ? 'update' : 'same';
      const record = { sheet:'Productos', row:rowNo, code, name, before:before ? clone22(before) : null, after, existingId:before?.id || '', action, changes, errors:rowErrors };
      products.push(record);
      rowErrors.forEach((message) => errors.push({ sheet:'Productos', row:rowNo, message }));
      if (!rowErrors.length && price < cost) warnings.push({ sheet:'Productos', row:rowNo, message:`${name}: precio de venta menor que precio de compra.` });
      if (!rowErrors.length && stock <= Number(after.minStock || 0)) warnings.push({ sheet:'Productos', row:rowNo, message:`${name}: existencia física igual o menor al mínimo.` });
    });

    const count = (list, action) => list.filter((item) => item.action === action).length;
    const stockChanges = products.filter((item) => ['create','update'].includes(item.action) && Number(item.before?.stock ?? 0) !== Number(item.after.stock ?? 0));
    return {
      fileName,
      baseUpdatedAt: state.updatedAt || '',
      workbook,
      workers,
      products,
      errors,
      warnings,
      summary: {
        workersNew:count(workers,'create'), workersUpdated:count(workers,'update'), workersSame:count(workers,'same'),
        productsNew:count(products,'create'), productsUpdated:count(products,'update'), productsSame:count(products,'same'),
        stocksUpdated:stockChanges.length, errors:errors.length, warnings:warnings.length,
        oldStock:stockChanges.reduce((sum,item)=>sum+Number(item.before?.stock || 0),0),
        newStock:stockChanges.reduce((sum,item)=>sum+Number(item.after.stock || 0),0),
        inventoryValue:products.filter((item)=>item.action!=='error').reduce((sum,item)=>sum+Number(item.after.stock || 0)*Number(item.after.cost || 0),0)
      }
    };
  }

  const actionLabel22 = (action) => ({ create:'Nuevo', update:'Actualizar', same:'Sin cambio', error:'Error' }[action] || action);
  const displayValue22 = (key, value) => {
    if (['price','cost','creditLimit'].includes(key)) return typeof money === 'function' ? money(Number(value || 0)) : Number(value || 0).toFixed(2);
    if (key === 'active') return value === false ? 'INACTIVO' : 'ACTIVO';
    return value == null || value === '' ? '—' : String(value);
  };

  function changeHtml22(changes, max = 5) {
    if (!changes?.length) return '<span class="item-sub">Sin cambios</span>';
    const visible = changes.slice(0, max).map((change) => `<div class="vv22-change"><b>${html22(change.label)}:</b> ${html22(displayValue22(change.key, change.before))} → ${html22(displayValue22(change.key, change.after))}</div>`).join('');
    return visible + (changes.length > max ? `<div class="item-sub">+${changes.length - max} cambio(s)</div>` : '');
  }

  function renderPreview22(preview) {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set('vv22WorkersNew', preview.summary.workersNew);
    set('vv22WorkersUpdated', preview.summary.workersUpdated);
    set('vv22ProductsNew', preview.summary.productsNew);
    set('vv22ProductsUpdated', preview.summary.productsUpdated);
    set('vv22StocksUpdated', preview.summary.stocksUpdated);
    set('vv22ErrorsCount', preview.summary.errors);
    set('vv22WorkerRows', `${preview.workers.length} fila(s)`);
    set('vv22ProductRows', `${preview.products.length} fila(s)`);

    document.getElementById('vv22WorkersBody').innerHTML = preview.workers.length ? preview.workers.map((item) => `<tr><td>${item.row}</td><td><span class="vv22-code">${html22(item.code || 'SIN CÓDIGO')}</span></td><td>${html22(item.name)}</td><td><span class="vv22-action ${item.action}">${actionLabel22(item.action)}</span></td><td>${item.errors.length ? html22(item.errors.join(' · ')) : changeHtml22(item.changes)}</td></tr>`).join('') : '<tr><td colspan="5">Sin filas.</td></tr>';
    document.getElementById('vv22ProductsBody').innerHTML = preview.products.length ? preview.products.map((item) => `<tr><td>${item.row}</td><td><span class="vv22-code">${html22(item.code || 'SIN CÓDIGO')}</span></td><td>${html22(item.name)}</td><td><span class="vv22-action ${item.action}">${actionLabel22(item.action)}</span></td><td>${html22(displayValue22('cost',item.after.cost))}</td><td>${html22(displayValue22('price',item.after.price))}</td><td><b>${html22(item.after.stock)}</b>${item.before ? `<div class="item-sub">Antes: ${html22(item.before.stock ?? 's/d')}</div>` : ''}</td><td>${item.errors.length ? html22(item.errors.join(' · ')) : changeHtml22(item.changes)}</td></tr>`).join('') : '<tr><td colspan="8">Sin filas.</td></tr>';

    const panel = document.getElementById('vv22WarningPanel');
    const messages = [
      ...preview.errors.map((item) => `<div class="vv22-error"><b>${html22(item.sheet)} · fila ${html22(item.row)}:</b> ${html22(item.message)}</div>`),
      ...preview.warnings.map((item) => `<div class="vv22-error vv22-warning"><b>${html22(item.sheet)} · fila ${html22(item.row)}:</b> ${html22(item.message)}</div>`)
    ];
    panel.innerHTML = messages.join('');
    panel.classList.toggle('vv22-hidden', !messages.length);
    const apply = document.getElementById('vv22ApplyImport');
    apply.disabled = preview.errors.length > 0 || (preview.summary.workersNew + preview.summary.workersUpdated + preview.summary.productsNew + preview.summary.productsUpdated === 0);
    apply.textContent = preview.errors.length ? 'Corrija los errores del Excel' : 'Confirmar actualización';
    document.getElementById('vv22PreviewArea').classList.remove('vv22-hidden');
  }

  async function handleFile22(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      alert('Seleccione un archivo con extensión .xlsx.');
      event.target.value = '';
      return;
    }
    document.getElementById('vv22FileName').textContent = `Leyendo ${file.name}…`;
    document.getElementById('vv22PreviewArea').classList.add('vv22-hidden');
    try {
      parsedWorkbook22 = await readWorkbook22(file);
      preview22 = buildPreview22(parsedWorkbook22, file.name);
      document.getElementById('vv22FileName').textContent = file.name;
      renderPreview22(preview22);
      toast(`Excel revisado: ${preview22.errors.length} error(es)`);
    } catch (error) {
      console.error('Error leyendo Excel V2.2', error);
      preview22 = null;
      parsedWorkbook22 = null;
      document.getElementById('vv22FileName').textContent = 'No fue posible leer el archivo';
      alert(error.message || 'No fue posible leer el Excel.');
    }
  }

  function downloadBlob22(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function backupBeforeImport22(fileName) {
    const backup = { ...clone22(state), backupMeta:{ reason:'Antes de importación masiva', sourceFile:fileName, createdAt:new Date().toISOString(), appVersion:VV22_VERSION } };
    const json = JSON.stringify(backup, null, 2);
    try { localStorage.setItem('ventas_victor_respaldo_antes_importacion', json); } catch (_) {}
    downloadBlob22(new Blob([json], { type:'application/json' }), `RESPALDO_ANTES_IMPORTACION_${today()}_${Date.now()}.json`);
  }

  function compactSummary22(preview) {
    return {
      fileName:preview.fileName,
      workersNew:preview.summary.workersNew,
      workersUpdated:preview.summary.workersUpdated,
      productsNew:preview.summary.productsNew,
      productsUpdated:preview.summary.productsUpdated,
      stocksUpdated:preview.summary.stocksUpdated,
      oldStock:preview.summary.oldStock,
      newStock:preview.summary.newStock,
      inventoryValue:preview.summary.inventoryValue,
      warnings:preview.summary.warnings
    };
  }

  async function applyImport22() {
    if (!preview22 || !parsedWorkbook22) return;
    if (!canImport22()) return alert('Solo un administrador puede confirmar la importación.');
    if (preview22.errors.length) return alert('Corrija primero los errores indicados en la vista previa.');
    if ((state.updatedAt || '') !== preview22.baseUpdatedAt) {
      preview22 = buildPreview22(parsedWorkbook22, preview22.fileName);
      renderPreview22(preview22);
      alert('Otro usuario actualizó la app mientras revisaba el Excel. Se recalculó la vista previa; revísela y confirme nuevamente.');
      return;
    }
    const summary = compactSummary22(preview22);
    const detail = `<b>${html22(preview22.fileName)}</b><br>Trabajadores: ${summary.workersNew} nuevos y ${summary.workersUpdated} actualizados.<br>Productos: ${summary.productsNew} nuevos y ${summary.productsUpdated} actualizados.<br>Inventarios físicos reemplazados: ${summary.stocksUpdated}.<br><br>Las ventas históricas no serán modificadas.`;
    const ok = await askConfirmation({
      title:'Confirmar carga masiva',
      heading:'Actualizar catálogos e inventario físico',
      message:'Se descargará un respaldo antes de aplicar los cambios y la operación quedará registrada en auditoría.',
      detail,
      confirmText:'Aplicar actualización',
      danger:false,
      requiredWord:'IMPORTAR',
      requireReason:true
    });
    if (!ok) return;

    setBusy22(true, 'Actualizando y sincronizando…');
    try {
      backupBeforeImport22(preview22.fileName);
      const identity = identity22();
      const timestamp = new Date().toISOString();
      preview22.workers.filter((item) => ['create','update'].includes(item.action)).forEach((item) => {
        if (item.action === 'create') {
          state.workers.push({ ...item.after, id:uid('w'), createdAt:timestamp, updatedAt:timestamp, createdBy:identity.userId, createdByName:identity.userName, updatedBy:identity.userId, updatedByName:identity.userName });
        } else {
          const target = state.workers.find((row) => row.id === item.existingId);
          if (target) Object.assign(target, item.after, { updatedAt:timestamp, updatedBy:identity.userId, updatedByName:identity.userName });
        }
      });
      preview22.products.filter((item) => ['create','update'].includes(item.action)).forEach((item) => {
        if (item.action === 'create') {
          state.products.push({ ...item.after, id:uid('p'), createdAt:timestamp, updatedAt:timestamp, createdBy:identity.userId, createdByName:identity.userName, updatedBy:identity.userId, updatedByName:identity.userName });
        } else {
          const target = state.products.find((row) => row.id === item.existingId);
          if (target) Object.assign(target, item.after, { updatedAt:timestamp, updatedBy:identity.userId, updatedByName:identity.userName });
        }
      });
      state.inventorySnapshots = Array.isArray(state.inventorySnapshots) ? state.inventorySnapshots : [];
      const inventoryProducts = state.products.map((product) => ({
        productId:product.id || '', code:product.code || '', name:product.name || '', category:product.category || '',
        stock:Number(product.stock || 0), cost:Number(product.cost || 0), price:Number(product.price || 0), active:product.active !== false
      }));
      const inventorySnapshot = {
        id:uid('inv'), date:typeof today === 'function' ? today() : new Date().toLocaleDateString('en-CA'),
        createdAt:timestamp, updatedAt:timestamp, sourceFile:preview22.fileName,
        importedBy:identity.userName, importedById:identity.userId, appVersion:'2.3.1', products:inventoryProducts,
        totalUnits:inventoryProducts.reduce((sum,item)=>sum+Number(item.stock || 0),0),
        totalCost:inventoryProducts.reduce((sum,item)=>sum+Number(item.stock || 0)*Number(item.cost || 0),0),
        totalSale:inventoryProducts.reduce((sum,item)=>sum+Number(item.stock || 0)*Number(item.price || 0),0)
      };
      state.inventorySnapshots.push(inventorySnapshot);
      if (state.inventorySnapshots.length > 60) state.inventorySnapshots = state.inventorySnapshots.slice(-60);
      state.settings = { ...(state.settings || {}), lastCatalogImport:{ ...summary, importedAt:timestamp, importedBy:identity.userName, appVersion:'2.3.1' } };
      audit('Importación masiva', 'Catálogos e inventario', preview22.fileName,
        `${summary.workersNew} trabajadores nuevos · ${summary.workersUpdated} actualizados · ${summary.productsNew} productos nuevos · ${summary.productsUpdated} actualizados · ${summary.stocksUpdated} inventarios físicos reemplazados`,
        null, summary);
      await save();
      refreshAll();
      closeImport22();
      toast('Carga masiva aplicada y sincronizada');
      preview22 = null;
      parsedWorkbook22 = null;
    } catch (error) {
      console.error('Error aplicando importación V2.2', error);
      alert(`No fue posible completar la importación: ${error.message || error}`);
    } finally {
      setBusy22(false);
    }
  }

  function downloadReview22() {
    if (!preview22 || typeof makeWorkbook !== 'function') return;
    const summaryRows = [
      ['Archivo', preview22.fileName],
      ['Trabajadores nuevos', preview22.summary.workersNew],
      ['Trabajadores actualizados', preview22.summary.workersUpdated],
      ['Productos nuevos', preview22.summary.productsNew],
      ['Productos actualizados', preview22.summary.productsUpdated],
      ['Inventarios físicos reemplazados', preview22.summary.stocksUpdated],
      ['Existencia anterior de filas cambiadas', preview22.summary.oldStock],
      ['Existencia física nueva de filas cambiadas', preview22.summary.newStock],
      ['Valor de inventario a costo', typeof cell === 'function' ? cell(preview22.summary.inventoryValue, 3) : preview22.summary.inventoryValue],
      ['Errores', preview22.summary.errors],
      ['Advertencias', preview22.summary.warnings]
    ];
    const workerRows = preview22.workers.map((item) => [item.row,item.code,item.name,actionLabel22(item.action),item.changes.map((change)=>`${change.label}: ${displayValue22(change.key,change.before)} -> ${displayValue22(change.key,change.after)}`).join(' | '),item.errors.join(' | ')]);
    const productRows = preview22.products.map((item) => [item.row,item.code,item.name,actionLabel22(item.action),item.before?.cost ?? '',item.after.cost,item.before?.price ?? '',item.after.price,item.before?.stock ?? '',item.after.stock,item.changes.map((change)=>`${change.label}: ${displayValue22(change.key,change.before)} -> ${displayValue22(change.key,change.after)}`).join(' | '),item.errors.join(' | ')]);
    const errorRows = [...preview22.errors.map((item)=>[item.sheet,item.row,'Error',item.message]),...preview22.warnings.map((item)=>[item.sheet,item.row,'Advertencia',item.message])];
    makeWorkbook([
      { name:'Resumen importación',title:'Revisión de carga masiva',subtitle:`${preview22.fileName} · ${new Date().toLocaleString('es-NI')}`,headers:['Indicador','Valor'],data:summaryRows,widths:[38,28] },
      { name:'Trabajadores',title:'Vista previa de trabajadores',subtitle:preview22.fileName,headers:['Fila','Código','Nombre','Acción','Cambios','Errores'],data:workerRows,widths:[9,15,30,14,65,55] },
      { name:'Productos',title:'Vista previa de productos e inventario',subtitle:preview22.fileName,headers:['Fila','Código','Producto','Acción','Compra anterior','Compra nueva','Venta anterior','Venta nueva','Existencia anterior','Existencia física nueva','Cambios','Errores'],data:productRows,widths:[9,15,30,14,17,17,17,17,18,20,70,55] },
      { name:'Errores y alertas',title:'Validaciones de la importación',subtitle:preview22.fileName,headers:['Hoja','Fila','Nivel','Detalle'],data:errorRows,widths:[18,10,15,75] }
    ], `REVISION_CARGA_MASIVA_${today()}.xlsx`);
    toast('Revisión Excel generada');
  }

  function wrapCatalog22() {
    const previousRender = renderCatalog;
    renderCatalog = function renderCatalogV22() {
      previousRender();
      document.querySelectorAll('#catalogList .item').forEach((item) => {
        const title = item.querySelector('.item-title')?.textContent || '';
        const source = state[catalogType]?.find((row) => norm22(row.name) === norm22(title));
        if (!source) return;
        const titleEl = item.querySelector('.item-title');
        if (source.code && titleEl && !titleEl.querySelector('.vv22-code')) titleEl.insertAdjacentHTML('afterbegin', `<span class="vv22-code">${html22(source.code)}</span>`);
      });
    };
    window.renderCatalog = renderCatalog;
  }

  async function boot22() {
    if (installed22) return;
    installed22 = true;
    try {
      await waitForApp22();
      state.workers.forEach((worker) => { worker.code = code22(worker.code); worker.phone = text22(worker.phone); });
      state.products.forEach((product) => { product.code = code22(product.code); product.category = text22(product.category); });
      state.version = Math.max(Number(state.version) || 0, 8);
      installStyles22();
      installUI22();
      wrapCatalog22();
      await save(false);
      refreshAll();
      const guide = document.querySelector('#guideModal .notice');
      if (guide && !guide.dataset.vv22) {
        guide.dataset.vv22 = '1';
        guide.innerHTML += '<br><br><b>14. Carga masiva:</b> descargue la plantilla Excel, complete Trabajadores y Productos y revise la vista previa antes de confirmar.<br><br><b>15. Inventario físico:</b> EXISTENCIA_FISICA reemplaza la existencia de la app. Los precios y costos nuevos se aplican solo a futuras ventas; el historial permanece intacto.';
      }
      Object.assign(window, { vv22OpenImport:openImport22, vv22DownloadReview:downloadReview22 });
      toast('Ventas de Víctor V2.2 · Carga masiva lista');
    } catch (error) {
      console.error('Error al iniciar V2.2', error);
      alert(`La mejora V2.2 no pudo iniciar: ${error.message}`);
    }
  }

  boot22();
})();
