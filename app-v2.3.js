/* Ventas de Víctor · V2.3 Inventario, rotación y análisis de ventas */
(() => {
  'use strict';

  const VV23_VERSION = '2.3.0';
  let installed23 = false;
  let baseRenderReports23 = null;
  let baseSetReportTab23 = null;
  let baseExportXLSX23 = null;

  const num23 = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const text23 = (value) => String(value ?? '').trim();
  const norm23 = (value) => text23(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').toLowerCase();
  const html23 = (value) => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const active23 = (record) => record && record.status !== 'voided' && record.voided !== true;
  const money23 = (value) => typeof money === 'function' ? money(num23(value)) : `C$ ${num23(value).toLocaleString('es-NI', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const date23 = (value) => {
    const raw = text23(value);
    if (!raw) return null;
    const valueDate = new Date(raw.length <= 10 ? `${raw}T12:00:00` : raw);
    return Number.isNaN(valueDate.getTime()) ? null : valueDate;
  };
  const dateKey23 = (value) => {
    const parsed = date23(value);
    return parsed ? parsed.toLocaleDateString('en-CA') : '';
  };
  const formatDate23 = (value) => typeof fmtDate === 'function' ? fmtDate(dateKey23(value) || value) : (date23(value)?.toLocaleDateString('es-NI') || '—');
  const daysBetween23 = (from, to) => {
    const a = date23(from), b = date23(to);
    if (!a || !b) return 0;
    return Math.max(0, Math.floor((b - a) / 86400000));
  };
  const currentDay23 = () => typeof today === 'function' ? today() : new Date().toLocaleDateString('en-CA');
  const identity23 = () => window.vv2CurrentIdentity ? window.vv2CurrentIdentity() : { userName:'Usuario local', role:'local' };

  async function waitForApp23() {
    for (let i = 0; i < 300; i += 1) {
      if (typeof state !== 'undefined' && state && typeof renderReports === 'function' && typeof setReportTab === 'function' && document.getElementById('vv22ImportCard') && document.getElementById('reportTabs')) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error('No fue posible enlazar la mejora V2.3 con la aplicación instalada.');
  }

  function normalizeState23() {
    state.inventorySnapshots = Array.isArray(state.inventorySnapshots) ? state.inventorySnapshots : [];
    state.inventorySnapshots.forEach((snapshot) => {
      snapshot.id = snapshot.id || (typeof uid === 'function' ? uid('inv') : `inv-${Date.now()}-${Math.random()}`);
      snapshot.date = snapshot.date || dateKey23(snapshot.createdAt) || currentDay23();
      snapshot.createdAt = snapshot.createdAt || `${snapshot.date}T12:00:00`;
      snapshot.updatedAt = snapshot.updatedAt || snapshot.createdAt;
      snapshot.products = Array.isArray(snapshot.products) ? snapshot.products : [];
      snapshot.totalUnits = snapshot.totalUnits == null ? snapshot.products.reduce((sum, item) => sum + num23(item.stock), 0) : num23(snapshot.totalUnits);
      snapshot.totalCost = snapshot.totalCost == null ? snapshot.products.reduce((sum, item) => sum + Math.max(0, num23(item.stock)) * num23(item.cost), 0) : num23(snapshot.totalCost);
      snapshot.totalSale = snapshot.totalSale == null ? snapshot.products.reduce((sum, item) => sum + num23(item.stock) * num23(item.price), 0) : num23(snapshot.totalSale);
    });
    state.settings = {
      ...(state.settings || {}),
      inventoryAnalytics: {
        highCoverageDays: 30,
        normalCoverageDays: 90,
        slowCoverageDays: 180,
        ...((state.settings || {}).inventoryAnalytics || {})
      }
    };
    state.version = Math.max(num23(state.version), 8);
  }

  function installStyles23() {
    if (document.getElementById('vv23Styles')) return;
    const style = document.createElement('style');
    style.id = 'vv23Styles';
    style.textContent = `
      .vv23-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}
      .vv23-metric{border:1px solid var(--line);background:#fff;border-radius:15px;padding:11px;min-width:0}
      .vv23-metric span{display:block;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
      .vv23-metric b{display:block;color:var(--brand);font-size:17px;line-height:1.15;margin-top:4px;overflow:hidden;text-overflow:ellipsis}
      .vv23-metric small{display:block;color:var(--muted);font-size:8px;line-height:1.35;margin-top:4px}
      .vv23-metric.alert b{color:var(--danger)}.vv23-metric.good b{color:var(--success)}
      .vv23-filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .vv23-filter-grid .field{margin:0}.vv23-filter-grid .wide{grid-column:1/-1}
      .vv23-report-grid{display:grid;gap:10px;margin-top:10px}
      .vv23-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff}
      .vv23-table{width:100%;border-collapse:collapse;min-width:1320px;font-size:9px}
      .vv23-table th{position:sticky;top:0;z-index:1;background:#eaf3ef;color:#33463e;text-align:left;padding:8px 7px;border-bottom:1px solid var(--line);white-space:nowrap;font-weight:900}
      .vv23-table td{padding:8px 7px;border-bottom:1px solid #edf1ef;vertical-align:top;white-space:nowrap}.vv23-table tr:last-child td{border-bottom:0}
      .vv23-table .num{text-align:right}.vv23-table .product{white-space:normal;min-width:170px}.vv23-table .muted{color:var(--muted);font-size:8px}
      .vv23-pill{display:inline-flex;align-items:center;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:950;text-transform:uppercase;white-space:nowrap;background:#eef1ef;color:#52615b}
      .vv23-pill.high{background:var(--success-bg);color:var(--success)}.vv23-pill.normal{background:var(--info-bg);color:var(--info)}.vv23-pill.low{background:var(--warning-bg);color:var(--warning)}.vv23-pill.dead,.vv23-pill.out{background:var(--danger-bg);color:var(--danger)}.vv23-pill.excess{background:#f5f0ff;color:#6941c6}.vv23-pill.restock{background:#fff0e5;color:#b54708}
      .vv23-ranking{display:grid;gap:8px}.vv23-rank{display:grid;grid-template-columns:minmax(110px,1fr) 1.3fr auto;gap:8px;align-items:center}.vv23-rank span{font-size:9px;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vv23-rank i{display:block;height:9px;border-radius:999px;background:#e7eeeb;overflow:hidden}.vv23-rank i:after{content:'';display:block;height:100%;width:var(--w);border-radius:999px;background:linear-gradient(90deg,var(--brand),#2a9476)}.vv23-rank b{font-size:9px;white-space:nowrap}
      .vv23-alert-list{display:grid;gap:7px}.vv23-alert-row{border-left:4px solid var(--warning);background:var(--warning-bg);border-radius:10px;padding:9px 10px;display:flex;justify-content:space-between;gap:10px}.vv23-alert-row.danger{border-left-color:var(--danger);background:var(--danger-bg)}.vv23-alert-row.good{border-left-color:var(--success);background:var(--success-bg)}.vv23-alert-row b{display:block;font-size:10px}.vv23-alert-row span{display:block;font-size:8px;color:var(--muted);margin-top:2px}.vv23-alert-row strong{font-size:10px;white-space:nowrap}
      .vv23-note{font-size:9px;line-height:1.5;color:var(--muted);margin-top:8px}.vv23-note.warning{background:var(--warning-bg);border:1px solid #ead38c;color:#694c00;border-radius:11px;padding:9px}
      .vv23-history{display:grid;gap:7px}.vv23-history-row{display:grid;grid-template-columns:minmax(115px,1.5fr) repeat(3,minmax(70px,.7fr));gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:8px 2px;font-size:9px}.vv23-history-row:last-child{border-bottom:0}.vv23-history-row b{display:block;font-size:10px}.vv23-history-row span{color:var(--muted);font-size:8px}.vv23-history-row strong{text-align:right}.vv23-abc{display:inline-flex;width:24px;height:24px;border-radius:8px;align-items:center;justify-content:center;font-size:10px;font-weight:950;background:#eef1ef}.vv23-abc.a{background:#dff5e9;color:#067647}.vv23-abc.b{background:#eaf1ff;color:#175cd3}.vv23-abc.c{background:#fff2d8;color:#a15c00}
      .vv23-section-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}
      @media(min-width:720px){.vv23-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.vv23-filter-grid{grid-template-columns:1.2fr 1fr 1fr 1fr}.vv23-filter-grid .wide{grid-column:auto}.vv23-report-grid.two{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.vv23-history-row{grid-template-columns:1fr 1fr}.vv23-history-row .vv23-hide-mobile{display:none}.vv23-rank{grid-template-columns:minmax(90px,1fr) .8fr auto}}
    `;
    document.head.appendChild(style);
  }

  function installUI23() {
    const tabs = document.getElementById('reportTabs');
    if (tabs && !tabs.querySelector('[data-report="inventory"]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.report = 'inventory';
      button.textContent = 'Inventario';
      button.addEventListener('click', () => setReportTab('inventory', button));
      tabs.appendChild(button);
    }

    const statement = document.getElementById('reportStatement');
    if (statement && !document.getElementById('reportInventory')) {
      statement.insertAdjacentHTML('beforebegin', `
        <div id="reportInventory" class="report-pane report-nonstatement hidden">
          <div class="card no-print">
            <div class="card-head"><h2>Inventario y rotación</h2><small>Saldo actual + ventas del período</small></div>
            <div class="vv23-filter-grid">
              <div class="field wide"><label>Buscar producto o código</label><input id="vv23Search" placeholder="Ej. camisa, PR-001..."></div>
              <div class="field"><label>Categoría</label><select id="vv23Category"><option value="">Todas</option></select></div>
              <div class="field"><label>Estado del producto</label><select id="vv23CatalogStatus"><option value="active">Activos</option><option value="all">Todos</option><option value="inactive">Inactivos</option></select></div>
              <div class="field"><label>Condición de inventario</label><select id="vv23StockStatus"><option value="">Todas</option><option value="out">Agotados</option><option value="restock">Reponer</option><option value="high">Alta rotación</option><option value="normal">Rotación normal</option><option value="low">Baja rotación</option><option value="dead">Sin movimiento</option><option value="excess">Exceso</option></select></div>
            </div>
            <div class="vv23-note">El período superior se usa para medir unidades vendidas, ingresos, margen y rotación. El inventario corresponde al saldo físico actual sincronizado.</div>
          </div>

          <div class="vv23-metrics">
            <div class="vv23-metric"><span>Unidades disponibles</span><b id="vv23Units">0</b><small id="vv23ProductsCount">0 productos</small></div>
            <div class="vv23-metric"><span>Masa monetaria a costo</span><b id="vv23CostValue">C$ 0</b><small>Dinero invertido en existencia</small></div>
            <div class="vv23-metric"><span>Venta potencial</span><b id="vv23SaleValue">C$ 0</b><small>Existencia × precio de venta</small></div>
            <div class="vv23-metric good"><span>Margen potencial</span><b id="vv23PotentialMargin">C$ 0</b><small id="vv23PotentialMarginPct">0%</small></div>
            <div class="vv23-metric"><span>Unidades vendidas</span><b id="vv23SoldUnits">0</b><small>Período seleccionado</small></div>
            <div class="vv23-metric"><span>Rotación monetaria</span><b id="vv23Turnover">0.00×</b><small id="vv23TurnoverMode">Referencial</small></div>
            <div class="vv23-metric"><span>Días de inventario</span><b id="vv23InventoryDays">s/d</b><small>Cobertura global estimada</small></div>
            <div class="vv23-metric alert"><span>Dinero sin movimiento</span><b id="vv23DeadValue">C$ 0</b><small id="vv23DeadCount">0 productos</small></div>
          </div>

          <div class="card mt10">
            <div class="card-head"><h2>Inventario actual y desempeño</h2><div class="vv23-section-actions no-print"><button class="btn small secondary" type="button" onclick="vv23PrintInventory()">Imprimir / PDF</button><button class="btn small gold" type="button" onclick="vv23ExportInventory()">Excel</button></div></div>
            <div class="vv23-table-wrap"><table class="vv23-table"><thead><tr>
              <th>ABC</th><th>Código</th><th>Producto</th><th>Categoría</th><th class="num">Existencia</th><th class="num">Compra</th><th class="num">Venta</th><th class="num">Inventario a costo</th><th class="num">Venta potencial</th><th class="num">Unid. vendidas</th><th class="num">Ingresos</th><th class="num">Margen generado</th><th class="num">Cobertura</th><th>Rotación</th><th>Última venta</th>
            </tr></thead><tbody id="vv23InventoryBody"></tbody></table></div>
            <div id="vv23RotationNote" class="vv23-note warning"></div>
          </div>

          <div class="vv23-report-grid two">
            <div class="card"><div class="card-head"><h2>Más vendidos por unidades</h2><small>Top 10 del período</small></div><div id="vv23TopUnits" class="vv23-ranking"></div></div>
            <div class="card"><div class="card-head"><h2>Mayor margen generado</h2><small>Top 10 del período</small></div><div id="vv23TopMargin" class="vv23-ranking"></div></div>
          </div>

          <div class="vv23-report-grid two">
            <div class="card"><div class="card-head"><h2>Alertas y reposición</h2><small>Prioridades operativas</small></div><div id="vv23Alerts" class="vv23-alert-list"></div></div>
            <div class="card"><div class="card-head"><h2>Lectura gerencial</h2><small>Decisiones sugeridas</small></div><div id="vv23Insights" class="vv23-alert-list"></div></div>
          </div>

          <div class="card mt10"><div class="card-head"><h2>Historial de conteos físicos</h2><small>Generado por las importaciones Excel</small></div><div id="vv23History" class="vv23-history"></div><div class="vv23-note">Cada nueva carga física guarda un corte del inventario. Con dos o más cortes en fechas diferentes, la rotación utiliza inventario promedio; mientras tanto se muestra una referencia basada en el saldo disponible.</div></div>
        </div>`);
    }

    ['vv23Search','vv23Category','vv23CatalogStatus','vv23StockStatus'].forEach((id) => {
      const element = document.getElementById(id);
      element?.addEventListener(id === 'vv23Search' ? 'input' : 'change', renderInventory23);
    });
  }

  function reportPeriod23() {
    const from = document.getElementById('reportFrom')?.value || '';
    const to = document.getElementById('reportTo')?.value || currentDay23();
    const candidates = [
      ...(state.sales || []).filter(active23).map((sale) => sale.date),
      ...(state.inventorySnapshots || []).map((snapshot) => snapshot.date || dateKey23(snapshot.createdAt))
    ].filter(Boolean).sort();
    const fallbackFrom = from || candidates[0] || to;
    const days = Math.max(1, daysBetween23(fallbackFrom, to) + 1);
    return { from, calculationFrom:fallbackFrom, to, days };
  }

  function saleMatchesProduct23(sale, product) {
    if (sale.productId && product.id) return sale.productId === product.id;
    return norm23(sale.product) === norm23(product.name);
  }

  function currentFilters23() {
    return {
      search:norm23(document.getElementById('vv23Search')?.value || ''),
      category:document.getElementById('vv23Category')?.value || '',
      catalogStatus:document.getElementById('vv23CatalogStatus')?.value || 'active',
      stockStatus:document.getElementById('vv23StockStatus')?.value || ''
    };
  }

  function snapshots23() {
    return (state.inventorySnapshots || []).slice().sort((a, b) => String(a.createdAt || a.date || '').localeCompare(String(b.createdAt || b.date || '')));
  }

  function snapshotAt23(day, mode = 'before') {
    const target = date23(day);
    if (!target) return null;
    const list = snapshots23().filter((snapshot) => {
      const stamp = date23(snapshot.date || snapshot.createdAt);
      return stamp && (mode === 'before' ? stamp <= target : stamp >= target);
    });
    return mode === 'before' ? list[list.length - 1] || null : list[0] || null;
  }

  function snapshotProduct23(snapshot, product) {
    if (!snapshot) return null;
    return (snapshot.products || []).find((item) => (item.productId && product.id && item.productId === product.id) || (item.code && product.code && norm23(item.code) === norm23(product.code)) || norm23(item.name) === norm23(product.name)) || null;
  }

  function averageInventoryForProduct23(product, period) {
    const openingSnap = snapshotAt23(period.calculationFrom, 'before');
    const closingSnap = period.to >= currentDay23() ? null : snapshotAt23(period.to, 'before');
    const opening = snapshotProduct23(openingSnap, product);
    const closing = closingSnap ? snapshotProduct23(closingSnap, product) : { stock:num23(product.stock), cost:num23(product.cost), price:num23(product.price) };
    const openingDate = dateKey23(openingSnap?.date || openingSnap?.createdAt);
    const closingDate = closingSnap ? dateKey23(closingSnap.date || closingSnap.createdAt) : currentDay23();
    if (opening && closing && openingDate && closingDate && openingDate !== closingDate) {
      const openingStock = Math.max(0, num23(opening.stock));
      const closingStock = Math.max(0, num23(closing.stock));
      return {
        units:(openingStock + closingStock) / 2,
        costValue:(openingStock * num23(opening.cost) + closingStock * num23(closing.cost)) / 2,
        mode:'cortes'
      };
    }
    const currentStock = Math.max(0, num23(product.stock));
    return {
      units:currentStock,
      costValue:currentStock * num23(product.cost),
      mode:'saldo'
    };
  }

  function classifyABC23(rows) {
    const sorted = rows.slice().sort((a, b) => b.revenue - a.revenue);
    const total = sorted.reduce((sum, row) => sum + row.revenue, 0);
    let accumulated = 0;
    sorted.forEach((row) => {
      const previousShare = total ? accumulated / total : 1;
      row.abc = total <= 0 ? 'C' : previousShare < 0.80 ? 'A' : previousShare < 0.95 ? 'B' : 'C';
      accumulated += row.revenue;
    });
  }

  function rotationStatus23(row) {
    const cfg = state.settings?.inventoryAnalytics || {};
    if (row.stock <= 0) return { key:'out', label:'Agotado' };
    if (row.stock <= row.minStock) return { key:'restock', label:'Reponer' };
    if (row.unitsSold <= 0) return { key:'dead', label:'Sin movimiento' };
    if (row.coverageDays <= num23(cfg.highCoverageDays || 30)) return { key:'high', label:'Alta rotación' };
    if (row.coverageDays <= num23(cfg.normalCoverageDays || 90)) return { key:'normal', label:'Normal' };
    if (row.coverageDays <= num23(cfg.slowCoverageDays || 180)) return { key:'low', label:'Baja rotación' };
    return { key:'excess', label:'Exceso' };
  }

  function buildInventoryRows23() {
    const period = reportPeriod23();
    const periodSales = (state.sales || []).filter((sale) => active23(sale) && (!period.from || sale.date >= period.from) && (!period.to || sale.date <= period.to));
    const allSalesToDate = (state.sales || []).filter((sale) => active23(sale) && (!period.to || sale.date <= period.to));
    const rows = (state.products || []).map((product) => {
      const sales = periodSales.filter((sale) => saleMatchesProduct23(sale, product));
      const history = allSalesToDate.filter((sale) => saleMatchesProduct23(sale, product));
      const unitsSold = sales.reduce((sum, sale) => sum + num23(sale.qty), 0);
      const revenue = sales.reduce((sum, sale) => sum + num23(sale.qty) * num23(sale.price), 0);
      const costSold = sales.reduce((sum, sale) => sum + num23(sale.qty) * num23(sale.cost), 0);
      const margin = revenue - costSold;
      const lastSale = history.map((sale) => sale.date).filter(Boolean).sort().pop() || '';
      const stock = num23(product.stock);
      const availableStock = Math.max(0, stock);
      const cost = num23(product.cost);
      const price = num23(product.price);
      const avgDaily = unitsSold / period.days;
      const coverageDays = avgDaily > 0 ? availableStock / avgDaily : null;
      const averageInventory = averageInventoryForProduct23(product, period);
      const turnoverUnits = averageInventory.units > 0 ? unitsSold / averageInventory.units : (unitsSold > 0 ? unitsSold : 0);
      const turnoverMoney = averageInventory.costValue > 0 ? costSold / averageInventory.costValue : 0;
      const row = {
        id:product.id || '', code:product.code || '', name:product.name || 'Sin nombre', category:product.category || 'Sin categoría', active:product.active !== false,
        stock, availableStock, minStock:num23(product.minStock), cost, price,
        inventoryCost:availableStock * cost, potentialSales:availableStock * price, potentialMargin:availableStock * (price - cost),
        unitsSold, revenue, costSold, margin, marginPct:revenue ? margin / revenue : 0,
        lastSale, daysSinceLast:lastSale ? daysBetween23(lastSale, period.to) : null,
        avgDaily, coverageDays, turnoverUnits, turnoverMoney, rotationMode:averageInventory.mode,
        priceBelowCost:price < cost
      };
      row.rotation = rotationStatus23(row);
      return row;
    });
    classifyABC23(rows);
    const filters = currentFilters23();
    const filtered = rows.filter((row) => {
      if (filters.catalogStatus === 'active' && !row.active) return false;
      if (filters.catalogStatus === 'inactive' && row.active) return false;
      if (filters.category && row.category !== filters.category) return false;
      if (filters.search && !norm23(`${row.code} ${row.name} ${row.category}`).includes(filters.search)) return false;
      if (filters.stockStatus && row.rotation.key !== filters.stockStatus) return false;
      return true;
    });
    return { period, allRows:rows, rows:filtered };
  }

  function fillCategories23(rows) {
    const select = document.getElementById('vv23Category');
    if (!select) return;
    const selected = select.value;
    const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    select.innerHTML = `<option value="">Todas</option>${categories.map((category) => `<option value="${html23(category)}">${html23(category)}</option>`).join('')}`;
    if (categories.includes(selected)) select.value = selected;
  }

  function overallRotation23(data) {
    const ids = new Set(data.rows.map((row) => row.id));
    const currentCost = data.rows.reduce((sum, row) => sum + row.inventoryCost, 0);
    const openingSnap = snapshotAt23(data.period.calculationFrom, 'before');
    const closingSnap = data.period.to >= currentDay23() ? null : snapshotAt23(data.period.to, 'before');
    const valueFromSnapshot = (snapshot) => {
      if (!snapshot) return null;
      return (snapshot.products || []).reduce((sum, item) => {
        const match = data.rows.find((row) => (item.productId && row.id && item.productId === row.id) || (item.code && row.code && norm23(item.code) === norm23(row.code)) || norm23(item.name) === norm23(row.name));
        return match && (ids.size === 0 || ids.has(match.id)) ? sum + Math.max(0, num23(item.stock)) * num23(item.cost) : sum;
      }, 0);
    };
    const opening = valueFromSnapshot(openingSnap);
    const closing = closingSnap ? valueFromSnapshot(closingSnap) : currentCost;
    const distinctCuts = openingSnap && (closingSnap || data.period.to >= currentDay23()) && dateKey23(openingSnap.date || openingSnap.createdAt) !== (closingSnap ? dateKey23(closingSnap.date || closingSnap.createdAt) : currentDay23());
    const average = distinctCuts && opening != null ? (opening + closing) / 2 : currentCost;
    const cogs = data.rows.reduce((sum, row) => sum + row.costSold, 0);
    const rotation = average > 0 ? cogs / average : 0;
    return {
      average, rotation,
      inventoryDays:rotation > 0 ? data.period.days / rotation : null,
      mode:distinctCuts ? 'Con inventario promedio de cortes físicos' : 'Referencial sobre el saldo actual',
      openingSnap, closingSnap
    };
  }

  function totals23(data) {
    const rotation = overallRotation23(data);
    const totals = data.rows.reduce((acc, row) => {
      acc.units += row.availableStock; acc.cost += row.inventoryCost; acc.sale += row.potentialSales; acc.potentialMargin += row.potentialMargin;
      acc.unitsSold += row.unitsSold; acc.revenue += row.revenue; acc.costSold += row.costSold; acc.margin += row.margin;
      if (row.rotation.key === 'dead' && row.stock > 0) { acc.deadCost += row.inventoryCost; acc.deadCount += 1; }
      if (row.rotation.key === 'out') acc.outCount += 1;
      if (row.rotation.key === 'restock') acc.restockCount += 1;
      if (row.priceBelowCost) acc.priceLossCount += 1;
      return acc;
    }, { units:0,cost:0,sale:0,potentialMargin:0,unitsSold:0,revenue:0,costSold:0,margin:0,deadCost:0,deadCount:0,outCount:0,restockCount:0,priceLossCount:0 });
    totals.potentialMarginPct = totals.sale ? totals.potentialMargin / totals.sale : 0;
    return { ...totals, ...rotation };
  }

  function setText23(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderRanking23(id, rows, valueKey, formatter, empty) {
    const box = document.getElementById(id);
    if (!box) return;
    const ranked = rows.filter((row) => num23(row[valueKey]) > 0).sort((a, b) => num23(b[valueKey]) - num23(a[valueKey])).slice(0, 10);
    const max = num23(ranked[0]?.[valueKey]) || 1;
    box.innerHTML = ranked.length ? ranked.map((row, index) => `<div class="vv23-rank"><span>${index + 1}. ${html23(row.name)}</span><i style="--w:${Math.max(3, num23(row[valueKey]) / max * 100)}%"></i><b>${formatter(num23(row[valueKey]))}</b></div>`).join('') : `<div class="empty">${html23(empty)}</div>`;
  }

  function renderAlerts23(data) {
    const box = document.getElementById('vv23Alerts');
    const rows = data.rows.slice().sort((a, b) => {
      const priority = { out:0, restock:1, dead:2, excess:3, low:4, normal:5, high:6 };
      return (priority[a.rotation.key] ?? 9) - (priority[b.rotation.key] ?? 9) || b.inventoryCost - a.inventoryCost;
    }).filter((row) => ['out','restock','dead','excess'].includes(row.rotation.key) || row.priceBelowCost).slice(0, 12);
    box.innerHTML = rows.length ? rows.map((row) => {
      let detail = `${row.stock} unidades · ${money23(row.inventoryCost)} a costo`;
      let level = row.rotation.key === 'out' || row.priceBelowCost ? 'danger' : '';
      if (row.priceBelowCost) detail += ' · Precio menor al costo';
      else if (row.rotation.key === 'dead') detail += ' · Sin ventas en el período';
      else if (row.rotation.key === 'excess') detail += ` · ${Math.round(row.coverageDays || 0)} días de cobertura`;
      return `<div class="vv23-alert-row ${level}"><div><b>${html23(row.name)}</b><span>${html23(detail)}</span></div><strong>${html23(row.rotation.label)}</strong></div>`;
    }).join('') : '<div class="empty">No hay alertas con los filtros actuales.</div>';
  }

  function renderInsights23(data, totals) {
    const box = document.getElementById('vv23Insights');
    if (!box) return;
    const bestUnits = data.rows.slice().sort((a, b) => b.unitsSold - a.unitsSold)[0];
    const bestMargin = data.rows.slice().sort((a, b) => b.margin - a.margin)[0];
    const highValueDead = data.rows.filter((row) => row.rotation.key === 'dead').sort((a, b) => b.inventoryCost - a.inventoryCost)[0];
    const items = [];
    if (bestUnits && bestUnits.unitsSold > 0) items.push({ cls:'good', title:'Producto con mayor salida', detail:`${bestUnits.name}: ${bestUnits.unitsSold.toLocaleString('es-NI')} unidades vendidas`, value:money23(bestUnits.revenue) });
    if (bestMargin && bestMargin.margin > 0) items.push({ cls:'good', title:'Mayor contribución de margen', detail:`${bestMargin.name}: ${(bestMargin.marginPct * 100).toFixed(1)}% de margen`, value:money23(bestMargin.margin) });
    if (highValueDead && highValueDead.inventoryCost > 0) items.push({ cls:'danger', title:'Capital inmovilizado prioritario', detail:`${highValueDead.name}: sin movimiento en el período`, value:money23(highValueDead.inventoryCost) });
    if (totals.restockCount + totals.outCount > 0) items.push({ cls:'', title:'Revisión de reposición', detail:`${totals.outCount} agotados y ${totals.restockCount} bajo mínimo`, value:`${totals.outCount + totals.restockCount} productos` });
    if (!items.length) items.push({ cls:'good', title:'Inventario estable', detail:'No se identificaron alertas principales en el período.', value:'Correcto' });
    box.innerHTML = items.map((item) => `<div class="vv23-alert-row ${item.cls}"><div><b>${html23(item.title)}</b><span>${html23(item.detail)}</span></div><strong>${html23(item.value)}</strong></div>`).join('');
  }

  function renderHistory23(data) {
    const box = document.getElementById('vv23History');
    if (!box) return;
    const filters = currentFilters23();
    const relevantProducts = data.rows;
    const valueOf = (snapshot) => (snapshot.products || []).reduce((acc, item) => {
      const match = relevantProducts.find((row) => (item.productId && row.id && item.productId === row.id) || (item.code && row.code && norm23(item.code) === norm23(row.code)) || norm23(item.name) === norm23(row.name));
      if (!match) return acc;
      acc.units += Math.max(0, num23(item.stock)); acc.cost += Math.max(0, num23(item.stock)) * num23(item.cost); return acc;
    }, { units:0,cost:0 });
    const list = snapshots23().slice(-12).reverse();
    box.innerHTML = list.length ? list.map((snapshot, index) => {
      const current = valueOf(snapshot);
      const previousSnapshot = list[index + 1];
      const previous = previousSnapshot ? valueOf(previousSnapshot) : null;
      const deltaUnits = previous ? current.units - previous.units : null;
      const deltaCost = previous ? current.cost - previous.cost : null;
      return `<div class="vv23-history-row"><div><b>${formatDate23(snapshot.date || snapshot.createdAt)}</b><span>${html23(snapshot.sourceFile || 'Corte de inventario')} · ${html23(snapshot.importedBy || snapshot.createdByName || 'Usuario')}</span></div><strong>${current.units.toLocaleString('es-NI')} unid.</strong><strong>${money23(current.cost)}</strong><strong class="vv23-hide-mobile">${deltaUnits == null ? 'Primer corte' : `${deltaUnits >= 0 ? '+' : ''}${deltaUnits.toLocaleString('es-NI')} · ${deltaCost >= 0 ? '+' : ''}${money23(deltaCost)}`}</strong></div>`;
    }).join('') : '<div class="empty">Aún no existen cortes históricos. La próxima importación Excel guardará el primer conteo físico.</div>';
  }

  function renderInventory23() {
    const pane = document.getElementById('reportInventory');
    if (!pane || !state) return;
    const data = buildInventoryRows23();
    fillCategories23(data.allRows);
    const totals = totals23(data);
    setText23('vv23Units', Math.round(totals.units).toLocaleString('es-NI'));
    setText23('vv23ProductsCount', `${data.rows.length} producto${data.rows.length === 1 ? '' : 's'}`);
    setText23('vv23CostValue', money23(totals.cost));
    setText23('vv23SaleValue', money23(totals.sale));
    setText23('vv23PotentialMargin', money23(totals.potentialMargin));
    setText23('vv23PotentialMarginPct', `${(totals.potentialMarginPct * 100).toFixed(1)}% del valor potencial`);
    setText23('vv23SoldUnits', totals.unitsSold.toLocaleString('es-NI'));
    setText23('vv23Turnover', `${totals.rotation.toFixed(2)}×`);
    setText23('vv23TurnoverMode', totals.mode);
    setText23('vv23InventoryDays', totals.inventoryDays == null || !Number.isFinite(totals.inventoryDays) ? 's/d' : `${Math.round(totals.inventoryDays)} días`);
    setText23('vv23DeadValue', money23(totals.deadCost));
    setText23('vv23DeadCount', `${totals.deadCount} producto${totals.deadCount === 1 ? '' : 's'} sin ventas`);

    const body = document.getElementById('vv23InventoryBody');
    const sorted = data.rows.slice().sort((a, b) => b.inventoryCost - a.inventoryCost || b.unitsSold - a.unitsSold);
    body.innerHTML = sorted.length ? sorted.map((row) => `<tr>
      <td><span class="vv23-abc ${row.abc.toLowerCase()}">${row.abc}</span></td>
      <td>${html23(row.code || '—')}</td>
      <td class="product"><b>${html23(row.name)}</b>${row.priceBelowCost ? '<div class="muted danger-text">Precio menor al costo</div>' : ''}</td>
      <td>${html23(row.category)}</td>
      <td class="num"><b>${row.stock.toLocaleString('es-NI')}</b><div class="muted">mín. ${row.minStock.toLocaleString('es-NI')}</div></td>
      <td class="num">${money23(row.cost)}</td><td class="num">${money23(row.price)}</td>
      <td class="num"><b>${money23(row.inventoryCost)}</b></td><td class="num">${money23(row.potentialSales)}</td>
      <td class="num"><b>${row.unitsSold.toLocaleString('es-NI')}</b></td><td class="num">${money23(row.revenue)}</td><td class="num">${money23(row.margin)}</td>
      <td class="num">${row.coverageDays == null ? 's/d' : `${Math.round(row.coverageDays)} días`}</td>
      <td><span class="vv23-pill ${row.rotation.key}">${html23(row.rotation.label)}</span><div class="muted">${row.turnoverMoney.toFixed(2)}×</div></td>
      <td>${row.lastSale ? formatDate23(row.lastSale) : 'Sin venta'}${row.daysSinceLast != null ? `<div class="muted">hace ${row.daysSinceLast} días</div>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="15"><div class="empty">No hay productos que coincidan con los filtros.</div></td></tr>';

    setText23('vv23RotationNote', totals.mode === 'Con inventario promedio de cortes físicos'
      ? 'La rotación se calculó con el promedio entre cortes físicos disponibles y el costo histórico de los productos vendidos.'
      : 'La rotación es referencial porque todavía no existen dos cortes físicos en fechas diferentes. El costo de lo vendido se compara con el saldo actual a costo.');
    renderRanking23('vv23TopUnits', data.rows, 'unitsSold', (value) => `${value.toLocaleString('es-NI')} unid.`, 'No hay unidades vendidas en el período.');
    renderRanking23('vv23TopMargin', data.rows, 'margin', money23, 'No hay margen generado en el período.');
    renderAlerts23(data);
    renderInsights23(data, totals);
    renderHistory23(data);
  }

  function inventorySheets23() {
    const data = buildInventoryRows23();
    const totals = totals23(data);
    const periodLabel = `${data.period.from ? formatDate23(data.period.from) : 'inicio'} al ${formatDate23(data.period.to)}`;
    const makeCell = (value, type) => typeof cell === 'function' ? cell(value, type) : value;
    const summary = [
      ['Período de ventas', periodLabel],
      ['Productos incluidos', data.rows.length],
      ['Unidades disponibles', totals.units],
      ['Masa monetaria a costo', makeCell(totals.cost, 3)],
      ['Valor potencial de venta', makeCell(totals.sale, 3)],
      ['Margen bruto potencial', makeCell(totals.potentialMargin, 3)],
      ['Margen potencial %', makeCell(totals.potentialMarginPct, 5)],
      ['Unidades vendidas', totals.unitsSold],
      ['Ventas del período', makeCell(totals.revenue, 3)],
      ['Costo de lo vendido', makeCell(totals.costSold, 3)],
      ['Margen generado', makeCell(totals.margin, 3)],
      ['Rotación monetaria', totals.rotation],
      ['Días de inventario', totals.inventoryDays == null ? '' : totals.inventoryDays],
      ['Método de rotación', totals.mode],
      ['Dinero sin movimiento', makeCell(totals.deadCost, 3)],
      ['Productos agotados', totals.outCount],
      ['Productos para reponer', totals.restockCount],
      ['Precios por debajo del costo', totals.priceLossCount]
    ];
    const inventory = data.rows.slice().sort((a,b)=>b.inventoryCost-a.inventoryCost).map((row) => [
      row.abc,row.code,row.name,row.category,row.active?'Activo':'Inactivo',row.stock,row.minStock,
      makeCell(row.cost,3),makeCell(row.price,3),makeCell(row.inventoryCost,3),makeCell(row.potentialSales,3),makeCell(row.potentialMargin,3),
      row.unitsSold,makeCell(row.revenue,3),makeCell(row.costSold,3),makeCell(row.margin,3),makeCell(row.marginPct,5),
      row.coverageDays == null ? '' : row.coverageDays,row.turnoverUnits,row.turnoverMoney,row.rotation.label,row.lastSale ? makeCell(typeof excelDate === 'function' ? excelDate(row.lastSale) : row.lastSale,4) : '',row.daysSinceLast == null ? '' : row.daysSinceLast
    ]);
    const topUnits = data.rows.slice().sort((a,b)=>b.unitsSold-a.unitsSold).filter((row)=>row.unitsSold>0).map((row,index)=>[index+1,row.code,row.name,row.category,row.unitsSold,makeCell(row.revenue,3),makeCell(row.margin,3),row.abc]);
    const topMargin = data.rows.slice().sort((a,b)=>b.margin-a.margin).filter((row)=>row.margin!==0).map((row,index)=>[index+1,row.code,row.name,row.category,row.unitsSold,makeCell(row.revenue,3),makeCell(row.margin,3),makeCell(row.marginPct,5),row.abc]);
    const alerts = data.rows.filter((row)=>['out','restock','dead','excess'].includes(row.rotation.key)||row.priceBelowCost).map((row)=>[row.code,row.name,row.category,row.rotation.label,row.stock,row.minStock,makeCell(row.inventoryCost,3),row.unitsSold,row.coverageDays==null?'':row.coverageDays,row.priceBelowCost?'Precio menor al costo':'']);
    const noMovement = data.rows.filter((row)=>row.unitsSold<=0&&row.stock>0).sort((a,b)=>b.inventoryCost-a.inventoryCost).map((row)=>[row.code,row.name,row.category,row.stock,makeCell(row.cost,3),makeCell(row.inventoryCost,3),row.lastSale?makeCell(typeof excelDate === 'function'?excelDate(row.lastSale):row.lastSale,4):'',row.daysSinceLast==null?'':row.daysSinceLast]);
    const history = snapshots23().slice().reverse().map((snapshot,index,list)=>{
      const previous=list[index+1];
      return [makeCell(typeof excelDate==='function'?excelDate(snapshot.date||dateKey23(snapshot.createdAt)):snapshot.date,4),snapshot.sourceFile||'',snapshot.importedBy||snapshot.createdByName||'',num23(snapshot.totalUnits),makeCell(num23(snapshot.totalCost),3),makeCell(num23(snapshot.totalSale),3),previous?num23(snapshot.totalUnits)-num23(previous.totalUnits):'',previous?makeCell(num23(snapshot.totalCost)-num23(previous.totalCost),3):''];
    });
    const subtitle = `${periodLabel} · Generado ${new Date().toLocaleString('es-NI')}`;
    return [
      { name:'Resumen inventario',title:'Resumen ejecutivo de inventario',subtitle,headers:['Indicador','Valor'],data:summary,widths:[38,28] },
      { name:'Inventario actual',title:'Inventario actual, valor y desempeño',subtitle,headers:['ABC','Código','Producto','Categoría','Estado','Existencia','Mínimo','Costo unitario','Precio venta','Inventario a costo','Venta potencial','Margen potencial','Unidades vendidas','Ingresos','Costo vendido','Margen generado','Margen %','Cobertura días','Rotación unidades','Rotación monetaria','Estado rotación','Última venta','Días sin venta'],data:inventory,widths:[8,14,28,18,12,12,12,16,16,18,18,18,15,18,18,18,13,15,16,17,18,15,15] },
      { name:'Más vendidos',title:'Productos más vendidos por unidades',subtitle,headers:['Posición','Código','Producto','Categoría','Unidades','Ingresos','Margen','ABC'],data:topUnits,widths:[10,14,28,18,14,18,18,8] },
      { name:'Más rentables',title:'Productos con mayor margen generado',subtitle,headers:['Posición','Código','Producto','Categoría','Unidades','Ingresos','Margen','Margen %','ABC'],data:topMargin,widths:[10,14,28,18,14,18,18,13,8] },
      { name:'Alertas y reposición',title:'Alertas de inventario y reposición',subtitle,headers:['Código','Producto','Categoría','Condición','Existencia','Mínimo','Valor a costo','Unidades vendidas','Cobertura días','Alerta precio'],data:alerts,widths:[14,28,18,18,13,13,18,16,16,24] },
      { name:'Sin movimiento',title:'Inventario sin movimiento',subtitle,headers:['Código','Producto','Categoría','Existencia','Costo unitario','Dinero inmovilizado','Última venta','Días sin venta'],data:noMovement,widths:[14,30,18,13,17,20,15,16] },
      { name:'Historial conteos',title:'Historial de conteos físicos',subtitle,headers:['Fecha','Archivo','Usuario','Unidades','Valor a costo','Venta potencial','Variación unidades','Variación monetaria'],data:history,widths:[14,34,24,14,18,18,18,20] }
    ];
  }

  function exportInventory23() {
    if (typeof makeWorkbook !== 'function') return alert('El generador de Excel no está disponible.');
    makeWorkbook(inventorySheets23(), `INVENTARIO_VENTAS_VICTOR_${currentDay23()}.xlsx`);
    if (typeof toast === 'function') toast('Reporte de inventario Excel generado');
  }

  function printInventory23() {
    const data = buildInventoryRows23();
    const totals = totals23(data);
    const rows = data.rows.slice().sort((a,b)=>b.inventoryCost-a.inventoryCost);
    const popup = window.open('', '_blank');
    if (!popup) return alert('Permita ventanas emergentes para imprimir el reporte.');
    const period = `${data.period.from ? formatDate23(data.period.from) : 'inicio'} al ${formatDate23(data.period.to)}`;
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Inventario y rotación</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial,sans-serif;color:#17211d;font-size:10px}header{border-bottom:4px solid #0b3a2e;padding-bottom:10px;margin-bottom:12px}h1{margin:0;color:#0b3a2e;font-size:22px}p{margin:4px 0;color:#66746e}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0}.kpi{border:1px solid #d9e3df;border-radius:8px;padding:8px}.kpi span{display:block;color:#66746e;font-size:8px;text-transform:uppercase}.kpi b{font-size:14px;color:#0b3a2e}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#eaf3ef;text-align:left}th,td{padding:5px;border:1px solid #dce4e1}td.num,th.num{text-align:right}.note{margin-top:9px;color:#66746e;font-size:8px}</style></head><body><header><h1>${html23(state.settings?.businessName || 'Ventas de Víctor')}</h1><p>Inventario, rotación y análisis de ventas · ${html23(period)}</p></header><div class="kpis"><div class="kpi"><span>Unidades</span><b>${totals.units.toLocaleString('es-NI')}</b></div><div class="kpi"><span>Inventario a costo</span><b>${money23(totals.cost)}</b></div><div class="kpi"><span>Venta potencial</span><b>${money23(totals.sale)}</b></div><div class="kpi"><span>Rotación</span><b>${totals.rotation.toFixed(2)}×</b></div></div><table><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th class="num">Existencia</th><th class="num">Costo</th><th class="num">Valor inventario</th><th class="num">Unidades vendidas</th><th class="num">Ingresos</th><th class="num">Margen</th><th>Condición</th></tr></thead><tbody>${rows.map((row)=>`<tr><td>${html23(row.code||'—')}</td><td>${html23(row.name)}</td><td>${html23(row.category)}</td><td class="num">${row.stock}</td><td class="num">${money23(row.cost)}</td><td class="num">${money23(row.inventoryCost)}</td><td class="num">${row.unitsSold}</td><td class="num">${money23(row.revenue)}</td><td class="num">${money23(row.margin)}</td><td>${html23(row.rotation.label)}</td></tr>`).join('')}</tbody></table><div class="note">${html23(totals.mode)}. Reporte gerencial de control interno; no sustituye inventarios contables o fiscales formales.</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  function wrapReports23() {
    baseRenderReports23 = renderReports;
    baseSetReportTab23 = setReportTab;
    baseExportXLSX23 = exportXLSX;

    renderReports = function renderReportsV23() {
      baseRenderReports23();
      renderInventory23();
    };

    setReportTab = function setReportTabV23(tab, button) {
      if (tab !== 'inventory') return baseSetReportTab23(tab, button);
      const worker = document.getElementById('reportWorker');
      if (worker && worker.value) {
        worker.value = '';
        if (typeof toast === 'function') toast('El inventario se muestra de forma global para todo el negocio');
      }
      reportTab = 'inventory';
      document.querySelectorAll('#reportTabs button').forEach((item) => item.classList.toggle('active', item.dataset.report === 'inventory'));
      document.querySelectorAll('.report-pane').forEach((pane) => pane.classList.add('hidden'));
      document.getElementById('reportInventory')?.classList.remove('hidden');
      renderInventory23();
    };

    exportXLSX = function exportXLSXV23() {
      if (reportTab === 'inventory') return exportInventory23();
      return baseExportXLSX23();
    };

    Object.assign(window, { renderReports, setReportTab, exportXLSX });
  }

  function expose23() {
    Object.assign(window, {
      vv23RenderInventory:renderInventory23,
      vv23ExportInventory:exportInventory23,
      vv23PrintInventory:printInventory23,
      VV23_VERSION,
      VV23_TEST:{ buildInventoryRows23, totals23, overallRotation23, rotationStatus23 }
    });
  }

  async function boot23() {
    if (installed23) return;
    installed23 = true;
    try {
      await waitForApp23();
      normalizeState23();
      installStyles23();
      installUI23();
      wrapReports23();
      expose23();
      renderInventory23();
      const guide = document.querySelector('#guideModal .notice');
      if (guide && !guide.dataset.vv23) {
        guide.dataset.vv23 = '1';
        guide.innerHTML += '<br><br><b>16. Inventario y rotación:</b> en Informes use la pestaña Inventario para conocer existencias, masa monetaria, productos más vendidos, margen, cobertura y alertas.<br><br><b>17. Conteos físicos:</b> cada importación Excel guarda un corte histórico. Con dos cortes en fechas diferentes la app calcula la rotación usando inventario promedio.';
      }
      if (typeof save === 'function') await save(false);
      if (typeof refreshAll === 'function') refreshAll();
      if (typeof toast === 'function') toast('Ventas de Víctor V2.3 · Inventario y rotación listos');
    } catch (error) {
      console.error('Error al iniciar V2.3', error);
      alert(`La mejora V2.3 no pudo iniciar: ${error.message || error}`);
    }
  }

  Object.assign(window, {
    VV23_CALC:{ buildInventoryRows23, totals23, overallRotation23, rotationStatus23, inventorySheets23 }
  });
  if (!window.VV23_SKIP_BOOT) boot23();
})();
