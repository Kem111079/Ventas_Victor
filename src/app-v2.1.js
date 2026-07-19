/* Ventas de Víctor · V2.1 Informes globales y rentabilidad simple */
'use strict';

(() => {
  const VERSION = '2.1.0';
  const EXPENSE_CATEGORIES = [
    'Compra de mercadería / inventario',
    'Transporte',
    'Entregas',
    'Alquiler',
    'Energía y servicios',
    'Teléfono e internet',
    'Publicidad',
    'Salarios o apoyo laboral',
    'Papelería',
    'Mantenimiento',
    'Otros gastos'
  ];
  let installed = false;
  let expenseEditingId = '';

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nowISO21 = () => new Date().toISOString();
  const clone21 = (value) => JSON.parse(JSON.stringify(value));
  const norm21 = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const html21 = (value) => typeof esc === 'function'
    ? esc(value)
    : String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  const active21 = (record) => window.vv2IsActive ? window.vv2IsActive(record) : !!record && record.status !== 'voided' && record.voided !== true;
  const activeList21 = (arr) => (Array.isArray(arr) ? arr.filter(active21) : []);
  const identity21 = () => window.vv2CurrentIdentity ? window.vv2CurrentIdentity() : (state.updatedBy || { userId: 'local', userName: 'Usuario local', role: 'local' });
  const isAdmin21 = () => ['admin', 'local'].includes(identity21()?.role || 'local');
  const num21 = (value) => Number(value) || 0;
  const saleTotal21 = (sale) => num21(sale.qty) * num21(sale.price);
  const saleCost21 = (sale) => num21(sale.qty) * num21(sale.cost);
  const expenseAffectsResult21 = (expense) => expense.affectsResult !== false && norm21(expense.category) !== 'compra de mercaderia / inventario';

  async function waitForV2() {
    for (let i = 0; i < 400; i += 1) {
      if (typeof state !== 'undefined' && state && typeof save === 'function' && window.vv2AllocateDocument && document.getElementById('vv2CloudCard')) return;
      await wait(35);
    }
    throw new Error('La capa operativa V2 no terminó de iniciar.');
  }

  function normalizeFinancialState() {
    state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
    state.counters = { ...(state.counters || {}), expense: num21(state.counters?.expense) };
    state.settings = {
      ...(state.settings || {}),
      financialReportName: state.settings?.financialReportName || 'Estado de resultados estimado',
      expenseCategories: Array.isArray(state.settings?.expenseCategories) && state.settings.expenseCategories.length
        ? state.settings.expenseCategories
        : EXPENSE_CATEGORIES.slice()
    };
    state.expenses.forEach((expense) => {
      expense.id = expense.id || (typeof uid === 'function' ? uid('g') : `g_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      expense.docNo = expense.docNo || '';
      expense.date = expense.date || (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10));
      expense.category = expense.category || 'Otros gastos';
      expense.description = expense.description || expense.concept || 'Gasto';
      expense.amount = num21(expense.amount);
      expense.method = expense.method || 'Efectivo';
      expense.reference = expense.reference || '';
      expense.notes = expense.notes || '';
      expense.affectsResult = expenseAffectsResult21(expense);
      expense.status = expense.status || (expense.voided ? 'voided' : 'active');
      expense.createdAt = expense.createdAt || expense.updatedAt || nowISO21();
      expense.updatedAt = expense.updatedAt || expense.createdAt;
      expense.createdBy = expense.createdBy || '';
      expense.createdByName = expense.createdByName || '';
    });
    state.version = Math.max(num21(state.version), 7);
  }

  function installStyles21() {
    const style = document.createElement('style');
    style.id = 'vv21Styles';
    style.textContent = `
      .vv21-metric-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
      .vv21-financial-card{border-left:4px solid var(--brand-2)}
      .vv21-positive{color:var(--success)!important}.vv21-negative{color:var(--danger)!important}
      .vv21-fin-table{width:100%;border-collapse:collapse;font-size:11px}.vv21-fin-table td{padding:10px 8px;border-bottom:1px solid var(--line)}.vv21-fin-table td:last-child{text-align:right;font-weight:850;white-space:nowrap}.vv21-fin-table tr.strong td{font-weight:950;background:#eef7f3}.vv21-fin-table tr.result td{font-size:14px;font-weight:950;background:#071c2b;color:#fff}.vv21-fin-table tr.subtle td{color:var(--muted);font-size:10px}.vv21-fin-table tr.danger td{color:var(--danger)}
      .vv21-report-note{font-size:10px;line-height:1.45;color:var(--muted);margin-top:8px}.vv21-report-note.warn{color:#7a5000;background:#fff7dd;border:1px solid #f4d77f;border-radius:11px;padding:9px}
      .vv21-expense-actions{display:flex;gap:7px;flex-wrap:wrap}.vv21-expense-card .item-title{display:flex;align-items:center;gap:7px}.vv21-category{display:inline-flex;padding:3px 7px;border-radius:999px;background:#f5f0ff;color:#6941c6;font-size:8px;font-weight:900;text-transform:uppercase}.vv21-cash-only{background:#eff4ff;color:#175cd3}
      .vv21-margin-preview{border:1px solid #d8e5df;border-radius:13px;background:#f7faf8;padding:10px 12px;font-size:10px;color:var(--muted);margin:-4px 0 12px}.vv21-margin-preview b{color:var(--text)}.vv21-margin-preview.loss{border-color:#f2b8b5;background:#fff6f5;color:var(--danger)}
      .vv21-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.vv21-breakdown{display:grid;gap:7px}.vv21-breakdown-row{display:grid;grid-template-columns:minmax(115px,1fr) 1.4fr auto;gap:8px;align-items:center}.vv21-breakdown-row span{font-size:10px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vv21-breakdown-row i{height:8px;background:#e9efec;border-radius:999px;overflow:hidden}.vv21-breakdown-row i:after{content:'';display:block;height:100%;width:var(--w);background:linear-gradient(90deg,var(--brand),#249074);border-radius:999px}.vv21-breakdown-row b{font-size:10px}
      .vv21-modal-list{max-height:310px;overflow:auto;padding-right:2px}.vv21-form-note{font-size:9px;color:var(--muted);line-height:1.4;margin-top:-5px;margin-bottom:10px}
      @media(min-width:720px){.vv21-metric-grid{grid-template-columns:repeat(4,1fr)}}
      @media(max-width:560px){.vv21-grid-3{grid-template-columns:1fr}.vv21-breakdown-row{grid-template-columns:minmax(95px,1fr) 1fr auto}}
    `;
    document.head.appendChild(style);
  }

  function installReportsUI21() {
    const tabs = document.getElementById('reportTabs');
    if (tabs) {
      tabs.innerHTML = `
        <button class="active" data-report="summary" onclick="setReportTab('summary',this)">Resumen</button>
        <button data-report="movements" onclick="setReportTab('movements',this)">Movimientos</button>
        <button data-report="income" onclick="setReportTab('income',this)">Resultados</button>
        <button data-report="cash" onclick="setReportTab('cash',this)">Flujo de caja</button>
        <button data-report="statement" onclick="setReportTab('statement',this)">Estado de cuenta</button>`;
    }

    const filterCard = document.querySelector('#reports .filter-card');
    if (filterCard && !document.getElementById('vv21ScopeNote')) {
      filterCard.insertAdjacentHTML('beforeend', `<div id="vv21ScopeNote" class="vv21-report-note">Mostrando el consolidado de todos los trabajadores.</div>`);
    }

    const summary = document.getElementById('reportSummary');
    if (summary && !document.getElementById('vv21SummaryMetrics')) {
      const firstGrid = summary.querySelector('.metric-grid');
      firstGrid?.insertAdjacentHTML('afterend', `
        <div id="vv21SummaryMetrics" class="vv21-metric-grid">
          <div class="metric"><div class="label">Costo de lo vendido</div><div class="value" id="vv21SummaryCost">C$ 0</div><div class="hint">Según precio de compra</div></div>
          <div class="metric"><div class="label">Margen bruto</div><div class="value" id="vv21SummaryGross">C$ 0</div><div class="hint" id="vv21SummaryGrossPct">0% de las ventas</div></div>
          <div class="metric"><div class="label">Gastos operativos</div><div class="value" id="vv21SummaryExpenses">C$ 0</div><div class="hint">Excluye compras de inventario</div></div>
          <div class="metric vv21-financial-card"><div class="label">Resultado estimado</div><div class="value" id="vv21SummaryNet">C$ 0</div><div class="hint" id="vv21SummaryNetPct">0% de las ventas</div></div>
        </div>
        <div id="vv21CostWarning" class="vv21-report-note warn hidden"></div>`);
    }

    const statement = document.getElementById('reportStatement');
    if (statement && !document.getElementById('reportIncome')) {
      statement.insertAdjacentHTML('beforebegin', `
        <div id="reportIncome" class="report-pane report-nonstatement hidden">
          <div class="metric-grid">
            <div class="metric"><div class="label">Ventas netas</div><div class="value" id="vv21IncomeSales">C$ 0</div><div class="hint">Ventas activas del período</div></div>
            <div class="metric"><div class="label">Margen bruto</div><div class="value" id="vv21IncomeGross">C$ 0</div><div class="hint" id="vv21IncomeGrossPct">0%</div></div>
            <div class="metric"><div class="label">Gastos operativos</div><div class="value" id="vv21IncomeExpenses">C$ 0</div><div class="hint">Gastos que afectan resultado</div></div>
            <div class="metric vv21-financial-card"><div class="label">Resultado estimado</div><div class="value" id="vv21IncomeNet">C$ 0</div><div class="hint" id="vv21IncomeNetPct">0%</div></div>
          </div>
          <div class="grid desktop-two mt10">
            <div class="card"><div class="card-head"><h2>Estado de resultados</h2><button class="btn small secondary no-print" onclick="vv21PrintIncome()">Imprimir / PDF</button></div><div class="table-wrap"><table class="vv21-fin-table"><tbody id="vv21IncomeBody"></tbody></table></div><div id="vv21IncomeNote" class="vv21-report-note"></div></div>
            <div class="card"><div class="card-head"><h2>Gastos por categoría</h2><small>Período seleccionado</small></div><div id="vv21ExpenseBreakdown" class="vv21-breakdown"></div></div>
          </div>
        </div>

        <div id="reportCash" class="report-pane report-nonstatement hidden">
          <div class="metric-grid">
            <div class="metric"><div class="label">Entradas cobradas</div><div class="value" id="vv21CashIn">C$ 0</div><div class="hint">Contado + abonos</div></div>
            <div class="metric"><div class="label">Salidas pagadas</div><div class="value" id="vv21CashOut">C$ 0</div><div class="hint">Todos los egresos</div></div>
            <div class="metric"><div class="label">Compras inventario</div><div class="value" id="vv21CashInventory">C$ 0</div><div class="hint">No se duplica en resultados</div></div>
            <div class="metric vv21-financial-card"><div class="label">Flujo neto</div><div class="value" id="vv21CashNet">C$ 0</div><div class="hint">Entradas menos salidas</div></div>
          </div>
          <div class="grid desktop-two mt10">
            <div class="card"><div class="card-head"><h2>Movimiento de efectivo</h2><button class="btn small secondary no-print" onclick="vv21PrintCash()">Imprimir / PDF</button></div><div class="table-wrap"><table class="vv21-fin-table"><tbody id="vv21CashBody"></tbody></table></div><div class="vv21-report-note">Este reporte explica el dinero que entró y salió. No es lo mismo que la utilidad del período.</div></div>
            <div class="card"><div class="card-head"><h2>Entradas por medio</h2><small>Cobros del período</small></div><div id="vv21MethodBreakdown" class="vv21-breakdown"></div></div>
          </div>
        </div>`);
    }
  }

  function installExpenseUI21() {
    const more = document.getElementById('more');
    if (more && !document.getElementById('vv21ExpenseCard')) {
      const cards = [...more.querySelectorAll('.card')];
      const accounting = cards.find((card) => norm21(card.querySelector('h2')?.textContent).includes('registro contable'));
      const html = `<div class="card" id="vv21ExpenseCard"><div class="card-head"><h2>Gastos y egresos</h2><small>Control financiero simple</small></div><div class="notice">Registre salidas de dinero como transporte, servicios o compras de mercadería. Las compras de inventario afectan el flujo de caja, pero no se duplican como gasto operativo.</div><div class="btn-row mt10"><button class="btn primary" onclick="vv21OpenExpense()">Registrar gasto</button><button class="btn secondary" onclick="vv21OpenExpenseList()">Ver / editar gastos</button></div></div>`;
      if (accounting) accounting.insertAdjacentHTML('afterend', html);
      else more.insertAdjacentHTML('afterbegin', html);
    }

    if (!document.getElementById('vv21ExpenseModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal" id="vv21ExpenseModal"><div class="sheet"><div class="sheet-handle"></div><div class="modal-head"><h3 id="vv21ExpenseTitle">Registrar gasto o egreso</h3><button class="close" onclick="closeModal('vv21ExpenseModal')">×</button></div>
          <form id="vv21ExpenseForm">
            <input id="vv21ExpenseId" type="hidden">
            <div class="grid two"><div class="field"><label>Fecha</label><input id="vv21ExpenseDate" type="date" required></div><div class="field"><label>Documento</label><input id="vv21ExpenseDoc" readonly placeholder="G-AUTO"></div></div>
            <div class="field"><label>Categoría</label><select id="vv21ExpenseCategory" required></select></div>
            <div class="field"><label>Descripción</label><input id="vv21ExpenseDescription" maxlength="120" placeholder="Ej. Transporte de mercadería" required></div>
            <div class="grid two"><div class="field"><label>Monto <em>C$</em></label><input id="vv21ExpenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal" required></div><div class="field"><label>Medio de pago</label><select id="vv21ExpenseMethod"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></div></div>
            <div class="field"><label>Tratamiento financiero</label><select id="vv21ExpenseTreatment"><option value="result">Gasto operativo · afecta resultado</option><option value="cash">Compra de inventario · solo flujo de caja</option></select></div>
            <div class="vv21-form-note">Use “solo flujo de caja” para compra de mercadería, porque el costo se reconoce cuando el producto se vende.</div>
            <div class="field"><label>Referencia <em>Opcional</em></label><input id="vv21ExpenseReference" maxlength="80" placeholder="Factura, recibo o transferencia"></div>
            <div class="field"><label>Observación <em>Opcional</em></label><textarea id="vv21ExpenseNotes" maxlength="240"></textarea></div>
            <button class="btn primary" type="submit">Guardar gasto</button><button class="btn secondary mt8" type="button" onclick="vv21ResetExpenseForm()">Limpiar formulario</button>
          </form>
          <div class="card mt10 mb0"><div class="card-head"><h2>Gastos registrados</h2><small id="vv21ExpenseCount">0 registros</small></div><div class="field"><input id="vv21ExpenseSearch" placeholder="Buscar categoría, descripción o documento..."></div><label class="vv2-inline-check"><input id="vv21ShowVoidedExpenses" type="checkbox"> Mostrar gastos anulados</label><div id="vv21ExpenseList" class="list vv21-modal-list mt10"></div></div>
        </div></div>`);
    }

    const costLabel = document.querySelector('label[for="vv2ProductCost"]') || document.getElementById('vv2ProductCost')?.closest('.field')?.querySelector('label');
    if (costLabel) costLabel.innerHTML = 'Precio de compra / costo unitario <em>C$</em>';

    const saleTotal = document.querySelector('#saleForm .form-total');
    if (saleTotal && !document.getElementById('vv21SaleMargin')) {
      saleTotal.insertAdjacentHTML('afterend', `<div id="vv21SaleMargin" class="vv21-margin-preview">Seleccione un producto para estimar costo y margen.</div>`);
    }
  }

  function categories21() {
    const custom = Array.isArray(state.settings?.expenseCategories) ? state.settings.expenseCategories : [];
    return [...new Set([...EXPENSE_CATEGORIES, ...custom].filter(Boolean))];
  }

  function fillExpenseCategories21() {
    const select = document.getElementById('vv21ExpenseCategory');
    if (!select) return;
    const current = select.value;
    select.innerHTML = categories21().map((category) => `<option value="${html21(category)}">${html21(category)}</option>`).join('');
    select.value = [...select.options].some((option) => option.value === current) ? current : 'Otros gastos';
  }

  function installEvents21() {
    document.getElementById('vv21ExpenseForm')?.addEventListener('submit', saveExpense21);
    document.getElementById('vv21ExpenseSearch')?.addEventListener('input', renderExpenseList21);
    document.getElementById('vv21ShowVoidedExpenses')?.addEventListener('change', renderExpenseList21);
    document.getElementById('vv21ExpenseCategory')?.addEventListener('change', () => {
      const category = document.getElementById('vv21ExpenseCategory').value;
      document.getElementById('vv21ExpenseTreatment').value = norm21(category) === 'compra de mercaderia / inventario' ? 'cash' : 'result';
    });
    ['saleProduct', 'saleQty', 'salePrice'].forEach((id) => document.getElementById(id)?.addEventListener('input', renderSaleMargin21));
    document.getElementById('saleProduct')?.addEventListener('change', renderSaleMargin21);
    document.getElementById('reportWorker')?.addEventListener('change', updateScopeNote21);
  }

  function getWorkerFilter21() {
    const raw = String(document.getElementById('reportWorker')?.value || '').trim();
    if (!raw || ['todos', 'todos los trabajadores', '__all__'].includes(norm21(raw))) return '';
    return raw;
  }

  function workerMatches21(record, selector) {
    if (!selector) return true;
    const selected = state.workers.find((worker) => worker.id === selector || norm21(worker.name) === norm21(selector));
    if (selected) return record.workerId === selected.id || (!record.workerId && norm21(record.worker) === norm21(selected.name));
    return norm21(record.worker) === norm21(selector);
  }

  function getReportData21() {
    const from = document.getElementById('reportFrom')?.value || '';
    const to = document.getElementById('reportTo')?.value || '';
    const worker = getWorkerFilter21();
    const inDate = (record) => (!from || record.date >= from) && (!to || record.date <= to);
    return {
      from,
      to,
      worker,
      sales: activeList21(state.sales).filter((record) => inDate(record) && workerMatches21(record, worker)),
      payments: activeList21(state.payments).filter((record) => inDate(record) && workerMatches21(record, worker)),
      adjustments: activeList21(state.adjustments).filter((record) => inDate(record) && workerMatches21(record, worker)),
      expenses: worker ? [] : activeList21(state.expenses).filter(inDate)
    };
  }

  function financialTotals21(data = getReportData21()) {
    const sales = data.sales.reduce((sum, sale) => sum + saleTotal21(sale), 0);
    const cashSales = data.sales.filter((sale) => sale.type === 'Contado').reduce((sum, sale) => sum + saleTotal21(sale), 0);
    const creditSales = data.sales.filter((sale) => sale.type === 'Crédito').reduce((sum, sale) => sum + saleTotal21(sale), 0);
    const collections = data.payments.reduce((sum, payment) => sum + num21(payment.amount), 0);
    const cost = data.sales.reduce((sum, sale) => sum + saleCost21(sale), 0);
    const gross = sales - cost;
    const operatingExpenses = data.expenses.filter(expenseAffectsResult21).reduce((sum, expense) => sum + num21(expense.amount), 0);
    const inventoryPurchases = data.expenses.filter((expense) => !expenseAffectsResult21(expense)).reduce((sum, expense) => sum + num21(expense.amount), 0);
    const totalExpenses = data.expenses.reduce((sum, expense) => sum + num21(expense.amount), 0);
    const net = gross - operatingExpenses;
    const cashIn = cashSales + collections;
    const cashNet = cashIn - totalExpenses;
    const missingCost = data.sales.filter((sale) => num21(sale.cost) <= 0).length;
    const voidedSales = (state.sales || []).filter((sale) => !active21(sale) && (!data.from || sale.date >= data.from) && (!data.to || sale.date <= data.to) && workerMatches21(sale, data.worker)).reduce((sum, sale) => sum + saleTotal21(sale), 0);
    return { sales, cashSales, creditSales, collections, cost, gross, operatingExpenses, inventoryPurchases, totalExpenses, net, cashIn, cashNet, missingCost, voidedSales };
  }

  function pct21(value, base) {
    return base ? `${(value / base * 100).toFixed(1)}%` : '0.0%';
  }

  function renderBreakdown21(targetId, map, emptyText = 'No hay información para mostrar.') {
    const target = document.getElementById(targetId);
    if (!target) return;
    const rows = Object.entries(map).filter(([, value]) => Math.abs(value) > 0.0001).sort((a, b) => b[1] - a[1]);
    const max = rows[0]?.[1] || 1;
    target.innerHTML = rows.length ? rows.map(([label, value]) => `<div class="vv21-breakdown-row"><span title="${html21(label)}">${html21(label)}</span><i style="--w:${Math.max(2, value / max * 100)}%"></i><b>${money(value)}</b></div>`).join('') : `<div class="empty">${html21(emptyText)}</div>`;
  }

  function updateScopeNote21() {
    const note = document.getElementById('vv21ScopeNote');
    if (!note) return;
    const worker = getWorkerFilter21();
    note.textContent = worker
      ? `Mostrando movimientos de ${worker}. Los gastos generales solo se incorporan en los estados financieros globales.`
      : 'Mostrando el consolidado global de todos los trabajadores, ventas, cobros y egresos.';
  }

  function renderSummary21() {
    const data = getReportData21();
    const totals = financialTotals21(data);
    document.getElementById('rSales').textContent = money(totals.sales);
    document.getElementById('rCash').textContent = money(totals.cashSales);
    document.getElementById('rCredit').textContent = money(totals.creditSales);
    document.getElementById('rPayments').textContent = money(totals.collections);
    document.getElementById('rSalesCount').textContent = `${data.sales.length} línea${data.sales.length === 1 ? '' : 's'} de venta`;
    document.getElementById('rPaymentCount').textContent = `${data.payments.length} cobro${data.payments.length === 1 ? '' : 's'}`;

    document.getElementById('vv21SummaryCost').textContent = money(totals.cost);
    document.getElementById('vv21SummaryGross').textContent = money(totals.gross);
    document.getElementById('vv21SummaryGross').className = `value ${totals.gross < 0 ? 'vv21-negative' : 'vv21-positive'}`;
    document.getElementById('vv21SummaryGrossPct').textContent = `${pct21(totals.gross, totals.sales)} de las ventas`;
    document.getElementById('vv21SummaryExpenses').textContent = money(totals.operatingExpenses);
    document.getElementById('vv21SummaryNet').textContent = money(totals.net);
    document.getElementById('vv21SummaryNet').className = `value ${totals.net < 0 ? 'vv21-negative' : 'vv21-positive'}`;
    document.getElementById('vv21SummaryNetPct').textContent = `${pct21(totals.net, totals.sales)} de las ventas`;

    const costWarning = document.getElementById('vv21CostWarning');
    if (totals.missingCost > 0) {
      costWarning.classList.remove('hidden');
      costWarning.textContent = `${totals.missingCost} línea(s) de venta no tienen precio de compra registrado. El margen y el resultado pueden aparecer mayores de lo real.`;
    } else {
      costWarning.classList.add('hidden');
    }

    const workers = {};
    data.sales.forEach((sale) => { workers[sale.worker] = num21(workers[sale.worker]) + saleTotal21(sale); });
    renderRanking('workerRanking', workers, 'Sin ventas en el período.');
    const products = {};
    data.sales.forEach((sale) => { products[sale.product] = num21(products[sale.product]) + saleTotal21(sale); });
    renderRanking('productRanking', products, 'Sin productos en el período.');

    const sums = accountSummary(data.worker, data.to)
      .filter((row) => Math.abs(row.balance) > 0.005 || row.cash || row.credit || row.payments)
      .sort((a, b) => b.balance - a.balance);
    const balances = document.getElementById('reportBalances');
    balances.innerHTML = sums.length ? sums.map((row) => {
      const encoded = encodeURIComponent(row.worker);
      return `<div class="item"><div class="item-main"><div><div class="item-title">${html21(row.worker)}</div><div class="item-sub">Crédito ${money(row.credit + row.adjCharges)} · Abonos/créditos ${money(row.payments + row.adjCredits)}</div></div><div class="balance ${row.balance < 0 ? 'credit' : row.balance === 0 ? 'ok' : ''}">${row.balance < 0 ? 'A favor ' : ''}${money(Math.abs(row.balance))}</div></div><div class="item-actions"><button class="statement" onclick="openStatement(decodeURIComponent('${encoded}'))">Generar estado de cuenta</button></div></div>`;
    }).join('') : '<div class="empty">No hay saldos para mostrar.</div>';
    updateScopeNote21();
  }

  function expenseMovement21(expense) {
    return {
      id: expense.id,
      date: expense.date,
      time: String(expense.updatedAt || expense.createdAt || '').slice(11, 19),
      docNo: expense.docNo || 'G-S/N',
      worker: 'Negocio',
      kind: active21(expense) ? 'Gasto / egreso' : 'Gasto anulado',
      detail: `${expense.category} · ${expense.description}`,
      source: 'expense',
      amount: num21(expense.amount),
      raw: expense,
      voided: !active21(expense)
    };
  }

  function reportMovements21() {
    const data = getReportData21();
    const showVoided = !!document.getElementById('vv2ShowVoided')?.checked;
    const query = norm21(document.getElementById('movementSearch')?.value || '');
    const baseMovements = allMovements({ worker: data.worker, from: data.from, to: data.to, includeVoided: showVoided });
    const expenseSource = data.worker ? [] : (state.expenses || [])
      .filter((expense) => (showVoided || active21(expense)) && (!data.from || expense.date >= data.from) && (!data.to || expense.date <= data.to))
      .map(expenseMovement21);
    return [...baseMovements, ...expenseSource]
      .filter((movement) => norm21(`${movement.worker} ${movement.docNo} ${movement.detail} ${movement.kind}`).includes(query))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.time || '').localeCompare(String(a.time || '')) || String(b.docNo || '').localeCompare(String(a.docNo || '')));
  }

  function renderMovements21() {
    const arr = reportMovements21();
    const count = document.getElementById('movementCount');
    if (count) count.textContent = `${arr.length} registro${arr.length === 1 ? '' : 's'}`;
    const list = document.getElementById('movementList');
    if (!list) return;
    list.innerHTML = arr.length ? arr.map((movement) => {
      const raw = movement.raw || {};
      let tag;
      if (movement.voided) tag = '<span class="vv2-status-pill voided">Anulado</span>';
      else if (movement.source === 'sale') tag = raw.type === 'Crédito' ? '<span class="tag credit">Venta crédito</span>' : '<span class="tag cash">Venta contado</span>';
      else if (movement.source === 'payment') tag = '<span class="tag payment">Abono</span>';
      else if (movement.source === 'expense') tag = `<span class="vv21-category ${expenseAffectsResult21(raw) ? '' : 'vv21-cash-only'}">${expenseAffectsResult21(raw) ? 'Gasto' : 'Inventario'}</span>`;
      else tag = '<span class="tag adjust">Ajuste</span>';

      const amount = movement.source === 'expense'
        ? num21(raw.amount)
        : movement.voided
          ? (movement.source === 'sale' ? saleTotal21(raw) : num21(raw.amount))
          : (movement.cash || movement.debit || movement.credit || 0);
      let actions = '';
      if (movement.source === 'expense') {
        actions = movement.voided
          ? `<button class="edit" onclick="vv21RestoreExpense('${movement.id}')">Restaurar</button>`
          : `<button class="edit" onclick="vv21EditExpense('${movement.id}')">Editar</button><button class="delete" onclick="vv21VoidExpense('${movement.id}')">Anular</button>`;
      } else if (movement.voided) {
        actions = `<button class="edit" onclick="vv2RestoreRecord('${movement.source}','${movement.id}')">Restaurar</button>`;
      } else if (movement.source === 'sale') {
        actions = `<button class="edit" onclick="editSale('${movement.id}')">Editar</button><button class="delete" onclick="deleteSale('${movement.id}')">Anular</button>`;
      } else if (movement.source === 'payment') {
        actions = `<button class="edit" onclick="editPayment('${movement.id}')">Editar</button><button class="delete" onclick="deletePayment('${movement.id}')">Anular</button>`;
      } else {
        actions = `<button class="edit" onclick="editAdjustment('${movement.id}')">Editar</button><button class="delete" onclick="deleteAdjustment('${movement.id}')">Anular</button>`;
      }
      const creator = raw.createdByName ? ` · por ${html21(raw.createdByName)}` : '';
      return `<div class="item ${movement.voided ? 'vv2-voided' : ''}"><div class="item-main"><div><div class="item-title">${html21(movement.worker)}</div><div class="item-sub">${fmtDate(movement.date)} · ${html21(movement.docNo)} · ${html21(movement.detail)}${creator}</div>${tag}</div><div class="amount">${money(amount)}</div></div><div class="item-actions">${actions}</div></div>`;
    }).join('') : '<div class="empty">No se encontraron movimientos para los filtros seleccionados.</div>';
  }

  function renderIncome21() {
    const data = getReportData21();
    const totals = financialTotals21(data);
    document.getElementById('vv21IncomeSales').textContent = money(totals.sales);
    document.getElementById('vv21IncomeGross').textContent = money(totals.gross);
    document.getElementById('vv21IncomeGross').className = `value ${totals.gross < 0 ? 'vv21-negative' : 'vv21-positive'}`;
    document.getElementById('vv21IncomeGrossPct').textContent = pct21(totals.gross, totals.sales);
    document.getElementById('vv21IncomeExpenses').textContent = money(totals.operatingExpenses);
    document.getElementById('vv21IncomeNet').textContent = money(totals.net);
    document.getElementById('vv21IncomeNet').className = `value ${totals.net < 0 ? 'vv21-negative' : 'vv21-positive'}`;
    document.getElementById('vv21IncomeNetPct').textContent = pct21(totals.net, totals.sales);

    document.getElementById('vv21IncomeBody').innerHTML = `
      <tr><td>Ventas brutas activas</td><td>${money(totals.sales)}</td></tr>
      <tr class="subtle"><td>Ventas anuladas excluidas (informativo)</td><td>${money(totals.voidedSales)}</td></tr>
      <tr class="strong"><td>Ventas netas</td><td>${money(totals.sales)}</td></tr>
      <tr><td>Menos: costo de productos vendidos</td><td>(${money(totals.cost)})</td></tr>
      <tr class="strong"><td>Margen bruto</td><td>${money(totals.gross)}</td></tr>
      <tr><td>Menos: gastos operativos</td><td>(${money(totals.operatingExpenses)})</td></tr>
      <tr class="result"><td>Resultado neto estimado</td><td>${money(totals.net)}</td></tr>`;

    const note = document.getElementById('vv21IncomeNote');
    const period = `${data.from ? fmtDate(data.from) : 'inicio'} al ${data.to ? fmtDate(data.to) : 'hoy'}`;
    note.className = `vv21-report-note${totals.missingCost ? ' warn' : ''}`;
    note.textContent = totals.missingCost
      ? `Período ${period}. Hay ${totals.missingCost} línea(s) sin precio de compra; complete los costos para obtener un resultado más confiable.`
      : `Período ${period}. Resultado gerencial estimado; no sustituye estados contables o fiscales formales.`;

    const categoryMap = {};
    data.expenses.filter(expenseAffectsResult21).forEach((expense) => { categoryMap[expense.category] = num21(categoryMap[expense.category]) + num21(expense.amount); });
    renderBreakdown21('vv21ExpenseBreakdown', categoryMap, 'No hay gastos operativos registrados en el período.');
  }

  function renderCash21() {
    const data = getReportData21();
    const totals = financialTotals21(data);
    document.getElementById('vv21CashIn').textContent = money(totals.cashIn);
    document.getElementById('vv21CashOut').textContent = money(totals.totalExpenses);
    document.getElementById('vv21CashInventory').textContent = money(totals.inventoryPurchases);
    document.getElementById('vv21CashNet').textContent = money(totals.cashNet);
    document.getElementById('vv21CashNet').className = `value ${totals.cashNet < 0 ? 'vv21-negative' : 'vv21-positive'}`;
    document.getElementById('vv21CashBody').innerHTML = `
      <tr><td>Ventas al contado</td><td>${money(totals.cashSales)}</td></tr>
      <tr><td>Abonos recibidos</td><td>${money(totals.collections)}</td></tr>
      <tr class="strong"><td>Total entradas cobradas</td><td>${money(totals.cashIn)}</td></tr>
      <tr><td>Compras de inventario pagadas</td><td>(${money(totals.inventoryPurchases)})</td></tr>
      <tr><td>Gastos operativos pagados</td><td>(${money(totals.operatingExpenses)})</td></tr>
      <tr class="strong"><td>Total salidas</td><td>(${money(totals.totalExpenses)})</td></tr>
      <tr class="result"><td>Flujo neto del período</td><td>${money(totals.cashNet)}</td></tr>`;

    const methods = {};
    data.sales.filter((sale) => sale.type === 'Contado').forEach((sale) => { methods['Ventas contado'] = num21(methods['Ventas contado']) + saleTotal21(sale); });
    data.payments.forEach((payment) => { methods[payment.method || 'Otro'] = num21(methods[payment.method || 'Otro']) + num21(payment.amount); });
    renderBreakdown21('vv21MethodBreakdown', methods, 'No hay entradas cobradas en el período.');
  }

  function renderReports21() {
    if (!state) return;
    renderSummary21();
    renderMovements21();
    renderIncome21();
    renderCash21();
    renderStatement();
    updateScopeNote21();
  }

  function setReportTab21(tab, button) {
    const allowed = ['summary', 'movements', 'income', 'cash', 'statement'];
    const selected = allowed.includes(tab) ? tab : 'summary';
    if (['income', 'cash'].includes(selected)) {
      const worker = document.getElementById('reportWorker');
      if (worker && worker.value) {
        worker.value = '';
        toast('El estado financiero se muestra de forma global para todo el negocio');
      }
    }
    reportTab = selected;
    document.querySelectorAll('#reportTabs button').forEach((item) => item.classList.toggle('active', item.dataset.report === selected));
    document.querySelectorAll('.report-pane').forEach((pane) => pane.classList.add('hidden'));
    const map = { summary: 'reportSummary', movements: 'reportMovements', income: 'reportIncome', cash: 'reportCash', statement: 'reportStatement' };
    document.getElementById(map[selected])?.classList.remove('hidden');
    renderReports21();
  }

  function renderSaleMargin21() {
    const target = document.getElementById('vv21SaleMargin');
    if (!target) return;
    const productId = document.getElementById('saleProduct')?.value || '';
    const product = state.products.find((item) => item.id === productId || norm21(item.name) === norm21(productId));
    const qty = num21(document.getElementById('saleQty')?.value);
    const price = num21(document.getElementById('salePrice')?.value);
    if (!product || qty <= 0) {
      target.className = 'vv21-margin-preview';
      target.textContent = 'Seleccione un producto y cantidad para estimar costo y margen.';
      return;
    }
    const cost = qty * num21(product.cost);
    const salesValue = qty * price;
    const margin = salesValue - cost;
    const percentage = salesValue ? margin / salesValue * 100 : 0;
    target.className = `vv21-margin-preview${margin < 0 ? ' loss' : ''}`;
    target.innerHTML = `Costo estimado: <b>${money(cost)}</b> · Margen bruto: <b>${money(margin)}</b> (${percentage.toFixed(1)}%)${num21(product.cost) <= 0 ? ' · Falta registrar precio de compra' : ''}`;
  }

  function resetExpenseForm21() {
    expenseEditingId = '';
    document.getElementById('vv21ExpenseForm')?.reset();
    document.getElementById('vv21ExpenseId').value = '';
    document.getElementById('vv21ExpenseDate').value = today();
    document.getElementById('vv21ExpenseDoc').value = '';
    document.getElementById('vv21ExpenseTreatment').value = 'result';
    document.getElementById('vv21ExpenseTitle').textContent = 'Registrar gasto o egreso';
    fillExpenseCategories21();
    document.getElementById('vv21ExpenseCategory').value = 'Otros gastos';
  }

  function openExpense21(id = '') {
    if (!isAdmin21()) return toast('Solo un administrador puede registrar gastos.');
    document.getElementById('vv21ExpenseModal').classList.add('show');
    if (id) editExpense21(id);
    else resetExpenseForm21();
    renderExpenseList21();
  }

  function openExpenseList21() {
    document.getElementById('vv21ExpenseModal').classList.add('show');
    resetExpenseForm21();
    renderExpenseList21();
    setTimeout(() => document.getElementById('vv21ExpenseSearch')?.focus(), 100);
  }

  function editExpense21(id) {
    if (!isAdmin21()) return toast('Solo un administrador puede editar gastos.');
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense) return;
    expenseEditingId = id;
    document.getElementById('vv21ExpenseModal').classList.add('show');
    document.getElementById('vv21ExpenseId').value = id;
    document.getElementById('vv21ExpenseDate').value = expense.date;
    document.getElementById('vv21ExpenseDoc').value = expense.docNo;
    fillExpenseCategories21();
    document.getElementById('vv21ExpenseCategory').value = expense.category;
    document.getElementById('vv21ExpenseDescription').value = expense.description;
    document.getElementById('vv21ExpenseAmount').value = expense.amount;
    document.getElementById('vv21ExpenseMethod').value = expense.method;
    document.getElementById('vv21ExpenseTreatment').value = expenseAffectsResult21(expense) ? 'result' : 'cash';
    document.getElementById('vv21ExpenseReference').value = expense.reference || '';
    document.getElementById('vv21ExpenseNotes').value = expense.notes || '';
    document.getElementById('vv21ExpenseTitle').textContent = `Editar gasto · ${expense.docNo}`;
    renderExpenseList21();
  }

  async function saveExpense21(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isAdmin21()) return toast('Solo un administrador puede registrar gastos.');
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    form.dataset.busy = '1';
    const submit = form.querySelector('[type="submit"]');
    const original = submit.innerHTML;
    submit.disabled = true;
    submit.textContent = 'Guardando…';
    try {
      const id = document.getElementById('vv21ExpenseId').value || expenseEditingId;
      const previous = id ? state.expenses.find((item) => item.id === id) : null;
      const date = document.getElementById('vv21ExpenseDate').value;
      const category = document.getElementById('vv21ExpenseCategory').value;
      const description = document.getElementById('vv21ExpenseDescription').value.trim();
      const amount = num21(document.getElementById('vv21ExpenseAmount').value);
      const method = document.getElementById('vv21ExpenseMethod').value;
      const affectsResult = document.getElementById('vv21ExpenseTreatment').value === 'result';
      const reference = document.getElementById('vv21ExpenseReference').value.trim();
      const notes = document.getElementById('vv21ExpenseNotes').value.trim();
      if (!date || !category || !description || amount <= 0) throw new Error('Complete fecha, categoría, descripción y monto.');
      const identity = identity21();
      const docNo = previous?.docNo || await window.vv2AllocateDocument('G');
      const expense = {
        ...(previous || {}),
        id: previous?.id || (typeof uid === 'function' ? uid('g') : `g_${Date.now()}`),
        docNo,
        date,
        category,
        description,
        amount,
        method,
        affectsResult,
        reference,
        notes,
        status: previous?.status || 'active',
        createdAt: previous?.createdAt || nowISO21(),
        createdBy: previous?.createdBy || identity.userId,
        createdByName: previous?.createdByName || identity.userName,
        updatedAt: nowISO21(),
        updatedBy: identity.userId,
        updatedByName: identity.userName
      };
      if (previous) {
        const ok = await askConfirmation({
          title: 'Confirmar edición de gasto',
          heading: `Actualizar ${expense.docNo}`,
          message: 'La modificación quedará registrada en auditoría.',
          detail: `<b>${html21(previous.description)}</b> · ${money(previous.amount)}<br>Nuevo: <b>${html21(expense.description)}</b> · ${money(expense.amount)}`,
          confirmText: 'Guardar cambios',
          requireReason: true
        });
        if (!ok) return;
        state.expenses[state.expenses.findIndex((item) => item.id === previous.id)] = expense;
        audit('Edición', 'Gasto', expense.docNo, `Gasto modificado: ${expense.description}`, clone21(previous), clone21(expense));
      } else {
        state.expenses.push(expense);
        audit('Creación', 'Gasto', expense.docNo, `Gasto registrado: ${expense.description}`, null, clone21(expense));
      }
      state.counters.expense = Math.max(num21(state.counters.expense), num21(String(docNo).match(/G-(\d+)$/)?.[1]));
      await save();
      resetExpenseForm21();
      refreshAll();
      renderExpenseList21();
      toast(`Gasto ${previous ? 'actualizado' : 'registrado'} y sincronizado`);
    } catch (error) {
      alert(error.message || 'No fue posible guardar el gasto.');
    } finally {
      form.dataset.busy = '0';
      submit.disabled = false;
      submit.innerHTML = original;
    }
  }

  async function voidExpense21(id) {
    if (!isAdmin21()) return toast('Solo un administrador puede anular gastos.');
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense || !active21(expense)) return;
    const before = clone21(expense);
    const ok = await askConfirmation({
      title: 'Anular gasto',
      heading: `Anular ${expense.docNo}`,
      message: 'El egreso dejará de afectar los informes, pero se conservará en auditoría.',
      detail: `<b>${html21(expense.description)}</b><br>${html21(expense.category)} · ${money(expense.amount)}`,
      confirmText: 'Anular gasto',
      danger: true,
      requiredWord: 'ANULAR',
      requireReason: true
    });
    if (!ok) return;
    expense.status = 'voided';
    expense.voided = true;
    expense.voidedAt = nowISO21();
    expense.updatedAt = nowISO21();
    expense.updatedBy = identity21().userId;
    expense.updatedByName = identity21().userName;
    audit('Anulación', 'Gasto', expense.docNo, `Gasto anulado: ${expense.description}`, before, clone21(expense));
    await save();
    refreshAll();
    renderExpenseList21();
    toast('Gasto anulado; el historial se conserva');
  }

  async function restoreExpense21(id) {
    if (!isAdmin21()) return toast('Solo un administrador puede restaurar gastos.');
    const expense = state.expenses.find((item) => item.id === id);
    if (!expense || active21(expense)) return;
    const before = clone21(expense);
    const ok = await askConfirmation({
      title: 'Restaurar gasto',
      heading: `Restaurar ${expense.docNo}`,
      message: 'El gasto volverá a afectar los informes financieros.',
      detail: `<b>${html21(expense.description)}</b> · ${money(expense.amount)}`,
      confirmText: 'Restaurar',
      requireReason: true
    });
    if (!ok) return;
    expense.status = 'active';
    expense.voided = false;
    expense.voidedAt = '';
    expense.updatedAt = nowISO21();
    expense.updatedBy = identity21().userId;
    expense.updatedByName = identity21().userName;
    audit('Restauración', 'Gasto', expense.docNo, `Gasto restaurado: ${expense.description}`, before, clone21(expense));
    await save();
    refreshAll();
    renderExpenseList21();
    toast('Gasto restaurado');
  }

  function renderExpenseList21() {
    const list = document.getElementById('vv21ExpenseList');
    if (!list) return;
    const query = norm21(document.getElementById('vv21ExpenseSearch')?.value || '');
    const showVoided = !!document.getElementById('vv21ShowVoidedExpenses')?.checked;
    const rows = (state.expenses || [])
      .filter((expense) => (showVoided || active21(expense)) && norm21(`${expense.docNo} ${expense.category} ${expense.description} ${expense.method} ${expense.reference}`).includes(query))
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    document.getElementById('vv21ExpenseCount').textContent = `${rows.length} registro${rows.length === 1 ? '' : 's'}`;
    list.innerHTML = rows.length ? rows.map((expense) => `<div class="item vv21-expense-card ${active21(expense) ? '' : 'vv2-voided'}"><div class="item-main"><div><div class="item-title">${html21(expense.description)}</div><div class="item-sub">${fmtDate(expense.date)} · ${html21(expense.docNo)} · ${html21(expense.method)}${expense.reference ? ` · ${html21(expense.reference)}` : ''}</div><span class="vv21-category ${expenseAffectsResult21(expense) ? '' : 'vv21-cash-only'}">${html21(expense.category)}</span>${active21(expense) ? '' : '<span class="vv2-status-pill voided">Anulado</span>'}</div><div class="amount">${money(expense.amount)}</div></div><div class="item-actions">${active21(expense) ? `<button class="edit" onclick="vv21EditExpense('${expense.id}')">Editar</button><button class="delete" onclick="vv21VoidExpense('${expense.id}')">Anular</button>` : `<button class="edit" onclick="vv21RestoreExpense('${expense.id}')">Restaurar</button>`}</div></div>`).join('') : '<div class="empty">No hay gastos registrados.</div>';
  }

  function reportPeriodLabel21(data = getReportData21()) {
    return `${data.from ? fmtDate(data.from) : 'inicio'} al ${data.to ? fmtDate(data.to) : 'hoy'}`;
  }

  function printFinancial21(kind) {
    const data = getReportData21();
    const totals = financialTotals21(data);
    const isIncome = kind === 'income';
    const title = isIncome ? 'Estado de resultados estimado' : 'Flujo de caja';
    const rows = isIncome ? [
      ['Ventas netas', totals.sales],
      ['Costo de productos vendidos', -totals.cost],
      ['Margen bruto', totals.gross],
      ['Gastos operativos', -totals.operatingExpenses],
      ['Resultado neto estimado', totals.net]
    ] : [
      ['Ventas al contado', totals.cashSales],
      ['Abonos recibidos', totals.collections],
      ['Total entradas', totals.cashIn],
      ['Compras inventario', -totals.inventoryPurchases],
      ['Gastos operativos', -totals.operatingExpenses],
      ['Flujo neto', totals.cashNet]
    ];
    const popup = window.open('', '_blank');
    if (!popup) return alert('Permita ventanas emergentes para imprimir el reporte.');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${html21(title)}</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;color:#17211d}header{border-bottom:4px solid #071c2b;padding-bottom:12px;margin-bottom:20px}h1{color:#071c2b;margin:0;font-size:24px}p{color:#66746e}table{width:100%;border-collapse:collapse}td{padding:11px;border-bottom:1px solid #dfe7e3}td:last-child{text-align:right;font-weight:bold}tr:last-child td{background:#071c2b;color:white;font-size:16px}.note{font-size:10px;color:#66746e;margin-top:16px}</style></head><body><header><h1>${html21(state.settings.businessName)}</h1><p>${html21(title)} · ${html21(reportPeriodLabel21(data))}</p></header><table>${rows.map(([label, value]) => `<tr><td>${html21(label)}</td><td>${value < 0 ? '(' + money(Math.abs(value)) + ')' : money(value)}</td></tr>`).join('')}</table><div class="note">Reporte gerencial sencillo para control interno. No sustituye estados contables o fiscales formales.</div><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  function exportXLSX21() {
    const data = getReportData21();
    const totals = financialTotals21(data);
    const subtitle = `Período ${reportPeriodLabel21(data)} · Generado ${new Date().toLocaleString('es-NI')}`;
    const movements = reportMovements21().slice().reverse().map((movement) => {
      const raw = movement.raw || {};
      const value = movement.source === 'expense' ? num21(raw.amount) : movement.source === 'sale' ? saleTotal21(raw) : num21(raw.amount) || movement.debit || movement.credit || movement.cash;
      return [cell(excelDate(movement.date), 4), movement.docNo, movement.worker, movement.kind, movement.detail, cell(value, 3), movement.voided ? 'Anulado' : 'Activo', raw.createdByName || ''];
    });
    const sales = data.sales.map((sale) => {
      const total = saleTotal21(sale), cost = saleCost21(sale), margin = total - cost;
      return [sale.docNo, cell(excelDate(sale.date), 4), sale.worker, sale.product, cell(num21(sale.qty), 0), cell(num21(sale.price), 3), cell(total, 3), cell(num21(sale.cost), 3), cell(cost, 3), cell(margin, 3), cell(total ? margin / total : 0, 5), sale.type, sale.createdByName || ''];
    });
    const expenses = data.expenses.map((expense) => [expense.docNo, cell(excelDate(expense.date), 4), expense.category, expense.description, cell(num21(expense.amount), 3), expense.method, expenseAffectsResult21(expense) ? 'Gasto operativo' : 'Solo flujo de caja', expense.reference || '', expense.createdByName || '', expense.notes || '']);
    const payments = data.payments.map((payment) => [payment.docNo, cell(excelDate(payment.date), 4), payment.worker, cell(num21(payment.amount), 3), payment.method, payment.reference || '', payment.createdByName || '', payment.notes || '']);
    const balances = accountSummary('', data.to).map((row) => [row.worker, cell(row.cash, 3), cell(row.credit, 3), cell(row.payments, 3), cell(row.balance, 3), row.balance > 0.005 ? 'Pendiente' : row.balance < -0.005 ? 'Saldo a favor' : 'Cancelado']);
    const auditRows = (state.auditLog || []).map((log) => [new Date(log.dateTime).toLocaleString('es-NI'), log.action, log.recordType, log.docNo || '', log.detail || '', log.userName || '']);
    const resultRows = [
      ['Ventas netas', cell(totals.sales, 3)],
      ['Costo de productos vendidos', cell(-totals.cost, 3)],
      ['Margen bruto', cell(totals.gross, 3)],
      ['Gastos operativos', cell(-totals.operatingExpenses, 3)],
      ['Resultado neto estimado', cell(totals.net, 3)],
      ['Margen bruto %', cell(totals.sales ? totals.gross / totals.sales : 0, 5)],
      ['Resultado neto %', cell(totals.sales ? totals.net / totals.sales : 0, 5)]
    ];
    const cashRows = [
      ['Ventas al contado', cell(totals.cashSales, 3)],
      ['Abonos recibidos', cell(totals.collections, 3)],
      ['Total entradas', cell(totals.cashIn, 3)],
      ['Compras de inventario', cell(-totals.inventoryPurchases, 3)],
      ['Gastos operativos', cell(-totals.operatingExpenses, 3)],
      ['Total salidas', cell(-totals.totalExpenses, 3)],
      ['Flujo neto', cell(totals.cashNet, 3)]
    ];
    const overview = [
      ['Ventas totales', cell(totals.sales, 3)], ['Ventas contado', cell(totals.cashSales, 3)], ['Ventas crédito', cell(totals.creditSales, 3)],
      ['Cobros recibidos', cell(totals.collections, 3)], ['Costo de lo vendido', cell(totals.cost, 3)], ['Margen bruto', cell(totals.gross, 3)],
      ['Gastos operativos', cell(totals.operatingExpenses, 3)], ['Resultado estimado', cell(totals.net, 3)], ['Flujo neto', cell(totals.cashNet, 3)]
    ];
    const sheets = [
      { name: 'Resumen financiero', title: state.settings.businessName, subtitle, headers: ['Indicador', 'Valor'], data: overview, widths: [34, 20] },
      { name: 'Estado de resultados', title: 'Estado de resultados estimado', subtitle, headers: ['Concepto', 'Valor'], data: resultRows, widths: [38, 20] },
      { name: 'Flujo de caja', title: 'Flujo de caja', subtitle, headers: ['Concepto', 'Valor'], data: cashRows, widths: [38, 20] },
      { name: 'Movimientos', title: 'Libro global de movimientos', subtitle, headers: ['Fecha', 'Documento', 'Trabajador / ámbito', 'Tipo', 'Detalle', 'Monto', 'Estado', 'Registrado por'], data: movements, widths: [13, 16, 25, 20, 38, 18, 12, 24] },
      { name: 'Ventas y margen', title: 'Ventas, costos y margen', subtitle, headers: ['Documento', 'Fecha', 'Trabajador', 'Producto', 'Cantidad', 'Precio venta', 'Venta total', 'Costo unitario', 'Costo total', 'Margen bruto', 'Margen %', 'Condición', 'Registrado por'], data: sales, widths: [15, 13, 25, 25, 11, 16, 16, 16, 16, 16, 13, 13, 24] },
      { name: 'Gastos', title: 'Gastos y egresos', subtitle, headers: ['Documento', 'Fecha', 'Categoría', 'Descripción', 'Monto', 'Medio', 'Tratamiento', 'Referencia', 'Registrado por', 'Observación'], data: expenses, widths: [15, 13, 28, 34, 17, 18, 24, 20, 24, 30] },
      { name: 'Abonos', title: 'Abonos recibidos', subtitle, headers: ['Documento', 'Fecha', 'Trabajador', 'Monto', 'Medio', 'Referencia', 'Registrado por', 'Observación'], data: payments, widths: [15, 13, 25, 17, 18, 20, 24, 30] },
      { name: 'Cuentas por cobrar', title: 'Saldos por trabajador', subtitle: `Al ${data.to ? fmtDate(data.to) : 'hoy'}`, headers: ['Trabajador', 'Ventas contado', 'Ventas crédito', 'Abonos', 'Saldo', 'Estado'], data: balances, widths: [28, 18, 18, 18, 18, 16] },
      { name: 'Productos', title: 'Catálogo de productos', subtitle, headers: ['Producto', 'Precio venta', 'Precio compra', 'Margen unitario', 'Margen %', 'Existencia', 'Activo'], data: state.products.map((product) => [product.name, cell(num21(product.price), 3), cell(num21(product.cost), 3), cell(num21(product.price) - num21(product.cost), 3), cell(num21(product.price) ? (num21(product.price) - num21(product.cost)) / num21(product.price) : 0, 5), product.stock == null ? '' : num21(product.stock), product.active === false ? 'No' : 'Sí']), widths: [28, 17, 17, 18, 13, 13, 10] },
      { name: 'Auditoría', title: 'Auditoría de cambios', subtitle, headers: ['Fecha y hora', 'Acción', 'Tipo', 'Documento', 'Detalle', 'Usuario'], data: auditRows, widths: [22, 16, 18, 16, 55, 25] }
    ];
    makeWorkbook(sheets, `VENTAS_VICTOR_FINANCIERO_${today()}.xlsx`);
    toast('Informe financiero Excel generado');
  }

  function wrapRefreshFunctions21() {
    const baseRenderCatalog = renderCatalog;
    renderCatalog = function renderCatalogV21() {
      baseRenderCatalog();
      if (typeof catalogType === 'undefined' || catalogType !== 'products') return;
      document.querySelectorAll('#catalogList .item').forEach((item) => {
        const title = item.querySelector('.item-title')?.textContent || '';
        const product = state.products.find((row) => norm21(row.name) === norm21(title));
        const sub = item.querySelector('.item-sub');
        if (!product || !sub) return;
        const margin = num21(product.price) - num21(product.cost);
        const marginPct = num21(product.price) ? margin / num21(product.price) * 100 : 0;
        sub.textContent = `${money(product.price)} venta · ${money(product.cost)} compra · Margen ${money(margin)} (${marginPct.toFixed(1)}%)${product.stock == null ? '' : ` · Existencia ${num21(product.stock)}`}`;
        sub.classList.toggle('vv21-negative', margin < 0);
      });
    };
    window.renderCatalog = renderCatalog;
  }

  function expose21() {
    Object.assign(window, {
      vv21OpenExpense: openExpense21,
      vv21OpenExpenseList: openExpenseList21,
      vv21EditExpense: editExpense21,
      vv21VoidExpense: voidExpense21,
      vv21RestoreExpense: restoreExpense21,
      vv21ResetExpenseForm: resetExpenseForm21,
      vv21PrintIncome: () => printFinancial21('income'),
      vv21PrintCash: () => printFinancial21('cash')
    });
    periodData = getReportData21;
    renderMovements = renderMovements21;
    renderReports = renderReports21;
    setReportTab = setReportTab21;
    exportXLSX = exportXLSX21;
    Object.assign(window, { periodData, renderMovements, renderReports, setReportTab, exportXLSX });
  }

  async function boot21() {
    if (installed) return;
    installed = true;
    try {
      await waitForV2();
      normalizeFinancialState();
      installStyles21();
      installReportsUI21();
      installExpenseUI21();
      fillExpenseCategories21();
      installEvents21();
      wrapRefreshFunctions21();
      expose21();
      resetExpenseForm21();
      renderSaleMargin21();
      await save(false);
      refreshAll();
      setReportTab21(reportTab || 'summary', document.querySelector(`[data-report="${reportTab || 'summary'}"]`));
      const guide = document.querySelector('#guideModal .notice');
      if (guide && !guide.dataset.vv21) {
        guide.dataset.vv21 = '1';
        guide.innerHTML += '<br><br><b>11. Rentabilidad:</b> registre el precio de compra de cada producto para conocer costo y margen bruto.<br><br><b>12. Gastos:</b> registre los egresos y diferencie gastos operativos de compras de inventario.<br><br><b>13. Informes financieros:</b> use Estado de resultados para conocer la ganancia estimada y Flujo de caja para conocer el dinero que realmente entró y salió.';
      }
      toast('Ventas de Víctor V2.1 · Informes financieros listos');
    } catch (error) {
      console.error('Error al iniciar V2.1', error);
      alert(`La mejora financiera V2.1 no pudo iniciar: ${error.message}`);
    }
  }

  boot21();
})();
