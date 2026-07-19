/* Ventas de Víctor · Capa V2 Multiusuario / Seguridad / Operación */
'use strict';

(() => {
  const VV2_VERSION = '2.3.0';
  const STORAGE_CONFIG = 'vv_supabase_override_v2';
  const STORAGE_META = 'vv_cloud_meta_v2';
  const DEVICE_KEY = 'vv_device_id_v2';
  const OFFLINE_PREFIX = 'OF';
  const ENTITY_KEYS = ['workers', 'products', 'sales', 'payments', 'adjustments', 'expenses', 'cashClosings', 'inventorySnapshots', 'auditLog'];

  let base = {};
  let booted = false;
  let cloudClient = null;
  let cloudSession = null;
  let cloudProfile = null;
  let cloudRole = 'local';
  let cloudVersion = 0;
  let cloudUpdatedAt = '';
  let cloudSubscription = null;
  let cloudSaving = false;
  let cloudLoading = false;
  let pendingCloudSave = false;
  let lastSyncEvent = { action: 'Inicio', recordType: 'Sistema', docNo: '', detail: '' };
  let lastConfirmationReason = '';
  let confirmationRequiresReason = false;
  let saleCart = [];
  let lastReceipt = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const nowISO = () => new Date().toISOString();
  const cloneV2 = (value) => JSON.parse(JSON.stringify(value));
  const normText = (value) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const html = (value) => typeof esc === 'function' ? esc(value) : String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const getDeviceId = () => {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 6).toUpperCase();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  };
  const isActive = (record) => record && record.status !== 'voided' && record.voided !== true;
  const recordStamp = (record) => record?.updatedAt || record?.createdAt || '';
  const currentIdentity = () => ({
    userId: cloudSession?.user?.id || `local:${getDeviceId()}`,
    userName: cloudProfile?.display_name || cloudSession?.user?.email || 'Usuario local',
    userEmail: cloudSession?.user?.email || '',
    role: cloudRole,
    deviceId: getDeviceId()
  });
  const activeRecords = (arr) => (Array.isArray(arr) ? arr.filter(isActive) : []);
  const setBusy = (form, busy, label = '') => {
    if (!form) return;
    form.dataset.busy = busy ? '1' : '0';
    const buttons = form.querySelectorAll('button, input[type="submit"]');
    buttons.forEach((button) => {
      if (busy) {
        if (!button.dataset.vvOriginalText) button.dataset.vvOriginalText = button.innerHTML || button.value || '';
        button.disabled = true;
      } else {
        button.disabled = false;
        if (button.dataset.vvOriginalText) {
          if (button.tagName === 'INPUT') button.value = button.dataset.vvOriginalText;
          else button.innerHTML = button.dataset.vvOriginalText;
          delete button.dataset.vvOriginalText;
        }
      }
    });
    const submit = form.querySelector('[type="submit"]');
    if (busy && submit && label) submit.textContent = label;
  };

  function getCloudConfig() {
    let override = {};
    try { override = JSON.parse(localStorage.getItem(STORAGE_CONFIG) || '{}'); } catch (_) {}
    const fileCfg = window.VV_SUPABASE_CONFIG || {};
    return {
      url: String(override.url || fileCfg.url || '').trim().replace(/\/$/, ''),
      publishableKey: String(override.publishableKey || override.anonKey || fileCfg.publishableKey || fileCfg.anonKey || '').trim(),
      businessSlug: String(override.businessSlug || fileCfg.businessSlug || 'ventas-victor').trim() || 'ventas-victor'
    };
  }

  function cloudConfigured() {
    const cfg = getCloudConfig();
    return /^https:\/\/.+\.supabase\.co$/i.test(cfg.url) && cfg.publishableKey.length > 20;
  }

  function loadCloudMeta() {
    try {
      const meta = JSON.parse(localStorage.getItem(STORAGE_META) || '{}');
      cloudVersion = Number(meta.version) || 0;
      cloudUpdatedAt = meta.updatedAt || '';
      pendingCloudSave = !!meta.pending;
    } catch (_) {}
  }

  function saveCloudMeta() {
    localStorage.setItem(STORAGE_META, JSON.stringify({
      version: cloudVersion,
      updatedAt: cloudUpdatedAt,
      pending: pendingCloudSave,
      businessSlug: getCloudConfig().businessSlug
    }));
  }

  function updateSyncUI(status = '') {
    const label = document.getElementById('saveStatus');
    const dot = document.querySelector('.save-dot');
    const user = document.getElementById('vv2UserChip');
    const configured = cloudConfigured();
    let text = status;
    let color = '#75e2af';
    if (!text) {
      if (!configured) { text = 'Modo local'; color = '#f7c65f'; }
      else if (!cloudSession) { text = 'Sin iniciar sesión'; color = '#f7c65f'; }
      else if (!navigator.onLine) { text = pendingCloudSave ? 'Pendiente de sincronizar' : 'Sin conexión'; color = '#f7c65f'; }
      else if (cloudSaving || cloudLoading) { text = 'Sincronizando…'; color = '#8cc8ff'; }
      else if (pendingCloudSave) { text = 'Cambios pendientes'; color = '#f7c65f'; }
      else { text = 'Sincronizado'; color = '#75e2af'; }
    }
    if (label) label.textContent = text;
    if (dot) dot.style.background = color;
    if (user) {
      const name = cloudProfile?.display_name || cloudSession?.user?.email || (configured ? 'Ingresar' : 'Configurar nube');
      user.innerHTML = `<b>${html(name)}</b><span>${html(roleLabel(cloudRole))}</span>`;
      user.title = cloudSession ? 'Sesión y sincronización' : 'Configurar o iniciar sesión';
    }
  }

  function roleLabel(role) {
    return ({ admin: 'Administrador', seller: 'Vendedor', viewer: 'Consulta', local: 'Modo local' })[role] || role || 'Sin rol';
  }

  function can(action, record = null) {
    if (!cloudConfigured() || (!cloudSession && cloudRole === 'local')) return true;
    if (!cloudSession) return false;
    if (cloudRole === 'admin') return true;
    if (cloudRole === 'viewer') return ['view', 'export'].includes(action);
    if (cloudRole === 'seller') {
      if (['view', 'export', 'create-sale', 'create-payment'].includes(action)) return true;
      if (['edit-sale', 'edit-payment'].includes(action) && record) {
        const mine = !record.createdBy || record.createdBy === cloudSession.user.id;
        const ageMs = Date.now() - new Date(record.createdAt || 0).getTime();
        return mine && ageMs <= 60 * 60 * 1000 && isActive(record);
      }
      return false;
    }
    return false;
  }

  function deny(message = 'Su perfil no tiene permiso para realizar esta acción.') {
    if (typeof toast === 'function') toast(message);
    else alert(message);
    return false;
  }

  async function waitForBaseApp() {
    for (let i = 0; i < 300; i += 1) {
      if (typeof state !== 'undefined' && state && typeof refreshAll === 'function' && document.getElementById('saleForm')) return true;
      await sleep(30);
    }
    throw new Error('No fue posible inicializar la aplicación base.');
  }

  function installUI() {
    const style = document.createElement('style');
    style.textContent = `
      .vv2-user-chip{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:1px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.09);color:#fff;border-radius:12px;padding:6px 9px;min-width:92px;max-width:180px;cursor:pointer}.vv2-user-chip b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px}.vv2-user-chip span{font-size:8px;opacity:.72}.vv2-appbar-actions{display:flex;align-items:center;gap:7px}.vv2-login{position:fixed;z-index:500;inset:0;background:linear-gradient(145deg,#04131f,#071c2b 58%,#123d59);display:none;place-items:center;padding:18px}.vv2-login.show{display:grid}.vv2-login-card{width:min(430px,100%);background:#fff;border-radius:24px;padding:22px;box-shadow:0 25px 80px rgba(0,0,0,.35)}.vv2-login-brand{display:flex;gap:12px;align-items:center;margin-bottom:18px}.vv2-login-brand img{width:56px;height:56px;border-radius:16px}.vv2-login-brand h2{margin:0;font-size:22px;color:#071c2b}.vv2-login-brand p{margin:4px 0 0;font-size:11px;color:#66746e}.vv2-cloud-status{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.vv2-cloud-status div{border:1px solid var(--line);border-radius:12px;padding:9px;background:#fff}.vv2-cloud-status span{display:block;font-size:9px;color:var(--muted);text-transform:uppercase;font-weight:850}.vv2-cloud-status b{display:block;font-size:11px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vv2-reason{display:none;margin-bottom:12px}.vv2-reason.show{display:block}.vv2-diff{width:100%;border-collapse:collapse;font-size:10px}.vv2-diff th,.vv2-diff td{padding:6px;border-bottom:1px solid var(--line);text-align:left}.vv2-diff th{color:var(--muted);font-size:9px;text-transform:uppercase}.vv2-status-pill{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:900}.vv2-status-pill.voided{background:#f2f4f7;color:#667085}.item.vv2-voided{opacity:.62;background:#f7f7f7}.item.vv2-voided .item-title,.item.vv2-voided .amount{text-decoration:line-through}.vv2-cart{border:1px dashed #c8d5d0;border-radius:14px;padding:10px;margin:8px 0 12px;background:#f8faf9}.vv2-cart-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px 4px;border-bottom:1px solid var(--line)}.vv2-cart-row:last-child{border-bottom:0}.vv2-cart-row b{font-size:12px}.vv2-cart-row small{display:block;color:var(--muted);font-size:9px}.vv2-icon-btn{border:0;border-radius:9px;background:var(--danger-bg);color:var(--danger);width:30px;height:30px;font-weight:900}.vv2-aging{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.vv2-aging div{border:1px solid var(--line);border-radius:13px;padding:10px;background:#fff}.vv2-aging span{font-size:9px;color:var(--muted);font-weight:850}.vv2-aging b{display:block;margin-top:4px;font-size:14px}.vv2-aging .late{border-color:#f2b8b5;background:#fff6f5}.vv2-inline-check{display:flex;align-items:center;gap:7px;font-size:10px;color:var(--muted);font-weight:800}.vv2-inline-check input{width:17px;height:17px}.vv2-receipt{background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px}.vv2-receipt h2{text-align:center;margin:2px 0}.vv2-receipt .sub{text-align:center;color:var(--muted);font-size:10px}.vv2-receipt table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}.vv2-receipt td,.vv2-receipt th{padding:7px 4px;border-bottom:1px solid var(--line)}.vv2-receipt .num{text-align:right}.vv2-total-line{display:flex;justify-content:space-between;font-size:16px;font-weight:950;margin-top:12px}.vv2-stock-low{color:var(--danger)!important}.vv2-readonly .btn.primary,.vv2-readonly .btn.gold,.vv2-readonly .btn.danger,.vv2-readonly .btn.danger-solid{opacity:.45}.vv2-sync-warning{border:1px solid #f4d77f;background:#fff7dd;color:#6d4b00;border-radius:12px;padding:9px 11px;font-size:10px;line-height:1.45;margin-bottom:10px}.vv2-config-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;background:#071c2b;color:#eaf0f5;border-radius:12px;padding:11px;overflow:auto}.vv2-kpi-note{font-size:9px;color:var(--muted);margin-top:3px}.vv2-stock-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.vv2-stock-card{border:1px solid var(--line);border-radius:12px;padding:9px;background:#fff}.vv2-stock-card b{font-size:11px}.vv2-stock-card span{display:block;font-size:9px;color:var(--muted);margin-top:3px}@media(max-width:560px){.vv2-user-chip{display:none}.vv2-aging{grid-template-columns:1fr 1fr}.vv2-cloud-status{grid-template-columns:1fr}.vv2-cart-row{grid-template-columns:1fr auto}.vv2-cart-row .vv2-line-total{grid-column:1/2}.vv2-stock-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);

    const appbar = document.querySelector('.appbar-inner');
    const saveChip = document.querySelector('.save-chip');
    if (appbar && saveChip && !document.getElementById('vv2UserChip')) {
      const wrap = document.createElement('div');
      wrap.className = 'vv2-appbar-actions';
      saveChip.parentNode.insertBefore(wrap, saveChip);
      wrap.appendChild(saveChip);
      const user = document.createElement('button');
      user.type = 'button';
      user.id = 'vv2UserChip';
      user.className = 'vv2-user-chip';
      user.onclick = () => cloudSession ? openCloudPanel() : showLogin();
      wrap.appendChild(user);
    }

    const confirmWord = document.getElementById('confirmWordWrap');
    if (confirmWord && !document.getElementById('vv2ConfirmReasonWrap')) {
      const reason = document.createElement('div');
      reason.id = 'vv2ConfirmReasonWrap';
      reason.className = 'vv2-reason';
      reason.innerHTML = `<div class="field"><label>Motivo de la acción <em>Obligatorio</em></label><textarea id="vv2ConfirmReason" maxlength="240" placeholder="Explique por qué se realiza este cambio"></textarea></div>`;
      confirmWord.parentNode.insertBefore(reason, confirmWord);
    }

    document.body.insertAdjacentHTML('beforeend', `
      <div id="vv2Login" class="vv2-login">
        <div class="vv2-login-card">
          <div class="vv2-login-brand"><img src="assets/icons/icon-192.png" alt="VV"><div><h2>Ventas de Víctor</h2><p>Acceso seguro a la base compartida</p></div></div>
          <div id="vv2LoginMessage" class="notice success">Ingrese con su cuenta asignada.</div>
          <form id="vv2LoginForm" class="mt10">
            <div class="field"><label>Correo electrónico</label><input id="vv2LoginEmail" type="email" autocomplete="username" required></div>
            <div class="field"><label>Contraseña</label><input id="vv2LoginPassword" type="password" autocomplete="current-password" required></div>
            <button class="btn primary" type="submit">Ingresar</button>
          </form>
          <button id="vv2LocalModeBtn" class="btn secondary mt8" type="button">Continuar temporalmente en modo local</button>
          <button class="btn secondary mt8" type="button" onclick="openCloudPanel()">Configurar Supabase</button>
        </div>
      </div>

      <div class="modal" id="vv2CloudModal"><div class="sheet"><div class="sheet-handle"></div><div class="modal-head"><h3>Conexión multiusuario</h3><button class="close" onclick="closeModal('vv2CloudModal')">×</button></div>
        <div id="vv2CloudNotice" class="notice success">La URL y la clave pública pueden estar en GitHub. Nunca use la clave <b>service_role</b>.</div>
        <form id="vv2CloudForm" class="mt10">
          <div class="field"><label>Project URL de Supabase</label><input id="vv2CloudUrl" type="url" placeholder="https://xxxxx.supabase.co"></div>
          <div class="field"><label>Publishable key / anon key</label><textarea id="vv2CloudKey" rows="3" placeholder="sb_publishable_... o eyJ..."></textarea></div>
          <div class="field"><label>Identificador del negocio</label><input id="vv2BusinessSlug" value="ventas-victor"></div>
          <button class="btn primary" type="submit">Guardar y conectar</button>
        </form>
        <div class="vv2-cloud-status"><div><span>Usuario</span><b id="vv2CloudUser">—</b></div><div><span>Rol</span><b id="vv2CloudRole">—</b></div><div><span>Versión nube</span><b id="vv2CloudVersion">0</b></div></div>
        <div class="btn-row mt10"><button class="btn secondary" type="button" onclick="vv2ForceSync()">Sincronizar ahora</button><button class="btn secondary" type="button" onclick="vv2SignOut()">Cerrar sesión</button></div>
        <div class="vv2-sync-warning mt10">Para los tres usuarios: cree las cuentas en Supabase Authentication, ejecute <b>supabase/schema.sql</b> y asigne los roles en <b>business_members</b>.</div>
      </div></div>

      <div class="modal" id="vv2ReceiptModal"><div class="sheet"><div class="sheet-handle"></div><div class="modal-head"><h3>Comprobante</h3><button class="close" onclick="closeModal('vv2ReceiptModal')">×</button></div><div id="vv2ReceiptBody"></div><div class="btn-row mt10"><button class="btn primary" onclick="vv2PrintReceipt()">Imprimir / PDF</button><button class="btn secondary" onclick="vv2ShareReceipt()">Compartir</button></div></div></div>

      <div class="modal" id="vv2CashModal"><div class="sheet"><div class="sheet-handle"></div><div class="modal-head"><h3>Cierre diario de caja</h3><button class="close" onclick="closeModal('vv2CashModal')">×</button></div><form id="vv2CashForm"><div class="field"><label>Fecha</label><input id="vv2CashDate" type="date" required></div><div class="account-preview"><div>Ventas contado<b id="vv2CashSales">C$ 0.00</b></div><div>Abonos en efectivo<b id="vv2CashPayments">C$ 0.00</b></div><div>Efectivo esperado<b id="vv2CashExpected">C$ 0.00</b></div><div>Diferencia<b id="vv2CashDifference">C$ 0.00</b></div></div><div class="field"><label>Efectivo contado <em>C$</em></label><input id="vv2CashCounted" type="number" min="0" step="0.01" required></div><div class="field"><label>Observación</label><textarea id="vv2CashNotes" placeholder="Explique cualquier diferencia"></textarea></div><button class="btn primary" type="submit">Guardar cierre</button></form></div></div>
    `);

    const homeGrid = document.querySelector('#home .grid.desktop-two');
    if (homeGrid && !document.getElementById('vv2AgingCard')) {
      homeGrid.insertAdjacentHTML('beforebegin', `
        <div class="grid desktop-two mt10">
          <div class="card" id="vv2AgingCard"><div class="card-head"><h2>Antigüedad de cartera</h2><small>Saldo pendiente por edad</small></div><div class="vv2-aging"><div><span>0–7 días</span><b id="vv2Age0">C$ 0</b></div><div><span>8–15 días</span><b id="vv2Age8">C$ 0</b></div><div><span>16–30 días</span><b id="vv2Age16">C$ 0</b></div><div class="late"><span>Más de 30</span><b id="vv2Age31">C$ 0</b></div></div></div>
          <div class="card"><div class="card-head"><h2>Control diario</h2><button class="btn small soft" onclick="vv2OpenCashClosing()">Cerrar caja</button></div><div class="metric-grid"><div class="metric"><div class="label">Cobrado hoy</div><div class="value" id="vv2CollectedToday">C$ 0</div><div class="hint">Contado + abonos</div></div><div class="metric"><div class="label">Crédito hoy</div><div class="value" id="vv2CreditToday">C$ 0</div><div class="hint">Nuevo saldo</div></div></div><div id="vv2LowStock" class="mt10"></div></div>
        </div>`);
    }

    const movementSearch = document.getElementById('movementSearch');
    if (movementSearch && !document.getElementById('vv2ShowVoided')) {
      movementSearch.parentElement.insertAdjacentHTML('afterend', `<label class="vv2-inline-check mt8"><input id="vv2ShowVoided" type="checkbox"> Mostrar movimientos anulados</label>`);
      document.getElementById('vv2ShowVoided').addEventListener('change', () => renderMovements());
    }

    const saleTotal = document.querySelector('#saleForm .form-total');
    if (saleTotal && !document.getElementById('vv2Cart')) {
      saleTotal.insertAdjacentHTML('beforebegin', `<button class="btn secondary" type="button" id="vv2AddCart">Agregar producto al comprobante</button><div id="vv2Cart" class="vv2-cart"><div class="empty">Puede guardar un solo producto o agregar varios al mismo comprobante.</div></div>`);
      document.getElementById('vv2AddCart').addEventListener('click', addCurrentLineToCart);
    }

    const catalogPriceField = document.getElementById('catalogPriceField');
    if (catalogPriceField && !document.getElementById('vv2CatalogExtra')) {
      catalogPriceField.insertAdjacentHTML('afterend', `<div id="vv2CatalogExtra"><div id="vv2ProductExtra"><div class="grid two"><div class="field"><label>Costo unitario <em>C$</em></label><input id="vv2ProductCost" type="number" min="0" step="0.01"></div><div class="field"><label>Existencia actual</label><input id="vv2ProductStock" type="number" min="0" step="1"></div></div><div class="field"><label>Existencia mínima</label><input id="vv2ProductMinStock" type="number" min="0" step="1"></div></div><div id="vv2WorkerExtra" class="hidden"><div class="grid two"><div class="field"><label>Límite de crédito <em>C$</em></label><input id="vv2WorkerLimit" type="number" min="0" step="0.01"></div><div class="field"><label>Plazo de pago <em>Días</em></label><input id="vv2WorkerTerm" type="number" min="0" step="1" value="15"></div></div></div></div>`);
    }

    const more = document.getElementById('more');
    if (more && !document.getElementById('vv2CloudCard')) {
      const firstCard = more.querySelector('.card');
      firstCard?.insertAdjacentHTML('beforebegin', `<div class="card" id="vv2CloudCard"><div class="card-head"><h2>Usuarios y sincronización</h2><small>Supabase + GitHub Pages</small></div><div id="vv2CloudSummary" class="notice success">Revisando conexión…</div><div class="btn-row mt10"><button class="btn primary" onclick="openCloudPanel()">Configurar / sesión</button><button class="btn secondary" onclick="vv2ForceSync()">Sincronizar</button></div></div>`);
    }

    document.getElementById('vv2LoginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('vv2LocalModeBtn')?.addEventListener('click', () => {
      document.getElementById('vv2Login').classList.remove('show');
      cloudRole = 'local';
      updateSyncUI('Modo local temporal');
    });
    document.getElementById('vv2CloudForm')?.addEventListener('submit', handleCloudConfig);
    document.getElementById('vv2CashDate')?.addEventListener('change', renderCashClosingPreview);
    document.getElementById('vv2CashCounted')?.addEventListener('input', renderCashClosingPreview);
    document.getElementById('vv2CashForm')?.addEventListener('submit', saveCashClosing);
  }

  function enhancedNormalize() {
    if (base.normalize) base.normalize();
    state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
    state.cashClosings = Array.isArray(state.cashClosings) ? state.cashClosings : [];
    state.inventorySnapshots = Array.isArray(state.inventorySnapshots) ? state.inventorySnapshots : [];
    state.settings = { currency: 'C$', defaultPaymentTermDays: 15, ...(state.settings || {}) };
    state.counters = { sale: 0, payment: 0, adjustment: 0, expense: 0, offline: 0, ...(state.counters || {}) };
    state.version = 8;

    const workerByName = new Map();
    state.workers.forEach((worker) => {
      worker.id = worker.id || uid('w');
      worker.active = worker.active !== false;
      worker.creditLimit = Number(worker.creditLimit) || 0;
      worker.paymentTermDays = Number(worker.paymentTermDays ?? state.settings.defaultPaymentTermDays) || 15;
      worker.createdAt = worker.createdAt || nowISO();
      worker.updatedAt = worker.updatedAt || worker.createdAt;
      workerByName.set(normText(worker.name), worker);
    });

    const productByName = new Map();
    state.products.forEach((product) => {
      product.id = product.id || uid('p');
      product.active = product.active !== false;
      product.price = Number(product.price) || 0;
      product.cost = Number(product.cost) || 0;
      product.stock = product.stock === '' || product.stock == null ? null : Number(product.stock);
      product.minStock = Number(product.minStock) || 0;
      product.createdAt = product.createdAt || nowISO();
      product.updatedAt = product.updatedAt || product.createdAt;
      productByName.set(normText(product.name), product);
    });

    state.sales.forEach((sale) => {
      const worker = workerByName.get(normText(sale.worker));
      const product = productByName.get(normText(sale.product));
      sale.workerId = sale.workerId || worker?.id || '';
      sale.productId = sale.productId || product?.id || '';
      sale.worker = sale.worker || worker?.name || 'Sin trabajador';
      sale.product = sale.product || product?.name || 'Sin producto';
      sale.status = sale.status || (sale.voided ? 'voided' : 'active');
      sale.receiptId = sale.receiptId || sale.docNo || sale.id;
      sale.createdBy = sale.createdBy || '';
      sale.createdByName = sale.createdByName || '';
      sale.updatedAt = sale.updatedAt || sale.createdAt || nowISO();
      sale.cost = Number(sale.cost ?? product?.cost) || 0;
    });

    state.payments.forEach((payment) => {
      const worker = workerByName.get(normText(payment.worker));
      payment.workerId = payment.workerId || worker?.id || '';
      payment.worker = payment.worker || worker?.name || 'Sin trabajador';
      payment.status = payment.status || (payment.voided ? 'voided' : 'active');
      payment.createdBy = payment.createdBy || '';
      payment.createdByName = payment.createdByName || '';
      payment.updatedAt = payment.updatedAt || payment.createdAt || nowISO();
    });

    state.adjustments.forEach((adjustment) => {
      const worker = workerByName.get(normText(adjustment.worker));
      adjustment.workerId = adjustment.workerId || worker?.id || '';
      adjustment.worker = adjustment.worker || worker?.name || 'Sin trabajador';
      adjustment.status = adjustment.status || (adjustment.voided ? 'voided' : 'active');
      adjustment.createdBy = adjustment.createdBy || '';
      adjustment.createdByName = adjustment.createdByName || '';
      adjustment.updatedAt = adjustment.updatedAt || adjustment.createdAt || nowISO();
    });

    state.expenses.forEach((expense) => {
      expense.id = expense.id || uid('g');
      expense.docNo = expense.docNo || '';
      expense.date = expense.date || today();
      expense.category = expense.category || 'Otros gastos';
      expense.description = expense.description || expense.concept || 'Gasto';
      expense.amount = Number(expense.amount) || 0;
      expense.method = expense.method || 'Efectivo';
      expense.reference = expense.reference || '';
      expense.notes = expense.notes || '';
      expense.affectsResult = expense.affectsResult !== false && normText(expense.category) !== 'compra de mercaderia / inventario';
      expense.status = expense.status || (expense.voided ? 'voided' : 'active');
      expense.createdAt = expense.createdAt || expense.updatedAt || nowISO();
      expense.updatedAt = expense.updatedAt || expense.createdAt;
      expense.createdBy = expense.createdBy || '';
      expense.createdByName = expense.createdByName || '';
    });

    state.cashClosings.forEach((closing) => {
      closing.id = closing.id || uid('cc');
      closing.status = closing.status || 'active';
      closing.updatedAt = closing.updatedAt || closing.createdAt || nowISO();
    });
    state.auditLog.forEach((log) => {
      log.id = log.id || uid('log');
      log.dateTime = log.dateTime || nowISO();
    });

    state.updatedAt = state.updatedAt || nowISO();
    state.updatedBy = state.updatedBy || currentIdentity();
    state.counters.sale = Math.max(Number(state.counters.sale) || 0, maxDocNumber('V', state.sales));
    state.counters.payment = Math.max(Number(state.counters.payment) || 0, maxDocNumber('A', state.payments));
    state.counters.adjustment = Math.max(Number(state.counters.adjustment) || 0, maxDocNumber('AJ', state.adjustments));
    state.counters.expense = Math.max(Number(state.counters.expense) || 0, maxDocNumber('G', state.expenses));
  }

  function maxDocNumber(prefix, arr) {
    return (arr || []).reduce((max, item) => {
      const match = String(item.docNo || '').match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
      return Math.max(max, Number(match?.[1]) || 0);
    }, 0);
  }

  function enhancedAudit(action, recordType, docNo, detail, before = null, after = null, reason = '') {
    const identity = currentIdentity();
    const finalReason = reason || lastConfirmationReason || '';
    state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : [];
    const log = {
      id: uid('log'),
      dateTime: nowISO(),
      action,
      recordType,
      docNo: docNo || '',
      detail: `${detail || ''}${identity.userName ? ` · Usuario: ${identity.userName}` : ''}${finalReason ? ` · Motivo: ${finalReason}` : ''}`,
      reason: finalReason,
      before,
      after,
      ...identity
    };
    state.auditLog.push(log);
    lastSyncEvent = { action, recordType, docNo: docNo || '', detail: detail || '', reason: finalReason };
    lastConfirmationReason = '';
    return log;
  }

  function enhancedAskConfirmation({
    title = 'Confirmar acción',
    heading = 'Revise antes de continuar',
    message = '',
    detail = '',
    confirmText = 'Confirmar',
    danger = false,
    requiredWord = '',
    requireReason = false
  }) {
    return new Promise((resolve) => {
      confirmationResolver = resolve;
      confirmationRequiredWord = String(requiredWord || '').toUpperCase();
      confirmationRequiresReason = !!requireReason;
      lastConfirmationReason = '';
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmHeading').textContent = heading;
      document.getElementById('confirmMessage').textContent = message;
      document.getElementById('confirmDetail').innerHTML = detail;
      const accept = document.getElementById('confirmAccept');
      accept.textContent = confirmText;
      accept.className = `btn ${danger ? 'danger-solid' : 'primary'}`;
      const icon = document.getElementById('confirmIcon');
      icon.className = `confirm-icon${danger ? ' danger' : ''}`;
      icon.textContent = danger ? '!' : '✓';
      const wordWrap = document.getElementById('confirmWordWrap');
      wordWrap.classList.toggle('show', !!confirmationRequiredWord);
      document.getElementById('confirmWordLabel').textContent = confirmationRequiredWord;
      document.getElementById('confirmWordInput').value = '';
      const reasonWrap = document.getElementById('vv2ConfirmReasonWrap');
      const reason = document.getElementById('vv2ConfirmReason');
      reasonWrap?.classList.toggle('show', confirmationRequiresReason);
      if (reason) reason.value = '';
      document.getElementById('confirmModal').classList.add('show');
      enhancedUpdateConfirmButton();
      setTimeout(() => {
        if (confirmationRequiresReason) reason?.focus();
        else if (confirmationRequiredWord) document.getElementById('confirmWordInput')?.focus();
      }, 180);
    });
  }

  function enhancedUpdateConfirmButton() {
    const wordValid = !confirmationRequiredWord || document.getElementById('confirmWordInput').value.trim().toUpperCase() === confirmationRequiredWord;
    const reasonValid = !confirmationRequiresReason || (document.getElementById('vv2ConfirmReason')?.value.trim().length >= 4);
    const valid = wordValid && reasonValid;
    const accept = document.getElementById('confirmAccept');
    accept.disabled = !valid;
    accept.style.opacity = valid ? '1' : '.45';
  }

  function enhancedAcceptConfirmation() {
    const accept = document.getElementById('confirmAccept');
    if (accept.disabled) return;
    lastConfirmationReason = document.getElementById('vv2ConfirmReason')?.value.trim() || '';
    finishConfirmation(true);
  }

  function diffHtml(before, after, fields) {
    const rows = fields.map(([key, label, format]) => {
      const a = format ? format(before?.[key]) : before?.[key];
      const b = format ? format(after?.[key]) : after?.[key];
      if (String(a ?? '') === String(b ?? '')) return '';
      return `<tr><td>${html(label)}</td><td>${html(a ?? '—')}</td><td>${html(b ?? '—')}</td></tr>`;
    }).filter(Boolean).join('');
    return rows ? `<table class="vv2-diff"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>${rows}</tbody></table>` : '<div>Los datos principales no cambiaron.</div>';
  }

  function mergeArray(remoteArr = [], localArr = [], key = 'id') {
    const map = new Map();
    [...remoteArr, ...localArr].forEach((item) => {
      if (!item) return;
      const id = item[key] || uid('merge');
      const previous = map.get(id);
      if (!previous || recordStamp(item) >= recordStamp(previous)) map.set(id, cloneV2(item));
    });
    return [...map.values()];
  }

  function mergeStates(remoteState, localState) {
    const remote = cloneV2(remoteState || {});
    const local = cloneV2(localState || {});
    const merged = cloneV2(remote);
    ['workers', 'products', 'sales', 'payments', 'adjustments', 'expenses', 'cashClosings', 'inventorySnapshots'].forEach((key) => {
      merged[key] = mergeArray(remote[key], local[key]);
    });
    merged.auditLog = mergeArray(remote.auditLog, local.auditLog);
    merged.counters = {
      sale: Math.max(Number(remote.counters?.sale) || 0, Number(local.counters?.sale) || 0),
      payment: Math.max(Number(remote.counters?.payment) || 0, Number(local.counters?.payment) || 0),
      adjustment: Math.max(Number(remote.counters?.adjustment) || 0, Number(local.counters?.adjustment) || 0),
      expense: Math.max(Number(remote.counters?.expense) || 0, Number(local.counters?.expense) || 0),
      offline: Math.max(Number(remote.counters?.offline) || 0, Number(local.counters?.offline) || 0)
    };
    const localNewer = String(local.updatedAt || '') >= String(remote.updatedAt || '');
    merged.settings = { ...(remote.settings || {}), ...((localNewer && local.settings) || {}) };
    merged.updatedAt = [remote.updatedAt, local.updatedAt].filter(Boolean).sort().pop() || nowISO();
    merged.updatedBy = localNewer ? local.updatedBy : remote.updatedBy;
    merged.version = Math.max(Number(remote.version) || 0, Number(local.version) || 0, 8);
    return merged;
  }

  async function enhancedSave(notify = true) {
    if (!state) return;
    state.updatedAt = nowISO();
    state.updatedBy = currentIdentity();
    pendingCloudSave = cloudConfigured() && !!cloudSession;
    saveCloudMeta();
    await base.save(false);
    updateSyncUI();

    if (cloudConfigured() && cloudSession && navigator.onLine) {
      try {
        await syncStateToCloud();
        if (notify) toast('Datos guardados y sincronizados');
      } catch (error) {
        console.error('Error de sincronización', error);
        pendingCloudSave = true;
        saveCloudMeta();
        updateSyncUI('Guardado local · pendiente');
        if (notify) toast('Guardado local; se sincronizará al recuperar conexión');
      }
    } else if (notify) {
      toast(cloudConfigured() ? 'Guardado local; pendiente de iniciar sesión' : 'Datos guardados en el teléfono');
    }
  }

  async function fetchRemoteRow() {
    if (!cloudClient || !cloudSession) return null;
    const cfg = getCloudConfig();
    const { data, error } = await cloudClient
      .from('business_state')
      .select('business_slug,version,state,updated_at,updated_by')
      .eq('business_slug', cfg.businessSlug)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function conflictVersion(error) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
    const match = text.match(/VV_CONFLICT:(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function syncStateToCloud(retry = 0) {
    if (!cloudClient || !cloudSession || !navigator.onLine) return false;
    if (cloudSaving) {
      pendingCloudSave = true;
      saveCloudMeta();
      return false;
    }
    cloudSaving = true;
    updateSyncUI();
    const cfg = getCloudConfig();
    try {
      const event = {
        ...lastSyncEvent,
        clientVersion: VV2_VERSION,
        deviceId: getDeviceId(),
        localUpdatedAt: state.updatedAt,
        user: currentIdentity()
      };
      const { data, error } = await cloudClient.rpc('vv_save_state', {
        p_business_slug: cfg.businessSlug,
        p_expected_version: cloudVersion,
        p_state: state,
        p_event: event
      });
      if (error) {
        const version = conflictVersion(error);
        if (version != null && retry < 3) {
          const remoteRow = await fetchRemoteRow();
          cloudVersion = Number(remoteRow?.version) || version;
          cloudUpdatedAt = remoteRow?.updated_at || cloudUpdatedAt;
          state = mergeStates(remoteRow?.state || {}, state);
          enhancedNormalize();
          await base.save(false);
          cloudSaving = false;
          return syncStateToCloud(retry + 1);
        }
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      cloudVersion = Number(row?.version) || cloudVersion + 1;
      cloudUpdatedAt = row?.updated_at || nowISO();
      pendingCloudSave = false;
      saveCloudMeta();
      updateSyncUI();
      updateCloudPanel();
      return true;
    } finally {
      cloudSaving = false;
      updateSyncUI();
    }
  }

  async function loadRemoteState() {
    if (!cloudClient || !cloudSession) return;
    cloudLoading = true;
    updateSyncUI();
    try {
      const remote = await fetchRemoteRow();
      if (!remote) {
        cloudVersion = 0;
        pendingCloudSave = true;
        await syncStateToCloud();
        return;
      }
      const localHasData = (state.sales?.length || 0) + (state.payments?.length || 0) + (state.adjustments?.length || 0) + (state.expenses?.length || 0) > 0;
      const hasUnsyncedLocal = pendingCloudSave || (cloudVersion === 0 && localHasData);
      cloudVersion = Number(remote.version) || 0;
      cloudUpdatedAt = remote.updated_at || '';
      state = hasUnsyncedLocal ? mergeStates(remote.state || {}, state) : cloneV2(remote.state || state);
      enhancedNormalize();
      await base.save(false);
      refreshAll();
      if (hasUnsyncedLocal) {
        pendingCloudSave = true;
        await syncStateToCloud();
      } else {
        pendingCloudSave = false;
        saveCloudMeta();
      }
    } finally {
      cloudLoading = false;
      updateSyncUI();
      updateCloudPanel();
    }
  }

  async function applyRealtimeState(payload) {
    const incoming = payload?.new;
    if (!incoming || Number(incoming.version) <= cloudVersion || cloudSaving) return;
    cloudVersion = Number(incoming.version) || cloudVersion;
    cloudUpdatedAt = incoming.updated_at || cloudUpdatedAt;
    state = pendingCloudSave ? mergeStates(incoming.state || {}, state) : cloneV2(incoming.state || state);
    enhancedNormalize();
    await base.save(false);
    refreshAll();
    saveCloudMeta();
    updateSyncUI();
    toast('Datos actualizados por otro usuario');
    if (pendingCloudSave && navigator.onLine) await syncStateToCloud();
  }

  function subscribeRealtime() {
    if (!cloudClient || !cloudSession) return;
    const cfg = getCloudConfig();
    if (cloudSubscription) cloudClient.removeChannel(cloudSubscription);
    cloudSubscription = cloudClient
      .channel(`vv-state-${cfg.businessSlug}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'business_state',
        filter: `business_slug=eq.${cfg.businessSlug}`
      }, applyRealtimeState)
      .subscribe((status, error) => {
        if (error) console.error('Realtime', error);
        if (status === 'SUBSCRIBED') updateSyncUI();
      });
  }

  async function loadProfileAndRole() {
    const cfg = getCloudConfig();
    const userId = cloudSession?.user?.id;
    if (!userId) return false;
    const [{ data: profile, error: profileError }, { data: member, error: memberError }] = await Promise.all([
      cloudClient.from('profiles').select('id,display_name').eq('id', userId).maybeSingle(),
      cloudClient.from('business_members').select('role,active').eq('business_slug', cfg.businessSlug).eq('user_id', userId).maybeSingle()
    ]);
    if (profileError) console.warn(profileError);
    if (memberError) throw memberError;
    cloudProfile = profile || { display_name: cloudSession.user.email };
    if (!member || member.active === false) {
      cloudRole = 'viewer';
      document.getElementById('vv2LoginMessage').className = 'notice warning';
      document.getElementById('vv2LoginMessage').textContent = 'La cuenta existe, pero todavía no está asignada al negocio. Solicite al administrador agregarla en business_members.';
      return false;
    }
    cloudRole = member.role || 'viewer';
    return true;
  }

  async function initCloud({ showAuth = true } = {}) {
    loadCloudMeta();
    if (!cloudConfigured()) {
      cloudClient = null;
      cloudSession = null;
      cloudRole = 'local';
      updateSyncUI();
      updateCloudPanel();
      return false;
    }
    if (!window.supabase?.createClient) throw new Error('No se cargó la biblioteca de Supabase.');
    const cfg = getCloudConfig();
    cloudClient = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data, error } = await cloudClient.auth.getSession();
    if (error) console.warn(error);
    cloudSession = data?.session || null;
    cloudClient.auth.onAuthStateChange(async (_event, session) => {
      cloudSession = session;
      if (session) {
        const allowed = await loadProfileAndRole();
        if (allowed) {
          document.getElementById('vv2Login')?.classList.remove('show');
          subscribeRealtime();
          await loadRemoteState();
        }
      } else {
        cloudProfile = null;
        cloudRole = 'local';
        if (showAuth) showLogin();
      }
      applyRoleUI();
      updateSyncUI();
    });
    if (cloudSession) {
      const allowed = await loadProfileAndRole();
      if (allowed) {
        subscribeRealtime();
        await loadRemoteState();
        document.getElementById('vv2Login')?.classList.remove('show');
      } else if (showAuth) showLogin();
    } else if (showAuth) showLogin();
    applyRoleUI();
    updateSyncUI();
    updateCloudPanel();
    return !!cloudSession;
  }

  function showLogin() {
    if (!cloudConfigured()) {
      openCloudPanel();
      return;
    }
    const login = document.getElementById('vv2Login');
    if (login) login.classList.add('show');
    document.getElementById('vv2LoginMessage').className = 'notice success';
    document.getElementById('vv2LoginMessage').textContent = 'Ingrese con una de las tres cuentas autorizadas.';
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    setBusy(form, true, 'Ingresando…');
    try {
      if (!cloudClient) await initCloud({ showAuth: false });
      const email = document.getElementById('vv2LoginEmail').value.trim();
      const password = document.getElementById('vv2LoginPassword').value;
      const { data, error } = await cloudClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      cloudSession = data.session;
      const allowed = await loadProfileAndRole();
      if (!allowed) return;
      document.getElementById('vv2Login').classList.remove('show');
      subscribeRealtime();
      await loadRemoteState();
      applyRoleUI();
      toast(`Bienvenido: ${cloudProfile?.display_name || email}`);
    } catch (error) {
      document.getElementById('vv2LoginMessage').className = 'notice warning';
      document.getElementById('vv2LoginMessage').textContent = `No fue posible ingresar: ${error.message || 'revise sus credenciales'}`;
    } finally {
      setBusy(form, false);
    }
  }

  async function handleCloudConfig(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    setBusy(form, true, 'Conectando…');
    try {
      const cfg = {
        url: document.getElementById('vv2CloudUrl').value.trim().replace(/\/$/, ''),
        publishableKey: document.getElementById('vv2CloudKey').value.trim(),
        businessSlug: document.getElementById('vv2BusinessSlug').value.trim() || 'ventas-victor'
      };
      if (!/^https:\/\/.+\.supabase\.co$/i.test(cfg.url)) throw new Error('La Project URL de Supabase no es válida.');
      if (cfg.publishableKey.length < 20) throw new Error('La clave pública está incompleta.');
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(cfg));
      localStorage.removeItem(STORAGE_META);
      if (cloudSubscription && cloudClient) await cloudClient.removeChannel(cloudSubscription);
      cloudClient = null;
      cloudSession = null;
      cloudVersion = 0;
      await initCloud({ showAuth: true });
      toast('Configuración de Supabase guardada');
    } catch (error) {
      alert(error.message || 'No fue posible guardar la configuración.');
    } finally {
      setBusy(form, false);
      updateCloudPanel();
    }
  }

  function openCloudPanel() {
    const cfg = getCloudConfig();
    document.getElementById('vv2CloudUrl').value = cfg.url;
    document.getElementById('vv2CloudKey').value = cfg.publishableKey;
    document.getElementById('vv2BusinessSlug').value = cfg.businessSlug;
    updateCloudPanel();
    document.getElementById('vv2CloudModal').classList.add('show');
  }

  function updateCloudPanel() {
    const user = document.getElementById('vv2CloudUser');
    const role = document.getElementById('vv2CloudRole');
    const version = document.getElementById('vv2CloudVersion');
    const summary = document.getElementById('vv2CloudSummary');
    if (user) user.textContent = cloudProfile?.display_name || cloudSession?.user?.email || 'Sin sesión';
    if (role) role.textContent = roleLabel(cloudRole);
    if (version) version.textContent = String(cloudVersion || 0);
    if (summary) {
      if (!cloudConfigured()) {
        summary.className = 'notice warning';
        summary.textContent = 'La app funciona localmente. Configure Supabase para compartir automáticamente los registros entre los tres usuarios.';
      } else if (!cloudSession) {
        summary.className = 'notice warning';
        summary.textContent = 'Supabase está configurado, pero falta iniciar sesión.';
      } else {
        summary.className = pendingCloudSave ? 'notice warning' : 'notice success';
        summary.textContent = pendingCloudSave ? 'Hay cambios guardados localmente pendientes de sincronización.' : `Conectado como ${roleLabel(cloudRole)}. Los cambios se comparten automáticamente.`;
      }
    }
  }

  async function vv2SignOut() {
    if (cloudClient) await cloudClient.auth.signOut();
    cloudSession = null;
    cloudProfile = null;
    cloudRole = 'local';
    if (cloudSubscription && cloudClient) await cloudClient.removeChannel(cloudSubscription);
    cloudSubscription = null;
    closeModal('vv2CloudModal');
    showLogin();
    updateSyncUI();
  }

  async function vv2ForceSync() {
    if (!cloudConfigured()) return openCloudPanel();
    if (!cloudSession) return showLogin();
    if (!navigator.onLine) return toast('No hay conexión a internet');
    try {
      pendingCloudSave = true;
      await syncStateToCloud();
      toast('Sincronización completada');
    } catch (error) {
      console.error(error);
      toast('No fue posible sincronizar; revise Supabase');
    }
  }

  function workerById(id) {
    return state.workers.find((x) => x.id === id) || null;
  }
  function productById(id) {
    return state.products.find((x) => x.id === id) || null;
  }
  function resolveWorker(selector) {
    if (!selector) return null;
    return state.workers.find((x) => x.id === selector) || state.workers.find((x) => normText(x.name) === normText(selector)) || null;
  }
  function workerMatches(record, selector) {
    if (!selector) return true;
    const worker = resolveWorker(selector);
    if (worker) return record.workerId === worker.id || (!record.workerId && normText(record.worker) === normText(worker.name));
    return normText(record.worker) === normText(selector);
  }

  function enhancedFillSelects() {
    const fillById = (id, items, placeholder) => {
      const el = document.getElementById(id);
      if (!el) return;
      const current = el.value;
      el.innerHTML = `<option value="">${html(placeholder)}</option>` + items
        .filter((x) => x.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((x) => `<option value="${html(x.id)}">${html(x.name)}</option>`).join('');
      if ([...el.options].some((o) => o.value === current)) el.value = current;
    };
    fillById('saleWorker', state.workers, 'Seleccione...');
    fillById('paymentWorker', state.workers, 'Seleccione...');
    fillById('adjustmentWorker', state.workers, 'Seleccione...');
    fillById('saleProduct', state.products, 'Seleccione...');

    const report = document.getElementById('reportWorker');
    if (report) {
      const current = report.value;
      report.innerHTML = '<option value="">Todos los trabajadores</option>' + state.workers
        .slice().sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((x) => `<option value="${html(x.name)}">${html(x.name)}${x.active === false ? ' · Inactivo' : ''}</option>`).join('');
      report.value = [...report.options].some((o) => o.value === current) ? current : '';
    }
  }

  function enhancedAllMovements({ worker = '', from = '', to = '', includeCash = true, includeVoided = false, exclude = null } = {}) {
    const out = [];
    state.sales.forEach((x) => {
      if (!includeVoided && !isActive(x)) return;
      if (exclude?.source === 'sale' && exclude.id === x.id) return;
      if (!workerMatches(x, worker)) return;
      if (from && x.date < from) return;
      if (to && x.date > to) return;
      const total = Number(x.qty) * Number(x.price);
      const voided = !isActive(x);
      out.push({
        id: x.id, date: x.date, time: recordTime(x), docNo: x.docNo, worker: resolveWorker(x.workerId)?.name || x.worker,
        workerId: x.workerId || '', kind: voided ? 'Venta anulada' : 'Venta', detail: `${x.product} × ${x.qty}`,
        cash: voided ? 0 : (x.type === 'Contado' ? total : 0), debit: voided ? 0 : (x.type === 'Crédito' ? total : 0), credit: 0,
        effect: voided ? 0 : (x.type === 'Crédito' ? total : 0), source: 'sale', raw: x, voided
      });
    });
    state.payments.forEach((x) => {
      if (!includeVoided && !isActive(x)) return;
      if (exclude?.source === 'payment' && exclude.id === x.id) return;
      if (!workerMatches(x, worker)) return;
      if (from && x.date < from) return;
      if (to && x.date > to) return;
      const voided = !isActive(x);
      out.push({
        id: x.id, date: x.date, time: recordTime(x), docNo: x.docNo, worker: resolveWorker(x.workerId)?.name || x.worker,
        workerId: x.workerId || '', kind: voided ? 'Abono anulado' : 'Abono', detail: `${x.method}${x.reference ? ' · Ref. ' + x.reference : ''}`,
        cash: 0, debit: 0, credit: voided ? 0 : Number(x.amount), effect: voided ? 0 : -Number(x.amount), source: 'payment', raw: x, voided
      });
    });
    state.adjustments.forEach((x) => {
      if (!includeVoided && !isActive(x)) return;
      if (exclude?.source === 'adjustment' && exclude.id === x.id) return;
      if (!workerMatches(x, worker)) return;
      if (from && x.date < from) return;
      if (to && x.date > to) return;
      const voided = !isActive(x);
      out.push({
        id: x.id, date: x.date, time: recordTime(x), docNo: x.docNo, worker: resolveWorker(x.workerId)?.name || x.worker,
        workerId: x.workerId || '', kind: voided ? 'Ajuste anulado' : `Ajuste ${x.type}`, detail: x.concept,
        cash: 0, debit: voided ? 0 : (x.type === 'Cargo' ? Number(x.amount) : 0), credit: voided ? 0 : (x.type === 'Crédito' ? Number(x.amount) : 0),
        effect: voided ? 0 : (x.type === 'Cargo' ? Number(x.amount) : -Number(x.amount)), source: 'adjustment', raw: x, voided
      });
    });
    return out.filter((x) => includeCash || x.effect !== 0)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.docNo.localeCompare(b.docNo));
  }

  function enhancedBalanceAt(worker, to = '', exclude = null) {
    return enhancedAllMovements({ worker, to, includeCash: false, exclude }).reduce((sum, movement) => sum + movement.effect, 0);
  }

  function enhancedAccountSummary(worker = '', to = '') {
    const keys = new Map();
    const register = (record) => {
      const current = resolveWorker(record.workerId);
      const key = current?.id || record.workerId || `legacy:${normText(record.worker)}`;
      if (!keys.has(key)) keys.set(key, { id: current?.id || record.workerId || '', name: current?.name || record.worker || 'Sin trabajador' });
    };
    state.workers.forEach((x) => keys.set(x.id, { id: x.id, name: x.name }));
    activeRecords(state.sales).forEach(register);
    activeRecords(state.payments).forEach(register);
    activeRecords(state.adjustments).forEach(register);
    const selected = worker ? resolveWorker(worker) : null;
    return [...keys.values()].filter((entry) => !worker || (selected ? entry.id === selected.id : normText(entry.name) === normText(worker))).map((entry) => {
      let cash = 0, credit = 0, payments = 0, adjCharges = 0, adjCredits = 0;
      activeRecords(state.sales).filter((x) => workerMatches(x, entry.id || entry.name) && (!to || x.date <= to)).forEach((x) => {
        const total = Number(x.qty) * Number(x.price);
        if (x.type === 'Contado') cash += total; else credit += total;
      });
      activeRecords(state.payments).filter((x) => workerMatches(x, entry.id || entry.name) && (!to || x.date <= to)).forEach((x) => { payments += Number(x.amount); });
      activeRecords(state.adjustments).filter((x) => workerMatches(x, entry.id || entry.name) && (!to || x.date <= to)).forEach((x) => {
        if (x.type === 'Cargo') adjCharges += Number(x.amount); else adjCredits += Number(x.amount);
      });
      return { workerId: entry.id, worker: entry.name, cash, credit, payments, adjCharges, adjCredits, balance: credit + adjCharges - payments - adjCredits };
    });
  }

  function enhancedPeriodData() {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    const worker = document.getElementById('reportWorker').value;
    const match = (x) => (!from || x.date >= from) && (!to || x.date <= to) && (!worker || workerMatches(x, worker));
    return {
      from, to, worker,
      sales: activeRecords(state.sales).filter(match),
      payments: activeRecords(state.payments).filter(match),
      adjustments: activeRecords(state.adjustments).filter(match)
    };
  }

  function withActiveState(callback) {
    const original = { sales: state.sales, payments: state.payments, adjustments: state.adjustments, expenses: state.expenses };
    state.sales = activeRecords(state.sales);
    state.payments = activeRecords(state.payments);
    state.adjustments = activeRecords(state.adjustments);
    state.expenses = activeRecords(state.expenses);
    try { return callback(); }
    finally {
      state.sales = original.sales;
      state.payments = original.payments;
      state.adjustments = original.adjustments;
      state.expenses = original.expenses;
    }
  }

  function enhancedRenderHome() {
    withActiveState(() => base.renderHome());
    renderEnhancedHome();
  }

  function agingBuckets(asOf = today()) {
    const buckets = { d0: 0, d8: 0, d16: 0, d31: 0 };
    const workerIds = [...new Set(activeRecords(state.sales).filter((x) => x.type === 'Crédito' && x.date <= asOf).map((x) => x.workerId || `legacy:${normText(x.worker)}`))];
    workerIds.forEach((wid) => {
      const selector = wid.startsWith('legacy:') ? wid.slice(7) : wid;
      const charges = activeRecords(state.sales)
        .filter((x) => x.type === 'Crédito' && x.date <= asOf && (wid.startsWith('legacy:') ? normText(x.worker) === selector : x.workerId === wid))
        .map((x) => ({ date: x.date, remaining: Number(x.qty) * Number(x.price) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      let credits = activeRecords(state.payments).filter((x) => x.date <= asOf && (wid.startsWith('legacy:') ? normText(x.worker) === selector : x.workerId === wid)).reduce((s, x) => s + Number(x.amount), 0);
      credits += activeRecords(state.adjustments).filter((x) => x.type === 'Crédito' && x.date <= asOf && (wid.startsWith('legacy:') ? normText(x.worker) === selector : x.workerId === wid)).reduce((s, x) => s + Number(x.amount), 0);
      const extraCharges = activeRecords(state.adjustments).filter((x) => x.type === 'Cargo' && x.date <= asOf && (wid.startsWith('legacy:') ? normText(x.worker) === selector : x.workerId === wid)).map((x) => ({ date: x.date, remaining: Number(x.amount) }));
      charges.push(...extraCharges);
      charges.sort((a, b) => a.date.localeCompare(b.date));
      for (const charge of charges) {
        const applied = Math.min(charge.remaining, Math.max(credits, 0));
        charge.remaining -= applied;
        credits -= applied;
        if (charge.remaining <= 0.005) continue;
        const days = Math.max(0, Math.floor((new Date(`${asOf}T12:00:00`) - new Date(`${charge.date}T12:00:00`)) / 86400000));
        if (days <= 7) buckets.d0 += charge.remaining;
        else if (days <= 15) buckets.d8 += charge.remaining;
        else if (days <= 30) buckets.d16 += charge.remaining;
        else buckets.d31 += charge.remaining;
      }
    });
    return buckets;
  }

  function renderEnhancedHome() {
    const buckets = agingBuckets(today());
    const values = { vv2Age0: buckets.d0, vv2Age8: buckets.d8, vv2Age16: buckets.d16, vv2Age31: buckets.d31 };
    Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = money(value); });
    const todayCashSales = activeRecords(state.sales).filter((x) => x.date === today() && x.type === 'Contado').reduce((s, x) => s + Number(x.qty) * Number(x.price), 0);
    const todayPayments = activeRecords(state.payments).filter((x) => x.date === today()).reduce((s, x) => s + Number(x.amount), 0);
    const todayCredit = activeRecords(state.sales).filter((x) => x.date === today() && x.type === 'Crédito').reduce((s, x) => s + Number(x.qty) * Number(x.price), 0);
    if (document.getElementById('vv2CollectedToday')) document.getElementById('vv2CollectedToday').textContent = money(todayCashSales + todayPayments);
    if (document.getElementById('vv2CreditToday')) document.getElementById('vv2CreditToday').textContent = money(todayCredit);
    const low = state.products.filter((p) => p.active !== false && p.stock != null && Number(p.stock) <= Number(p.minStock || 0));
    const box = document.getElementById('vv2LowStock');
    if (box) box.innerHTML = low.length ? `<div class="notice warning"><b>Inventario bajo:</b> ${low.slice(0, 4).map((p) => `${html(p.name)} (${Number(p.stock)})`).join(' · ')}${low.length > 4 ? ` · +${low.length - 4}` : ''}</div>` : '<div class="notice success">Inventario sin alertas registradas.</div>';
  }

  function enhancedRenderMovements() {
    if (!state) return;
    const p = enhancedPeriodData();
    const q = (document.getElementById('movementSearch')?.value || '').toLowerCase().trim();
    const includeVoided = !!document.getElementById('vv2ShowVoided')?.checked;
    const arr = enhancedAllMovements({ worker: p.worker, from: p.from, to: p.to, includeVoided })
      .filter((x) => `${x.worker} ${x.docNo} ${x.detail} ${x.kind}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    document.getElementById('movementCount').textContent = `${arr.length} registro${arr.length === 1 ? '' : 's'}`;
    document.getElementById('movementList').innerHTML = arr.length ? arr.map((x) => {
      const tag = x.voided ? '<span class="vv2-status-pill voided">Anulado</span>' : x.source === 'sale' ? (x.raw.type === 'Crédito' ? '<span class="tag credit">Venta crédito</span>' : '<span class="tag cash">Venta contado</span>') : x.source === 'payment' ? '<span class="tag payment">Abono</span>' : '<span class="tag adjust">Ajuste</span>';
      const amount = x.voided ? (x.source === 'sale' ? Number(x.raw.qty) * Number(x.raw.price) : Number(x.raw.amount)) : (x.cash || x.debit || x.credit);
      let actions = '';
      if (x.voided) {
        if (can('void')) actions = `<button class="edit" onclick="vv2RestoreRecord('${x.source}','${x.id}')">Restaurar</button>`;
      } else if (x.source === 'sale') {
        actions = `${can('edit-sale', x.raw) ? `<button class="edit" onclick="editSale('${x.id}')">Editar</button>` : ''}${can('void') ? `<button class="delete" onclick="deleteSale('${x.id}')">Anular</button>` : ''}`;
      } else if (x.source === 'payment') {
        actions = `${can('edit-payment', x.raw) ? `<button class="edit" onclick="editPayment('${x.id}')">Editar</button>` : ''}${can('void') ? `<button class="delete" onclick="deletePayment('${x.id}')">Anular</button>` : ''}`;
      } else if (can('void')) {
        actions = `<button class="edit" onclick="editAdjustment('${x.id}')">Editar</button><button class="delete" onclick="deleteAdjustment('${x.id}')">Anular</button>`;
      }
      const userLine = x.raw.createdByName ? ` · por ${html(x.raw.createdByName)}` : '';
      return `<div class="item ${x.voided ? 'vv2-voided' : ''}"><div class="item-main"><div><div class="item-title">${html(x.worker)}</div><div class="item-sub">${fmtDate(x.date)} · ${html(x.docNo)} · ${html(x.detail)}${userLine}</div>${tag}</div><div class="amount">${money(amount)}</div></div>${actions ? `<div class="item-actions">${actions}</div>` : ''}</div>`;
    }).join('') : '<div class="empty">No se encontraron movimientos.</div>';
  }

  async function allocateDocument(prefix) {
    const cfg = getCloudConfig();
    if (cloudClient && cloudSession && navigator.onLine) {
      const { data, error } = await cloudClient.rpc('vv_next_document', {
        p_business_slug: cfg.businessSlug,
        p_prefix: prefix
      });
      if (!error && data) return data;
      if (error) console.warn('No fue posible reservar numeración en nube', error);
    }
    state.counters.offline = Number(state.counters.offline || 0) + 1;
    return `${prefix}-${OFFLINE_PREFIX}${getDeviceId()}-${String(state.counters.offline).padStart(4, '0')}`;
  }

  function enhancedNextDoc(prefix) {
    const map = { V: 'sale', A: 'payment', AJ: 'adjustment', G: 'expense' };
    const current = Number(state.counters?.[map[prefix]]) || 0;
    return `${prefix}-${String(current + 1).padStart(4, '0')}`;
  }

  function enhancedPrepareSaleDoc() {
    if (!document.getElementById('saleId').value) {
      document.getElementById('saleDocNo').value = '';
      document.getElementById('saleDocBadge').textContent = cloudSession && navigator.onLine ? 'V-AUTO' : `V-${OFFLINE_PREFIX}`;
    }
  }

  function enhancedPreparePaymentDoc() {
    if (!document.getElementById('paymentId').value) {
      document.getElementById('paymentDocNo').value = '';
      document.getElementById('paymentDocBadge').textContent = cloudSession && navigator.onLine ? 'A-AUTO' : `A-${OFFLINE_PREFIX}`;
    }
  }

  function currentSaleLine() {
    const workerId = document.getElementById('saleWorker').value;
    const productId = document.getElementById('saleProduct').value;
    const worker = workerById(workerId);
    const product = productById(productId);
    const qty = Number(document.getElementById('saleQty').value);
    const price = Number(document.getElementById('salePrice').value);
    if (!worker || !product || qty <= 0 || price < 0) return null;
    return {
      cartId: uid('cart'), workerId, worker: worker.name, productId, product: product.name,
      qty, price, cost: Number(product.cost) || 0
    };
  }

  function addCurrentLineToCart() {
    if (document.getElementById('saleId').value) return toast('Al editar una venta se modifica una sola línea.');
    const line = currentSaleLine();
    if (!line) return alert('Seleccione trabajador, producto, cantidad y precio antes de agregar.');
    const existingWorker = saleCart[0]?.workerId;
    if (existingWorker && existingWorker !== line.workerId) return alert('Todos los productos del comprobante deben corresponder al mismo trabajador.');
    saleCart.push(line);
    renderSaleCart();
    document.getElementById('saleProduct').value = '';
    document.getElementById('salePrice').value = '';
    document.getElementById('saleQty').value = 1;
    enhancedUpdateSaleTotal();
  }

  function removeCartLine(cartId) {
    saleCart = saleCart.filter((x) => x.cartId !== cartId);
    renderSaleCart();
    enhancedUpdateSaleTotal();
  }

  function renderSaleCart() {
    const box = document.getElementById('vv2Cart');
    if (!box) return;
    if (!saleCart.length) {
      box.innerHTML = '<div class="empty">Puede guardar un solo producto o agregar varios al mismo comprobante.</div>';
      return;
    }
    box.innerHTML = saleCart.map((line) => `<div class="vv2-cart-row"><div><b>${html(line.product)}</b><small>${html(line.worker)} · ${line.qty} × ${money(line.price)}</small></div><div class="vv2-line-total"><b>${money(line.qty * line.price)}</b></div><button class="vv2-icon-btn" type="button" onclick="vv2RemoveCartLine('${line.cartId}')">×</button></div>`).join('');
  }

  function enhancedUpdateSaleTotal() {
    const current = currentSaleLine();
    const cartTotal = saleCart.reduce((sum, line) => sum + line.qty * line.price, 0);
    const total = saleCart.length ? cartTotal : (current ? current.qty * current.price : 0);
    document.getElementById('saleTotal').textContent = money(total);
  }

  function adjustProductStock(productId, delta) {
    const product = productById(productId);
    if (!product || product.stock == null || !Number.isFinite(Number(product.stock))) return;
    product.stock = Number(product.stock) + Number(delta);
    product.updatedAt = nowISO();
  }

  async function checkCreditLimit(workerId, addedCredit, exclude = null) {
    const worker = workerById(workerId);
    const limit = Number(worker?.creditLimit) || 0;
    if (!limit || addedCredit <= 0) return true;
    const current = enhancedBalanceAt(workerId, today(), exclude);
    if (current + addedCredit <= limit + 0.005) return true;
    const ok = await enhancedAskConfirmation({
      title: 'Límite de crédito excedido',
      heading: `${worker.name} superará su límite`,
      message: `El saldo proyectado será ${money(current + addedCredit)} y el límite configurado es ${money(limit)}.`,
      detail: `Saldo actual: <b>${money(current)}</b><br>Nueva venta a crédito: <b>${money(addedCredit)}</b><br>Exceso: <b>${money(current + addedCredit - limit)}</b>`,
      confirmText: 'Autorizar venta',
      danger: true,
      requireReason: true
    });
    return !!ok;
  }

  async function handleSaleSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    const id = document.getElementById('saleId').value;
    if (id && !can('edit-sale', state.sales.find((x) => x.id === id))) return deny('Solo el administrador o el creador durante la primera hora puede editar esta venta.');
    if (!id && !can('create-sale')) return deny();
    setBusy(form, true, id ? 'Guardando cambios…' : 'Guardando venta…');
    try {
      const date = document.getElementById('saleDate').value;
      const type = document.getElementById('saleType').value;
      const notes = document.getElementById('saleNotes').value.trim();
      const identity = currentIdentity();
      const previous = id ? cloneV2(state.sales.find((x) => x.id === id)) : null;
      const lines = id ? [currentSaleLine()] : (saleCart.length ? cloneV2(saleCart) : [currentSaleLine()]);
      if (!date || !lines.length || lines.some((x) => !x)) throw new Error('Complete correctamente los datos de la venta.');
      if (new Set(lines.map((x) => x.workerId)).size > 1) throw new Error('Todos los productos deben pertenecer al mismo trabajador.');
      const creditTotal = type === 'Crédito' ? lines.reduce((s, x) => s + x.qty * x.price, 0) : 0;
      const exclude = id ? { source: 'sale', id } : null;
      if (!(await checkStockAvailability(lines, previous))) return;
      if (!(await checkCreditLimit(lines[0].workerId, creditTotal, exclude))) return;

      if (id) {
        const line = lines[0];
        const candidate = {
          ...previous, date, type, workerId: line.workerId, worker: line.worker, productId: line.productId, product: line.product,
          qty: line.qty, price: line.price, cost: line.cost, notes, updatedAt: nowISO(), updatedBy: identity.userId, updatedByName: identity.userName
        };
        const ok = await enhancedAskConfirmation({
          title: 'Confirmar edición', heading: `Guardar cambios en ${previous.docNo}`,
          message: 'La venta conservará su número y quedará registrada la comparación antes/después.',
          detail: diffHtml(previous, candidate, [['date','Fecha'],['worker','Trabajador'],['product','Producto'],['qty','Cantidad'],['price','Precio', money],['type','Condición'],['notes','Observación']]),
          confirmText: 'Guardar cambios', requireReason: true
        });
        if (!ok) return;
        adjustProductStock(previous.productId, Number(previous.qty));
        adjustProductStock(candidate.productId, -Number(candidate.qty));
        const index = state.sales.findIndex((x) => x.id === id);
        state.sales[index] = candidate;
        enhancedAudit('Edición', 'Venta', candidate.docNo, `Venta modificada para ${candidate.worker}`, previous, cloneV2(candidate));
        await enhancedSave();
        lastReceipt = buildSaleReceipt(candidate.docNo);
        showReceipt();
      } else {
        const docNo = await allocateDocument('V');
        const receiptId = uid('rc');
        const createdAt = nowISO();
        const created = lines.map((line) => {
          adjustProductStock(line.productId, -Number(line.qty));
          return {
            id: uid('s'), docNo, receiptId, date, type, workerId: line.workerId, worker: line.worker,
            productId: line.productId, product: line.product, qty: line.qty, price: line.price, cost: line.cost,
            notes, status: 'active', createdAt, updatedAt: createdAt, createdBy: identity.userId,
            createdByName: identity.userName, updatedBy: identity.userId, updatedByName: identity.userName
          };
        });
        state.sales.push(...created);
        enhancedAudit('Creación', 'Venta', docNo, `Comprobante creado para ${created[0].worker} con ${created.length} producto(s)`, null, cloneV2(created));
        await enhancedSave();
        lastReceipt = buildSaleReceipt(docNo);
        showReceipt();
      }
      enhancedResetSaleForm();
      refreshAll();
    } catch (error) {
      alert(error.message || 'No fue posible guardar la venta.');
    } finally {
      setBusy(form, false);
    }
  }

  function enhancedResetSaleForm() {
    base.resetSaleForm();
    saleCart = [];
    renderSaleCart();
    document.getElementById('vv2AddCart')?.classList.remove('hidden');
    enhancedPrepareSaleDoc();
    enhancedUpdateSaleTotal();
  }

  function enhancedEditSale(id) {
    const x = state.sales.find((item) => item.id === id);
    if (!x || !isActive(x)) return;
    if (!can('edit-sale', x)) return deny('Esta venta ya no puede ser editada por su perfil.');
    saleCart = [];
    renderSaleCart();
    go('sale');
    document.getElementById('saleId').value = x.id;
    document.getElementById('saleDocNo').value = x.docNo;
    document.getElementById('saleDocBadge').textContent = x.docNo;
    document.getElementById('salePageTitle').textContent = 'Editar venta';
    document.getElementById('saleDate').value = x.date;
    document.getElementById('saleType').value = x.type;
    document.getElementById('saleWorker').value = x.workerId || resolveWorker(x.worker)?.id || '';
    document.getElementById('saleProduct').value = x.productId || state.products.find((p) => normText(p.name) === normText(x.product))?.id || '';
    document.getElementById('saleQty').value = x.qty;
    document.getElementById('salePrice').value = x.price;
    document.getElementById('saleNotes').value = x.notes || '';
    document.getElementById('vv2AddCart')?.classList.add('hidden');
    enhancedUpdateSaleTotal();
  }

  async function enhancedVoidSale(id) {
    const sale = state.sales.find((x) => x.id === id);
    if (!sale || !isActive(sale)) return;
    if (!can('void')) return deny('Solo el administrador puede anular ventas.');
    const sameReceipt = state.sales.filter((x) => x.docNo === sale.docNo && isActive(x));
    const before = cloneV2(sameReceipt);
    const total = sameReceipt.reduce((s, x) => s + Number(x.qty) * Number(x.price), 0);
    const ok = await enhancedAskConfirmation({
      title: 'Anular venta', heading: `Anular comprobante ${sale.docNo}`,
      message: sameReceipt.length > 1 ? 'Se anularán todas las líneas del mismo comprobante y se devolverá el inventario.' : 'La venta dejará de afectar informes, saldos e inventario, pero no se borrará.',
      detail: `<b>${html(sale.worker)}</b><br>${sameReceipt.length} producto(s) · ${money(total)}`,
      confirmText: 'Anular venta', danger: true, requiredWord: 'ANULAR', requireReason: true
    });
    if (!ok) return;
    const identity = currentIdentity();
    sameReceipt.forEach((x) => {
      x.status = 'voided'; x.voidReason = lastConfirmationReason; x.voidedAt = nowISO(); x.voidedBy = identity.userId; x.voidedByName = identity.userName; x.updatedAt = nowISO();
      adjustProductStock(x.productId, Number(x.qty));
    });
    enhancedAudit('Anulación', 'Venta', sale.docNo, `Comprobante anulado para ${sale.worker}`, before, cloneV2(sameReceipt));
    await enhancedSave();
    refreshAll();
    toast('Venta anulada; el historial se conserva');
  }

  function enhancedUpdatePaymentPreview() {
    if (!state) return;
    const workerId = document.getElementById('paymentWorker').value;
    const date = document.getElementById('paymentDate').value || today();
    const editId = document.getElementById('paymentId').value;
    const balance = workerId ? enhancedBalanceAt(workerId, date, editId ? { source: 'payment', id: editId } : null) : 0;
    const after = balance - (Number(document.getElementById('paymentAmount').value) || 0);
    document.getElementById('paymentCurrentBalance').textContent = money(balance);
    document.getElementById('paymentAfterBalance').textContent = money(after);
    document.getElementById('paymentAfterBalance').className = after < -0.005 ? 'danger-text' : '';
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    const id = document.getElementById('paymentId').value;
    const previous = id ? state.payments.find((x) => x.id === id) : null;
    if (id && !can('edit-payment', previous)) return deny('Solo el administrador o el creador durante la primera hora puede editar este abono.');
    if (!id && !can('create-payment')) return deny();
    setBusy(form, true, id ? 'Guardando cambios…' : 'Guardando abono…');
    try {
      const workerId = document.getElementById('paymentWorker').value;
      const worker = workerById(workerId);
      const amount = Number(document.getElementById('paymentAmount').value);
      const date = document.getElementById('paymentDate').value;
      if (!worker || amount <= 0 || !date) throw new Error('Complete correctamente los datos del abono.');
      const current = enhancedBalanceAt(workerId, date, id ? { source: 'payment', id } : null);
      if (amount > current + 0.005) {
        const over = await enhancedAskConfirmation({
          title: 'Abono mayor al saldo', heading: 'Se generará saldo a favor',
          message: `El abono supera el saldo registrado por ${money(amount - current)}.`,
          detail: `Trabajador: <b>${html(worker.name)}</b><br>Abono: ${money(amount)} · Saldo antes del abono: ${money(current)}`,
          confirmText: 'Registrar de todos modos', requireReason: true
        });
        if (!over) return;
      }
      const identity = currentIdentity();
      if (id) {
        const before = cloneV2(previous);
        const candidate = {
          ...previous,
          date, workerId, worker: worker.name, amount,
          method: document.getElementById('paymentMethod').value,
          reference: document.getElementById('paymentReference').value.trim(),
          notes: document.getElementById('paymentNotes').value.trim(),
          updatedAt: nowISO(), updatedBy: identity.userId, updatedByName: identity.userName
        };
        const ok = await enhancedAskConfirmation({
          title: 'Confirmar edición', heading: `Guardar cambios en ${candidate.docNo}`,
          message: 'El saldo se recalculará excluyendo correctamente el abono anterior.',
          detail: diffHtml(before, candidate, [['date','Fecha'],['worker','Trabajador'],['amount','Monto', money],['method','Medio'],['reference','Referencia'],['notes','Observación']]),
          confirmText: 'Guardar cambios', requireReason: true
        });
        if (!ok) return;
        state.payments[state.payments.findIndex((x) => x.id === id)] = candidate;
        enhancedAudit('Edición', 'Abono', candidate.docNo, `Abono modificado para ${candidate.worker}`, before, cloneV2(candidate));
        await enhancedSave();
        lastReceipt = buildPaymentReceipt(candidate);
      } else {
        const docNo = await allocateDocument('A');
        const createdAt = nowISO();
        const payment = {
          id: uid('a'), docNo, date, workerId, worker: worker.name, amount,
          method: document.getElementById('paymentMethod').value,
          reference: document.getElementById('paymentReference').value.trim(),
          notes: document.getElementById('paymentNotes').value.trim(),
          status: 'active', createdAt, updatedAt: createdAt,
          createdBy: identity.userId, createdByName: identity.userName,
          updatedBy: identity.userId, updatedByName: identity.userName
        };
        state.payments.push(payment);
        enhancedAudit('Creación', 'Abono', docNo, `Abono registrado para ${worker.name}`, null, cloneV2(payment));
        await enhancedSave();
        lastReceipt = buildPaymentReceipt(payment);
      }
      enhancedResetPaymentForm();
      refreshAll();
      showReceipt();
    } catch (error) {
      alert(error.message || 'No fue posible guardar el abono.');
    } finally {
      setBusy(form, false);
    }
  }

  function enhancedResetPaymentForm() {
    base.resetPaymentForm();
    enhancedPreparePaymentDoc();
    enhancedUpdatePaymentPreview();
  }

  function enhancedEditPayment(id) {
    const x = state.payments.find((item) => item.id === id);
    if (!x || !isActive(x)) return;
    if (!can('edit-payment', x)) return deny('Este abono ya no puede ser editado por su perfil.');
    go('payment');
    document.getElementById('paymentId').value = x.id;
    document.getElementById('paymentDocNo').value = x.docNo;
    document.getElementById('paymentDocBadge').textContent = x.docNo;
    document.getElementById('paymentPageTitle').textContent = 'Editar abono';
    document.getElementById('paymentDate').value = x.date;
    document.getElementById('paymentWorker').value = x.workerId || resolveWorker(x.worker)?.id || '';
    document.getElementById('paymentAmount').value = x.amount;
    document.getElementById('paymentMethod').value = x.method;
    document.getElementById('paymentReference').value = x.reference || '';
    document.getElementById('paymentNotes').value = x.notes || '';
    enhancedUpdatePaymentPreview();
  }

  async function enhancedVoidPayment(id) {
    const payment = state.payments.find((x) => x.id === id);
    if (!payment || !isActive(payment)) return;
    if (!can('void')) return deny('Solo el administrador puede anular abonos.');
    const before = cloneV2(payment);
    const ok = await enhancedAskConfirmation({
      title: 'Anular abono', heading: `Anular ${payment.docNo}`,
      message: 'El abono dejará de reducir la deuda, pero permanecerá visible en el historial.',
      detail: `<b>${html(payment.worker)}</b><br>${money(payment.amount)} · ${html(payment.method)}`,
      confirmText: 'Anular abono', danger: true, requiredWord: 'ANULAR', requireReason: true
    });
    if (!ok) return;
    const identity = currentIdentity();
    payment.status = 'voided'; payment.voidReason = lastConfirmationReason; payment.voidedAt = nowISO(); payment.voidedBy = identity.userId; payment.voidedByName = identity.userName; payment.updatedAt = nowISO();
    enhancedAudit('Anulación', 'Abono', payment.docNo, `Abono anulado de ${payment.worker}`, before, cloneV2(payment));
    await enhancedSave();
    refreshAll();
    toast('Abono anulado; el historial se conserva');
  }

  async function handleAdjustmentSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!can('adjustment')) return deny('Solo el administrador puede registrar o editar ajustes.');
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    setBusy(form, true, 'Guardando ajuste…');
    try {
      const id = document.getElementById('adjustmentId').value;
      const previous = id ? state.adjustments.find((x) => x.id === id) : null;
      const workerId = document.getElementById('adjustmentWorker').value;
      const worker = workerById(workerId);
      const amount = Number(document.getElementById('adjustmentAmount').value);
      const concept = document.getElementById('adjustmentConcept').value.trim();
      if (!worker || amount <= 0 || !concept) throw new Error('Complete correctamente el ajuste.');
      const identity = currentIdentity();
      if (id) {
        const before = cloneV2(previous);
        const candidate = {
          ...previous,
          date: document.getElementById('adjustmentDate').value,
          workerId, worker: worker.name,
          type: document.getElementById('adjustmentType').value,
          amount, concept,
          notes: document.getElementById('adjustmentNotes').value.trim(),
          updatedAt: nowISO(), updatedBy: identity.userId, updatedByName: identity.userName
        };
        const ok = await enhancedAskConfirmation({
          title: 'Confirmar edición', heading: `Guardar cambios en ${candidate.docNo}`,
          message: 'El ajuste modificará el saldo contable y quedará registrado en auditoría.',
          detail: diffHtml(before, candidate, [['date','Fecha'],['worker','Trabajador'],['type','Tipo'],['amount','Monto', money],['concept','Concepto'],['notes','Observación']]),
          confirmText: 'Guardar cambios', requireReason: true
        });
        if (!ok) return;
        state.adjustments[state.adjustments.findIndex((x) => x.id === id)] = candidate;
        enhancedAudit('Edición', 'Ajuste', candidate.docNo, `Ajuste modificado para ${candidate.worker}`, before, cloneV2(candidate));
      } else {
        const docNo = await allocateDocument('AJ');
        const createdAt = nowISO();
        const adjustment = {
          id: uid('j'), docNo, date: document.getElementById('adjustmentDate').value,
          workerId, worker: worker.name, type: document.getElementById('adjustmentType').value,
          amount, concept, notes: document.getElementById('adjustmentNotes').value.trim(),
          status: 'active', createdAt, updatedAt: createdAt,
          createdBy: identity.userId, createdByName: identity.userName,
          updatedBy: identity.userId, updatedByName: identity.userName
        };
        state.adjustments.push(adjustment);
        enhancedAudit('Creación', 'Ajuste', docNo, `Ajuste registrado para ${worker.name}`, null, cloneV2(adjustment));
      }
      await enhancedSave();
      closeModal('adjustmentModal');
      refreshAll();
      toast(id ? 'Ajuste actualizado' : 'Ajuste registrado');
    } catch (error) {
      alert(error.message || 'No fue posible guardar el ajuste.');
    } finally {
      setBusy(form, false);
    }
  }

  function enhancedEditAdjustment(id) {
    if (!can('adjustment')) return deny();
    const x = state.adjustments.find((item) => item.id === id);
    if (!x || !isActive(x)) return;
    base.openAdjustment();
    document.getElementById('adjustmentTitle').textContent = 'Editar ajuste';
    document.getElementById('adjustmentId').value = x.id;
    document.getElementById('adjustmentDocNo').value = x.docNo;
    document.getElementById('adjustmentDate').value = x.date;
    document.getElementById('adjustmentWorker').value = x.workerId || resolveWorker(x.worker)?.id || '';
    document.getElementById('adjustmentType').value = x.type;
    document.getElementById('adjustmentAmount').value = x.amount;
    document.getElementById('adjustmentConcept').value = x.concept;
    document.getElementById('adjustmentNotes').value = x.notes || '';
  }

  async function enhancedVoidAdjustment(id) {
    const adjustment = state.adjustments.find((x) => x.id === id);
    if (!adjustment || !isActive(adjustment)) return;
    if (!can('void')) return deny('Solo el administrador puede anular ajustes.');
    const before = cloneV2(adjustment);
    const ok = await enhancedAskConfirmation({
      title: 'Anular ajuste', heading: `Anular ${adjustment.docNo}`,
      message: 'El ajuste dejará de afectar el saldo, pero se conservará para auditoría.',
      detail: `<b>${html(adjustment.worker)}</b><br>${html(adjustment.type)} · ${money(adjustment.amount)} · ${html(adjustment.concept)}`,
      confirmText: 'Anular ajuste', danger: true, requiredWord: 'ANULAR', requireReason: true
    });
    if (!ok) return;
    const identity = currentIdentity();
    adjustment.status = 'voided'; adjustment.voidReason = lastConfirmationReason; adjustment.voidedAt = nowISO(); adjustment.voidedBy = identity.userId; adjustment.voidedByName = identity.userName; adjustment.updatedAt = nowISO();
    enhancedAudit('Anulación', 'Ajuste', adjustment.docNo, `Ajuste anulado de ${adjustment.worker}`, before, cloneV2(adjustment));
    await enhancedSave();
    refreshAll();
    toast('Ajuste anulado; el historial se conserva');
  }

  function toggleCatalogExtras(type) {
    document.getElementById('vv2ProductExtra')?.classList.toggle('hidden', type !== 'products');
    document.getElementById('vv2WorkerExtra')?.classList.toggle('hidden', type !== 'workers');
  }

  function enhancedOpenCatalog(type) {
    if (!can('catalog')) return deny('Solo el administrador puede modificar trabajadores y productos.');
    base.openCatalog(type);
    toggleCatalogExtras(type);
    document.getElementById('vv2ProductCost').value = '';
    document.getElementById('vv2ProductStock').value = '';
    document.getElementById('vv2ProductMinStock').value = '';
    document.getElementById('vv2WorkerLimit').value = '';
    document.getElementById('vv2WorkerTerm').value = state.settings.defaultPaymentTermDays || 15;
    enhancedRenderCatalog();
  }

  async function handleCatalogSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!can('catalog')) return deny();
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    setBusy(form, true, 'Guardando…');
    try {
      const arr = state[catalogType];
      const id = document.getElementById('catalogId').value;
      const name = document.getElementById('catalogName').value.trim().replace(/\s+/g, ' ');
      if (!name) throw new Error('Ingrese un nombre.');
      const duplicate = arr.find((x) => x.id !== id && normText(x.name) === normText(name));
      if (duplicate) throw new Error(`Ya existe ${catalogType === 'products' ? 'un producto' : 'un trabajador'} con ese nombre.`);
      const previous = id ? cloneV2(arr.find((x) => x.id === id)) : null;
      const identity = currentIdentity();
      const obj = {
        id: id || uid(catalogType === 'workers' ? 'w' : 'p'),
        name,
        notes: document.getElementById('catalogNotes').value.trim(),
        active: previous?.active !== false,
        createdAt: previous?.createdAt || nowISO(),
        updatedAt: nowISO(), updatedBy: identity.userId, updatedByName: identity.userName
      };
      if (catalogType === 'products') {
        obj.price = Number(document.getElementById('catalogPrice').value) || 0;
        obj.cost = Number(document.getElementById('vv2ProductCost').value) || 0;
        const stockRaw = document.getElementById('vv2ProductStock').value;
        obj.stock = stockRaw === '' ? null : Number(stockRaw);
        obj.minStock = Number(document.getElementById('vv2ProductMinStock').value) || 0;
      } else {
        obj.creditLimit = Number(document.getElementById('vv2WorkerLimit').value) || 0;
        obj.paymentTermDays = Number(document.getElementById('vv2WorkerTerm').value) || 15;
      }
      if (id) {
        const fields = catalogType === 'products'
          ? [['name','Nombre'],['price','Precio',money],['cost','Costo',money],['stock','Existencia'],['minStock','Mínimo'],['notes','Observación']]
          : [['name','Nombre'],['creditLimit','Límite',money],['paymentTermDays','Plazo en días'],['notes','Observación']];
        const ok = await enhancedAskConfirmation({
          title: 'Confirmar edición', heading: `Guardar cambios de ${name}`,
          message: 'El historial seguirá vinculado mediante el ID permanente, aunque cambie el nombre.',
          detail: diffHtml(previous, obj, fields), confirmText: 'Guardar cambios', requireReason: true
        });
        if (!ok) return;
        arr[arr.findIndex((x) => x.id === id)] = { ...previous, ...obj };
        enhancedAudit('Edición', catalogType === 'products' ? 'Producto' : 'Trabajador', name, 'Catálogo modificado', previous, cloneV2(obj));
      } else {
        arr.push(obj);
        enhancedAudit('Creación', catalogType === 'products' ? 'Producto' : 'Trabajador', name, 'Registro agregado al catálogo', null, cloneV2(obj));
      }
      await enhancedSave();
      enhancedOpenCatalog(catalogType);
      refreshAll();
    } catch (error) {
      alert(error.message || 'No fue posible guardar el catálogo.');
    } finally {
      setBusy(form, false);
    }
  }

  function enhancedRenderCatalog() {
    const q = normText(document.getElementById('catalogSearch')?.value || '');
    const arr = state[catalogType]
      .filter((x) => normText(x.name).includes(q))
      .sort((a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name, 'es'));
    document.getElementById('catalogList').innerHTML = arr.length ? arr.map((x) => {
      const detail = catalogType === 'products'
        ? `${money(x.price)}${x.stock == null ? '' : ` · Existencia ${Number(x.stock)}`}${Number(x.cost) ? ` · Margen ${money(Number(x.price) - Number(x.cost))}` : ''}`
        : `${Number(x.creditLimit) ? `Límite ${money(x.creditLimit)} · ` : ''}${Number(x.paymentTermDays || 15)} días · ${x.notes || 'Sin observación'}`;
      return `<div class="item ${x.active === false ? 'vv2-voided' : ''}"><div class="item-main"><div><div class="item-title">${html(x.name)}</div><div class="item-sub">${html(detail)}</div>${x.active === false ? '<span class="vv2-status-pill voided">Inactivo</span>' : ''}</div></div><div class="item-actions"><button class="edit" onclick="editCatalog('${x.id}')">Editar</button><button class="${x.active === false ? 'statement' : 'delete'}" onclick="deleteCatalog('${x.id}')">${x.active === false ? 'Reactivar' : 'Desactivar'}</button></div></div>`;
    }).join('') : '<div class="empty">Catálogo vacío.</div>';
  }

  function enhancedEditCatalog(id) {
    if (!can('catalog')) return deny();
    const x = state[catalogType].find((item) => item.id === id);
    if (!x) return;
    document.getElementById('catalogId').value = x.id;
    document.getElementById('catalogName').value = x.name;
    document.getElementById('catalogNotes').value = x.notes || '';
    toggleCatalogExtras(catalogType);
    if (catalogType === 'products') {
      document.getElementById('catalogPrice').value = x.price;
      document.getElementById('vv2ProductCost').value = x.cost || '';
      document.getElementById('vv2ProductStock').value = x.stock == null ? '' : x.stock;
      document.getElementById('vv2ProductMinStock').value = x.minStock || '';
    } else {
      document.getElementById('vv2WorkerLimit').value = x.creditLimit || '';
      document.getElementById('vv2WorkerTerm').value = x.paymentTermDays || 15;
    }
    document.getElementById('catalogName').focus();
  }

  async function enhancedToggleCatalog(id) {
    if (!can('catalog')) return deny();
    const item = state[catalogType].find((x) => x.id === id);
    if (!item) return;
    const activating = item.active === false;
    const before = cloneV2(item);
    const label = catalogType === 'products' ? 'producto' : 'trabajador';
    const ok = await enhancedAskConfirmation({
      title: activating ? `Reactivar ${label}` : `Desactivar ${label}`,
      heading: `${activating ? 'Reactivar' : 'Desactivar'} ${item.name}`,
      message: activating ? 'Volverá a estar disponible para nuevos registros.' : 'No aparecerá en nuevas ventas o abonos, pero su historial se conservará.',
      detail: `<b>${html(item.name)}</b><br>${catalogType === 'products' ? `Precio actual: ${money(item.price)}` : `Saldo actual: ${money(enhancedBalanceAt(item.id, today()))}`}`,
      confirmText: activating ? 'Reactivar' : 'Desactivar', danger: !activating, requireReason: true
    });
    if (!ok) return;
    item.active = activating;
    item.updatedAt = nowISO();
    item.updatedBy = currentIdentity().userId;
    enhancedAudit(activating ? 'Reactivación' : 'Desactivación', catalogType === 'products' ? 'Producto' : 'Trabajador', item.name, `${label} ${activating ? 'reactivado' : 'desactivado'}`, before, cloneV2(item));
    await enhancedSave();
    enhancedRenderCatalog();
    refreshAll();
  }

  async function vv2RestoreRecord(source, id) {
    if (!can('void')) return deny('Solo el administrador puede restaurar movimientos.');
    const map = { sale: state.sales, payment: state.payments, adjustment: state.adjustments };
    const arr = map[source];
    const record = arr?.find((x) => x.id === id);
    if (!record || isActive(record)) return;
    const records = source === 'sale' ? state.sales.filter((x) => x.docNo === record.docNo && !isActive(x)) : [record];
    const before = cloneV2(records);
    const ok = await enhancedAskConfirmation({
      title: 'Restaurar movimiento', heading: `Restaurar ${record.docNo}`,
      message: 'El movimiento volverá a afectar saldos, informes y, en ventas, inventario.',
      detail: `<b>${html(record.worker)}</b><br>${source === 'sale' ? `${records.length} producto(s)` : money(record.amount)}`,
      confirmText: 'Restaurar', requireReason: true
    });
    if (!ok) return;
    const identity = currentIdentity();
    records.forEach((x) => {
      x.status = 'active';
      x.restoredAt = nowISO(); x.restoredBy = identity.userId; x.restoredByName = identity.userName; x.restoreReason = lastConfirmationReason;
      x.updatedAt = nowISO();
      if (source === 'sale') adjustProductStock(x.productId, -Number(x.qty));
    });
    enhancedAudit('Restauración', source === 'sale' ? 'Venta' : source === 'payment' ? 'Abono' : 'Ajuste', record.docNo, 'Movimiento restaurado', before, cloneV2(records));
    await enhancedSave();
    refreshAll();
    toast('Movimiento restaurado');
  }

  function cashTotals(date) {
    const cashSales = activeRecords(state.sales)
      .filter((x) => x.date === date && x.type === 'Contado')
      .reduce((sum, x) => sum + Number(x.qty) * Number(x.price), 0);
    const cashPayments = activeRecords(state.payments)
      .filter((x) => x.date === date && normText(x.method) === 'efectivo')
      .reduce((sum, x) => sum + Number(x.amount), 0);
    const otherPayments = activeRecords(state.payments)
      .filter((x) => x.date === date && normText(x.method) !== 'efectivo')
      .reduce((sum, x) => sum + Number(x.amount), 0);
    return { cashSales, cashPayments, otherPayments, expected: cashSales + cashPayments };
  }

  function vv2OpenCashClosing() {
    if (!can('cash-closing')) return deny('Solo el administrador puede cerrar caja.');
    const date = today();
    const existing = state.cashClosings.find((x) => x.date === date && isActive(x));
    document.getElementById('vv2CashDate').value = date;
    document.getElementById('vv2CashCounted').value = existing?.counted ?? '';
    document.getElementById('vv2CashNotes').value = existing?.notes || '';
    document.getElementById('vv2CashForm').dataset.id = existing?.id || '';
    renderCashClosingPreview();
    document.getElementById('vv2CashModal').classList.add('show');
  }

  function renderCashClosingPreview() {
    const date = document.getElementById('vv2CashDate')?.value || today();
    const totals = cashTotals(date);
    const counted = Number(document.getElementById('vv2CashCounted')?.value) || 0;
    const difference = counted - totals.expected;
    if (document.getElementById('vv2CashSales')) document.getElementById('vv2CashSales').textContent = money(totals.cashSales);
    if (document.getElementById('vv2CashPayments')) document.getElementById('vv2CashPayments').textContent = money(totals.cashPayments);
    if (document.getElementById('vv2CashExpected')) document.getElementById('vv2CashExpected').textContent = money(totals.expected);
    if (document.getElementById('vv2CashDifference')) {
      document.getElementById('vv2CashDifference').textContent = money(difference);
      document.getElementById('vv2CashDifference').className = Math.abs(difference) > 0.005 ? 'danger-text' : '';
    }
  }

  async function saveCashClosing(event) {
    event.preventDefault();
    if (!can('cash-closing')) return deny();
    const form = event.currentTarget;
    if (form.dataset.busy === '1') return;
    setBusy(form, true, 'Guardando cierre…');
    try {
      const date = document.getElementById('vv2CashDate').value;
      const counted = Number(document.getElementById('vv2CashCounted').value);
      const notes = document.getElementById('vv2CashNotes').value.trim();
      if (!date || counted < 0) throw new Error('Complete correctamente el cierre.');
      const totals = cashTotals(date);
      const id = form.dataset.id;
      const previous = id ? state.cashClosings.find((x) => x.id === id) : null;
      const identity = currentIdentity();
      const closing = {
        id: id || uid('cc'), date, cashSales: totals.cashSales, cashPayments: totals.cashPayments,
        otherPayments: totals.otherPayments, expected: totals.expected, counted,
        difference: counted - totals.expected, notes, status: 'active',
        createdAt: previous?.createdAt || nowISO(), updatedAt: nowISO(),
        createdBy: previous?.createdBy || identity.userId, createdByName: previous?.createdByName || identity.userName,
        updatedBy: identity.userId, updatedByName: identity.userName
      };
      if (previous) {
        const ok = await enhancedAskConfirmation({
          title: 'Actualizar cierre de caja', heading: `Modificar cierre del ${fmtDate(date)}`,
          message: 'La modificación quedará registrada con el valor anterior y el nuevo.',
          detail: diffHtml(previous, closing, [['expected','Esperado',money],['counted','Contado',money],['difference','Diferencia',money],['notes','Observación']]),
          confirmText: 'Actualizar cierre', requireReason: true
        });
        if (!ok) return;
        state.cashClosings[state.cashClosings.findIndex((x) => x.id === id)] = closing;
        enhancedAudit('Edición', 'Cierre de caja', date, 'Cierre diario modificado', cloneV2(previous), cloneV2(closing));
      } else {
        state.cashClosings.push(closing);
        enhancedAudit('Creación', 'Cierre de caja', date, 'Cierre diario registrado', null, cloneV2(closing));
      }
      await enhancedSave();
      closeModal('vv2CashModal');
      refreshAll();
      toast(`Cierre guardado · diferencia ${money(closing.difference)}`);
    } catch (error) {
      alert(error.message || 'No fue posible guardar el cierre.');
    } finally {
      setBusy(form, false);
    }
  }

  function buildSaleReceipt(docNo) {
    const lines = state.sales.filter((x) => x.docNo === docNo);
    if (!lines.length) return null;
    const first = lines[0];
    return {
      kind: 'sale', docNo, date: first.date, worker: resolveWorker(first.workerId)?.name || first.worker,
      type: first.type, items: lines.map((x) => ({ product: x.product, qty: Number(x.qty), price: Number(x.price), total: Number(x.qty) * Number(x.price) })),
      total: lines.reduce((s, x) => s + Number(x.qty) * Number(x.price), 0),
      user: first.createdByName || currentIdentity().userName,
      notes: first.notes || ''
    };
  }

  function buildPaymentReceipt(payment) {
    const before = enhancedBalanceAt(payment.workerId || payment.worker, payment.date, { source: 'payment', id: payment.id });
    return {
      kind: 'payment', docNo: payment.docNo, date: payment.date,
      worker: resolveWorker(payment.workerId)?.name || payment.worker,
      amount: Number(payment.amount), method: payment.method, reference: payment.reference || '',
      before, after: before - Number(payment.amount), user: payment.createdByName || currentIdentity().userName,
      notes: payment.notes || ''
    };
  }

  function receiptHtml(receipt) {
    if (!receipt) return '<div class="empty">No hay comprobante disponible.</div>';
    if (receipt.kind === 'sale') {
      const rows = receipt.items.map((item) => `<tr><td>${html(item.product)}<br><small>${item.qty} × ${money(item.price)}</small></td><td class="num">${money(item.total)}</td></tr>`).join('');
      return `<div class="vv2-receipt"><h2>${html(state.settings.businessName)}</h2><div class="sub">Comprobante de venta · ${html(receipt.docNo)} · ${fmtDate(receipt.date)}</div><table><tr><th>Trabajador</th><td class="num">${html(receipt.worker)}</td></tr><tr><th>Condición</th><td class="num">${html(receipt.type)}</td></tr>${rows}</table><div class="vv2-total-line"><span>Total</span><span>${money(receipt.total)}</span></div>${receipt.notes ? `<div class="notice mt10">${html(receipt.notes)}</div>` : ''}<div class="sub mt10">Registrado por ${html(receipt.user)}</div></div>`;
    }
    return `<div class="vv2-receipt"><h2>${html(state.settings.businessName)}</h2><div class="sub">Recibo de abono · ${html(receipt.docNo)} · ${fmtDate(receipt.date)}</div><table><tr><th>Trabajador</th><td class="num">${html(receipt.worker)}</td></tr><tr><th>Medio</th><td class="num">${html(receipt.method)}</td></tr>${receipt.reference ? `<tr><th>Referencia</th><td class="num">${html(receipt.reference)}</td></tr>` : ''}<tr><th>Saldo anterior</th><td class="num">${money(receipt.before)}</td></tr><tr><th>Abono</th><td class="num">${money(receipt.amount)}</td></tr><tr><th>Saldo restante</th><td class="num"><b>${money(receipt.after)}</b></td></tr></table>${receipt.notes ? `<div class="notice mt10">${html(receipt.notes)}</div>` : ''}<div class="sub mt10">Registrado por ${html(receipt.user)}</div></div>`;
  }

  function receiptText(receipt) {
    if (!receipt) return '';
    if (receipt.kind === 'sale') {
      const items = receipt.items.map((x) => `• ${x.product}: ${x.qty} × ${money(x.price)} = ${money(x.total)}`).join('\n');
      return `${state.settings.businessName}\nComprobante ${receipt.docNo}\nFecha: ${fmtDate(receipt.date)}\nTrabajador: ${receipt.worker}\nCondición: ${receipt.type}\n${items}\nTotal: ${money(receipt.total)}\nRegistrado por: ${receipt.user}`;
    }
    return `${state.settings.businessName}\nRecibo ${receipt.docNo}\nFecha: ${fmtDate(receipt.date)}\nTrabajador: ${receipt.worker}\nAbono: ${money(receipt.amount)}\nMedio: ${receipt.method}\nSaldo anterior: ${money(receipt.before)}\nSaldo restante: ${money(receipt.after)}\nRegistrado por: ${receipt.user}`;
  }

  function showReceipt() {
    if (!lastReceipt) return;
    document.getElementById('vv2ReceiptBody').innerHTML = receiptHtml(lastReceipt);
    document.getElementById('vv2ReceiptModal').classList.add('show');
  }

  function vv2PrintReceipt() {
    if (!lastReceipt) return;
    const popup = window.open('', '_blank');
    if (!popup) return alert('Permita ventanas emergentes para imprimir el comprobante.');
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${html(lastReceipt.docNo)}</title><style>body{font-family:Arial,sans-serif;margin:22px;color:#17221e}.vv2-receipt{max-width:520px;margin:auto}.vv2-receipt h2{text-align:center}.sub{text-align:center;color:#66746e;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}.num{text-align:right}.vv2-total-line{display:flex;justify-content:space-between;font-size:20px;font-weight:bold;margin-top:15px}.notice{margin-top:12px;padding:10px;border:1px solid #ddd;border-radius:8px}@media print{body{margin:0}}</style></head><body>${receiptHtml(lastReceipt)}<script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  async function vv2ShareReceipt() {
    if (!lastReceipt) return;
    const text = receiptText(lastReceipt);
    if (navigator.share) {
      try { await navigator.share({ title: `${lastReceipt.docNo} · ${state.settings.businessName}`, text }); } catch (_) {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      toast('Comprobante copiado');
    }
  }

  function backupPayload() {
    return {
      backupSchema: 'ventas-victor-v2',
      backupVersion: 3,
      generatedAt: nowISO(),
      generatedBy: currentIdentity(),
      appVersion: VV2_VERSION,
      state: cloneV2(state)
    };
  }

  function downloadCurrentBackup(prefix = 'Respaldo_Ventas_Victor') {
    const payload = backupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `${prefix}_${today()}_${new Date().toTimeString().slice(0,5).replace(':','')}.json`);
  }

  function enhancedExportBackup() {
    downloadCurrentBackup();
    toast('Respaldo completo generado');
  }

  function validateBackupData(data) {
    const candidate = data?.state && data?.backupSchema ? data.state : data;
    if (!candidate || typeof candidate !== 'object') throw new Error('El archivo no contiene una base de datos válida.');
    candidate.expenses = Array.isArray(candidate.expenses) ? candidate.expenses : [];
    for (const key of ['workers', 'products', 'sales', 'payments', 'adjustments', 'expenses']) {
      if (!Array.isArray(candidate[key])) throw new Error(`Falta la colección obligatoria: ${key}.`);
    }
    if (!candidate.settings || typeof candidate.settings !== 'object') throw new Error('Falta la configuración del negocio.');
    const tooMany = ['workers','products','sales','payments','adjustments','expenses'].some((key) => candidate[key].length > 500000);
    if (tooMany) throw new Error('El respaldo excede el tamaño razonable permitido.');
    candidate.sales.forEach((x, i) => {
      if (!x.date || !x.worker || !x.product || Number(x.qty) < 0 || Number(x.price) < 0) throw new Error(`Venta inválida en la posición ${i + 1}.`);
    });
    candidate.payments.forEach((x, i) => {
      if (!x.date || !x.worker || Number(x.amount) < 0) throw new Error(`Abono inválido en la posición ${i + 1}.`);
    });
    candidate.expenses.forEach((x, i) => {
      if (!x.date || !x.description || Number(x.amount) < 0) throw new Error(`Gasto inválido en la posición ${i + 1}.`);
    });
    return cloneV2(candidate);
  }

  function enhancedImportBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!can('restore')) { event.target.value = ''; return deny('Solo el administrador puede restaurar respaldos.'); }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const candidate = validateBackupData(JSON.parse(reader.result));
        const counts = `${candidate.sales.length} ventas · ${candidate.payments.length} abonos · ${candidate.adjustments.length} ajustes · ${candidate.expenses.length} gastos`;
        const ok = await enhancedAskConfirmation({
          title: 'Restaurar respaldo', heading: 'Reemplazar la base compartida',
          message: 'Antes de restaurar se descargará automáticamente una copia de seguridad del estado actual. En modo nube, el respaldo restaurado se sincronizará con los demás usuarios.',
          detail: `<b>${html(file.name)}</b><br>${html(counts)}`,
          confirmText: 'Restaurar respaldo', danger: true, requiredWord: 'RESTAURAR', requireReason: true
        });
        if (!ok) return;
        downloadCurrentBackup('Respaldo_Antes_Restaurar');
        const beforeInfo = { sales: state.sales.length, payments: state.payments.length, adjustments: state.adjustments.length, expenses: state.expenses.length, updatedAt: state.updatedAt };
        state = candidate;
        enhancedNormalize();
        enhancedAudit('Restauración', 'Base de datos', file.name, 'Respaldo restaurado', beforeInfo, { sales: state.sales.length, payments: state.payments.length, adjustments: state.adjustments.length, expenses: state.expenses.length });
        pendingCloudSave = true;
        await enhancedSave();
        initDates();
        refreshAll();
        toast('Respaldo restaurado y validado');
      } catch (error) {
        alert(`No fue posible restaurar: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function enhancedClearTransactions() {
    if (!can('clear')) return deny('Solo el administrador puede eliminar movimientos de prueba.');
    const total = state.sales.length + state.payments.length + state.adjustments.length + state.expenses.length;
    if (!total) return toast('No hay movimientos para limpiar');
    const ok = await enhancedAskConfirmation({
      title: 'Limpiar movimientos de prueba', heading: `Retirar ${total} movimientos`,
      message: 'Se descargará un respaldo automático antes de limpiar. Trabajadores, productos y configuración se conservarán.',
      detail: `${state.sales.length} ventas · ${state.payments.length} abonos · ${state.adjustments.length} ajustes · ${state.expenses.length} gastos`,
      confirmText: 'Limpiar movimientos', danger: true, requiredWord: 'BORRAR', requireReason: true
    });
    if (!ok) return;
    downloadCurrentBackup('Respaldo_Antes_Limpieza');
    const before = { sales: state.sales.length, payments: state.payments.length, adjustments: state.adjustments.length, expenses: state.expenses.length };
    state.sales = [];
    state.payments = [];
    state.adjustments = [];
    state.expenses = [];
    state.cashClosings = [];
    enhancedAudit('Limpieza', 'Base de datos', '', 'Movimientos de prueba eliminados después de respaldo automático', before, { sales: 0, payments: 0, adjustments: 0, expenses: 0 });
    await enhancedSave();
    refreshAll();
    toast('Movimientos limpiados; respaldo descargado');
  }

  function enhancedRenderMaintenanceCount() {
    const active = activeRecords(state.sales).length + activeRecords(state.payments).length + activeRecords(state.adjustments).length + activeRecords(state.expenses).length;
    const voided = (state.sales.length + state.payments.length + state.adjustments.length + state.expenses.length) - active;
    const el = document.getElementById('maintenanceCount');
    if (el) el.textContent = `${active} movimientos activos · ${voided} anulados · ${state.expenses.length} gastos registrados · ${state.cashClosings.length} cierres de caja`;
  }

  function enhancedExportXLSX() {
    withActiveState(() => base.exportXLSX());
  }

  function enhancedQuickPayment(worker) {
    if (!can('create-payment')) return deny();
    go('payment');
    const resolved = resolveWorker(worker);
    document.getElementById('paymentWorker').value = resolved?.id || '';
    enhancedUpdatePaymentPreview();
  }

  function enhancedOpenAdjustment() {
    if (!can('adjustment')) return deny('Solo el administrador puede registrar ajustes.');
    base.openAdjustment();
    document.getElementById('adjustmentDocNo').value = '';
  }

  function enhancedOpenSettings() {
    if (!can('settings')) return deny('Solo el administrador puede cambiar la configuración.');
    base.openSettings();
  }

  function applyRoleUI() {
    const locked = cloudConfigured() && cloudRole === 'viewer';
    document.body.classList.toggle('vv2-readonly', locked);
    const set = (selector, allowed) => document.querySelectorAll(selector).forEach((el) => {
      el.disabled = !allowed;
      el.title = allowed ? '' : 'Acción no disponible para este perfil';
    });
    set('#saleForm button[type="submit"],#vv2AddCart', can('create-sale'));
    set('#paymentForm button[type="submit"]', can('create-payment'));
    set('button[onclick*="openCatalog"]', can('catalog'));
    set('button[onclick="openAdjustment()"]', can('adjustment'));
    set('button[onclick="openSettings()"]', can('settings'));
    set('button[onclick="clearTransactions()"]', can('clear'));
    const navSale = document.querySelector('.nav-btn[data-go="sale"]');
    const navPayment = document.querySelector('.nav-btn[data-go="payment"]');
    if (navSale) navSale.disabled = !can('create-sale');
    if (navPayment) navPayment.disabled = !can('create-payment');
    updateCloudPanel();
  }

  function fixVoidSaleAudit() {
    // Reserved for backwards compatibility; the active implementation stores a snapshot before mutation below.
  }

  async function checkStockAvailability(lines, previous = null) {
    for (const line of lines) {
      const product = productById(line.productId);
      if (!product || product.stock == null) continue;
      const available = Number(product.stock) + (previous && previous.productId === line.productId ? Number(previous.qty) : 0);
      if (Number(line.qty) <= available) continue;
      const ok = await enhancedAskConfirmation({
        title: 'Existencia insuficiente', heading: `${product.name} quedará en negativo`,
        message: `Existencia disponible: ${available}. Cantidad solicitada: ${line.qty}.`,
        detail: `Faltante estimado: <b>${Number(line.qty) - available}</b> unidad(es).`,
        confirmText: 'Autorizar de todos modos', danger: true, requireReason: true
      });
      if (!ok) return false;
    }
    return true;
  }

  function installOverrides() {
    base = {
      normalize, save, audit, askConfirmation, updateConfirmButton, acceptConfirmation,
      fillSelects, allMovements, balanceAt, accountSummary, periodData,
      renderHome, renderMovements, renderMaintenanceCount,
      nextDoc, prepareSaleDoc, preparePaymentDoc, updateSaleTotal, updatePaymentPreview,
      resetSaleForm, resetPaymentForm, editSale, deleteSale, editPayment, deletePayment,
      quickPayment, openCatalog, renderCatalog, editCatalog, deleteCatalog,
      openAdjustment, editAdjustment, deleteAdjustment, openSettings,
      exportBackup, importBackup, clearTransactions, exportXLSX
    };

    normalize = enhancedNormalize;
    save = enhancedSave;
    audit = enhancedAudit;
    askConfirmation = enhancedAskConfirmation;
    updateConfirmButton = enhancedUpdateConfirmButton;
    acceptConfirmation = enhancedAcceptConfirmation;
    fillSelects = enhancedFillSelects;
    allMovements = enhancedAllMovements;
    balanceAt = enhancedBalanceAt;
    accountSummary = enhancedAccountSummary;
    periodData = enhancedPeriodData;
    renderHome = enhancedRenderHome;
    renderMovements = enhancedRenderMovements;
    renderMaintenanceCount = enhancedRenderMaintenanceCount;
    nextDoc = enhancedNextDoc;
    prepareSaleDoc = enhancedPrepareSaleDoc;
    preparePaymentDoc = enhancedPreparePaymentDoc;
    updateSaleTotal = enhancedUpdateSaleTotal;
    updatePaymentPreview = enhancedUpdatePaymentPreview;
    resetSaleForm = enhancedResetSaleForm;
    resetPaymentForm = enhancedResetPaymentForm;
    editSale = enhancedEditSale;
    deleteSale = enhancedVoidSale;
    editPayment = enhancedEditPayment;
    deletePayment = enhancedVoidPayment;
    quickPayment = enhancedQuickPayment;
    openCatalog = enhancedOpenCatalog;
    renderCatalog = enhancedRenderCatalog;
    editCatalog = enhancedEditCatalog;
    deleteCatalog = enhancedToggleCatalog;
    openAdjustment = enhancedOpenAdjustment;
    editAdjustment = enhancedEditAdjustment;
    deleteAdjustment = enhancedVoidAdjustment;
    openSettings = enhancedOpenSettings;
    exportBackup = enhancedExportBackup;
    importBackup = enhancedImportBackup;
    clearTransactions = enhancedClearTransactions;
    exportXLSX = enhancedExportXLSX;

    document.getElementById('saleForm').addEventListener('submit', handleSaleSubmit, true);
    document.getElementById('paymentForm').addEventListener('submit', handlePaymentSubmit, true);
    document.getElementById('adjustmentForm').addEventListener('submit', handleAdjustmentSubmit, true);
    document.getElementById('catalogForm').addEventListener('submit', handleCatalogSubmit, true);
    document.getElementById('saleProduct').addEventListener('change', () => {
      const product = productById(document.getElementById('saleProduct').value);
      if (product) document.getElementById('salePrice').value = product.price;
      enhancedUpdateSaleTotal();
    });
    document.getElementById('saleWorker').addEventListener('change', enhancedUpdateSaleTotal);
    const interceptPaymentPreview = (event) => {
      event.stopImmediatePropagation();
      enhancedUpdatePaymentPreview();
    };
    document.getElementById('paymentWorker').addEventListener('change', interceptPaymentPreview, true);
    document.getElementById('paymentAmount').addEventListener('input', interceptPaymentPreview, true);
    document.getElementById('paymentDate').addEventListener('change', interceptPaymentPreview, true);
    document.getElementById('vv2ConfirmReason')?.addEventListener('input', enhancedUpdateConfirmButton);

    window.addEventListener('online', async () => {
      updateSyncUI();
      if (pendingCloudSave && cloudSession) {
        try { await syncStateToCloud(); } catch (error) { console.error(error); }
      }
    });
    window.addEventListener('offline', updateSyncUI);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && pendingCloudSave && navigator.onLine && cloudSession) syncStateToCloud().catch(console.error);
    });
  }

  function exposeGlobals() {
    Object.assign(window, {
      openCloudPanel,
      vv2ForceSync,
      vv2SignOut,
      vv2RemoveCartLine: removeCartLine,
      vv2RestoreRecord,
      vv2OpenCashClosing,
      vv2PrintReceipt,
      vv2ShareReceipt,
      vv2AllocateDocument: allocateDocument,
      vv2CurrentIdentity: currentIdentity,
      vv2IsActive: isActive,
      vv2ActiveRecords: activeRecords,
      editSale: enhancedEditSale,
      deleteSale: enhancedVoidSale,
      editPayment: enhancedEditPayment,
      deletePayment: enhancedVoidPayment,
      resetSaleForm: enhancedResetSaleForm,
      resetPaymentForm: enhancedResetPaymentForm,
      quickPayment: enhancedQuickPayment,
      openCatalog: enhancedOpenCatalog,
      renderCatalog: enhancedRenderCatalog,
      editCatalog: enhancedEditCatalog,
      deleteCatalog: enhancedToggleCatalog,
      openAdjustment: enhancedOpenAdjustment,
      editAdjustment: enhancedEditAdjustment,
      deleteAdjustment: enhancedVoidAdjustment,
      openSettings: enhancedOpenSettings,
      exportBackup: enhancedExportBackup,
      importBackup: enhancedImportBackup,
      clearTransactions: enhancedClearTransactions,
      exportXLSX: enhancedExportXLSX,
      renderMovements: enhancedRenderMovements,
      updateConfirmButton: enhancedUpdateConfirmButton,
      acceptConfirmation: enhancedAcceptConfirmation
    });
  }

  async function boot() {
    if (booted) return;
    booted = true;
    try {
      await waitForBaseApp();
      installUI();
      installOverrides();
      exposeGlobals();
      enhancedNormalize();
      await base.save(false);
      enhancedFillSelects();
      enhancedResetSaleForm();
      enhancedResetPaymentForm();
      refreshAll();
      applyRoleUI();
      updateSyncUI();

      const guide = document.querySelector('#guideModal .notice');
      if (guide) guide.innerHTML += '<br><br><b>8. Multiusuario:</b> configure Supabase una sola vez en el archivo público o en cada dispositivo. Cada usuario debe ingresar con su propia cuenta.<br><br><b>9. Seguridad:</b> las ventas, abonos y ajustes se anulan; no se borran. Las ediciones y anulaciones exigen motivo y quedan en auditoría.<br><br><b>10. Sin conexión:</b> los cambios se guardan en el dispositivo y quedan pendientes hasta recuperar internet.';

      await initCloud({ showAuth: true });
      updateCloudPanel();
      applyRoleUI();
      if (!cloudConfigured()) toast('V2 lista · configure Supabase para compartir datos');
    } catch (error) {
      console.error('Error al iniciar Ventas de Víctor V2', error);
      alert(`La capa V2 no pudo iniciar: ${error.message}`);
    }
  }

  boot();
})();
