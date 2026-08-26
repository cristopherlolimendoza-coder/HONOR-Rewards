
const $ = (s) => document.querySelector(s);

let requests = [];
let products = [];
let timer = null;
let selectedMonth = '';
let currentMonth = '';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[m]));

const token = () => sessionStorage.getItem('hr_admin_token') || '';

async function api(path, opt = {}) {
  const headers = { 'content-type': 'application/json', ...(opt.headers || {}) };
  if (token()) headers.authorization = 'Bearer ' + token();
  const r = await fetch(path, { ...opt, credentials: 'same-origin', headers });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.detail || `Error ${r.status}`);
  return d;
}

function state(s) {
  if (s === 'En revisión') return '<span class="state review">En revisión</span>';
  if (s === 'Aprobado') return '<span class="state approved">Aprobado</span>';
  if (s === 'Entregado') return '<span class="state delivered">Entregado</span>';
  return '<span class="state rejected">Rechazado</span>';
}

function details(lines) {
  if (!lines?.length) return '—';
  const groups = {};
  for (const l of lines) {
    const k = l.ruc + '|' + l.company;
    (groups[k] ??= []).push(l);
  }
  return Object.entries(groups).map(([k, ls]) => {
    const [ruc, company] = k.split('|');
    return `<b>${esc(company)}</b><br><span class="muted">RUC/RUT: ${esc(ruc)}</span><br>${ls.map((x) => `${esc(x.model)}: <b>${x.qty}</b>`).join(' · ')}`;
  }).join('<hr class="sep">');
}

function filtered() {
  const q = ($('#search')?.value || '').trim().toLowerCase();
  const status = $('#statusFilter')?.value || 'Todos';
  return requests.filter((r) => {
    if (status !== 'Todos' && r.status !== status) return false;
    if (!q) return true;
    return [
      r.cycle_month, r.executive, r.channel, r.product_name, r.status,
      r.comment, r.admin_note,
      ...(r.lines || []).flatMap((x) => [x.ruc, x.company, x.model, x.qty]),
    ].join(' ').toLowerCase().includes(q);
  });
}

function fillMonths(months = []) {
  const sel = $('#monthFilter');
  const prev = selectedMonth || currentMonth;
  sel.innerHTML = '<option value="all">Todos los meses</option>';
  const unique = [currentMonth, ...months].filter((x, i, a) => x && a.indexOf(x) === i);
  for (const m of unique) {
    sel.insertAdjacentHTML('beforeend', `<option value="${m}">${m}${m === currentMonth ? ' · actual' : ''}</option>`);
  }
  selectedMonth = prev || currentMonth;
  sel.value = selectedMonth;
  if (!sel.value) {
    selectedMonth = currentMonth;
    sel.value = currentMonth;
  }
}

async function load() {
  const query = selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : '';
  const [rq, pr] = await Promise.all([
    api('/api/admin/requests' + query),
    api('/api/admin/products'),
  ]);
  requests = rq.requests || [];
  products = pr.products || [];
  currentMonth = rq.currentMonth || pr.currentMonth || currentMonth;
  selectedMonth = rq.selectedMonth || selectedMonth || currentMonth;
  fillMonths(rq.months || []);
  render();
  $('#lastSync').textContent = 'Última actualización: ' + new Date().toLocaleTimeString('es-PE');
  $('#cycleInfo').textContent = `Stock operativo: ${currentMonth}. Se restablece automáticamente al iniciar cada mes.`;
}

function render() {
  $('#kTotal').textContent = requests.length;
  $('#kUnits').textContent = requests.reduce((s, x) => s + Number(x.total_qty || 0), 0);
  $('#kReview').textContent = requests.filter((x) => x.status === 'En revisión').length;
  $('#kApproved').textContent = requests.filter((x) => x.status === 'Aprobado').length;
  $('#kDelivered').textContent = requests.filter((x) => x.status === 'Entregado').length;
  $('#kRejected').textContent = requests.filter((x) => x.status === 'Rechazado').length;

  const view = filtered();
  const rows = $('#rows');
  rows.innerHTML = '';

  if (!view.length) {
    rows.innerHTML = '<tr><td colspan="11" class="empty">Todavía no hay solicitudes para este filtro. La estructura ya está lista para empezar a acumular información.</td></tr>';
  }

  for (const r of view) {
    let acts = '';
    if (r.status === 'En revisión') {
      acts += `<button class="btn success" data-act="Aprobado" data-id="${r.id}">Aprobar</button> `;
      acts += `<button class="btn danger" data-act="Rechazado" data-id="${r.id}">Rechazar</button> `;
    } else if (r.status === 'Aprobado') {
      acts += `<button class="btn" data-act="Entregado" data-id="${r.id}">Entregado</button> `;
      acts += `<button class="btn danger" data-act="Rechazado" data-id="${r.id}">Rechazar</button> `;
    }
    acts += `<button class="btn delete" data-delete="${r.id}">Eliminar</button>`;

    rows.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${new Date(r.created_at).toLocaleString('es-PE')}</td>
        <td>${esc(r.cycle_month || '—')}</td>
        <td>${esc(r.executive)}</td>
        <td>${esc(r.channel)}</td>
        <td>${esc(r.product_name)}</td>
        <td><b>${r.total_qty}</b></td>
        <td>${details(r.lines)}</td>
        <td>${esc(r.comment || '—')}</td>
        <td>${state(r.status)}</td>
        <td>${esc(r.admin_note || '—')}</td>
        <td class="actionsCell">${acts}</td>
      </tr>
    `);
  }

  const inv = $('#inventory');
  inv.innerHTML = '';
  for (const p of products) {
    inv.insertAdjacentHTML('beforeend', `
      <div class="inv">
        <h3>${esc(p.name)}</h3>
        <div class="invstats">Disponible: <b>${p.available}</b> · Reservado: <b>${p.reserved}</b> · Entregado: <b>${p.delivered}</b></div>
        <div class="invgrid">
          <label class="field">Stock mensual<input type="number" min="0" value="${p.total_stock}" data-stock="${p.id}"></label>
          <label class="field">Cuota de canje<input type="number" min="1" value="${p.quota}" data-quota="${p.id}"></label>
        </div>
        <button class="btn primary" data-save="${p.id}" style="margin-top:10px">Guardar cambios</button>
      </div>
    `);
  }

  $('#adminView').classList.remove('hidden');
  $('#loginView').classList.add('hidden');
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => load().catch(() => {}), 30000);
}

async function login() {
  const btn = $('#loginBtn');
  const err = $('#loginError');
  const password = $('#password').value;
  err.textContent = '';

  if (!password) {
    err.textContent = 'Ingresa la contraseña.';
    return;
  }

  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Ingresando…';

  try {
    const d = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (d.token) sessionStorage.setItem('hr_admin_token', d.token);
    await api('/api/admin/me');
    await load();
    startTimer();
  } catch (e) {
    sessionStorage.removeItem('hr_admin_token');
    err.textContent = e.message || 'No se pudo iniciar sesión.';
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

async function boot() {
  try {
    const h = await api('/api/health');
    if (!h.databaseConfigured) {
      $('#loginError').textContent = 'Falta vincular la base de datos D1 en Cloudflare.';
      return;
    }
    if (!h.adminPasswordConfigured) {
      $('#loginError').textContent = 'Falta configurar la contraseña de administrador en Cloudflare.';
      return;
    }
    if (token()) {
      await api('/api/admin/me');
      await load();
      startTimer();
    }
  } catch {
    sessionStorage.removeItem('hr_admin_token');
  }
}

$('#loginBtn').addEventListener('click', login);
$('#password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    login();
  }
});
$('#search').addEventListener('input', render);
$('#statusFilter').addEventListener('change', render);
$('#monthFilter').addEventListener('change', async (e) => {
  selectedMonth = e.target.value;
  await load().catch((err) => alert(err.message));
});
$('#refreshBtn').onclick = () => load().catch((e) => alert(e.message));

$('#logoutBtn').onclick = async () => {
  clearInterval(timer);
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.removeItem('hr_admin_token');
  location.reload();
};

$('#rows').addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]');
  const del = e.target.closest('[data-delete]');

  if (act) {
    const label = act.dataset.act === 'Rechazado'
      ? 'Motivo / observación del rechazo:'
      : 'Observación (opcional):';
    const note = prompt(label, '');
    if (note === null) return;
    try {
      await api('/api/admin/status', {
        method: 'POST',
        body: JSON.stringify({ id: act.dataset.id, status: act.dataset.act, note }),
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (del) {
    if (!confirm('¿Eliminar definitivamente esta solicitud del histórico?')) return;
    try {
      await api('/api/admin/delete', {
        method: 'POST',
        body: JSON.stringify({ id: del.dataset.delete }),
      });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }
});

$('#inventory').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-save]');
  if (!b) return;
  const id = b.dataset.save;
  const stock = $(`[data-stock="${id}"]`);
  const quota = $(`[data-quota="${id}"]`);
  try {
    await api('/api/admin/product', {
      method: 'POST',
      body: JSON.stringify({
        id,
        total_stock: Number(stock.value),
        quota: Number(quota.value),
      }),
    });
    await load();
  } catch (err) {
    alert(err.message);
  }
});

async function resetMonth() {
  if (!confirm('Esto restablecerá Disponible = Stock mensual y pondrá Reservado/Entregado en 0 para el mes actual. El histórico de solicitudes NO se borra. ¿Continuar?')) return;
  try {
    await api('/api/admin/reset-month', { method: 'POST', body: '{}' });
    await load();
    alert('Stock del mes restablecido correctamente.');
  } catch (e) {
    alert(e.message);
  }
}
$('#resetBtn').onclick = resetMonth;

function excelRows() {
  const view = filtered();
  const out = [[
    'Fecha', 'Mes', 'Ejecutivo', 'Canal', 'Premio', 'Unidades reportadas',
    'Estado', 'Comentario FFVV', 'Observación admin', 'RUC/RUT',
    'Razón social', 'Modelo', 'Cantidad',
  ]];

  for (const r of view) {
    if (!(r.lines || []).length) {
      out.push([
        r.created_at, r.cycle_month, r.executive, r.channel, r.product_name,
        r.total_qty, r.status, r.comment || '', r.admin_note || '',
        '', '', '', '',
      ]);
    }
    for (const l of (r.lines || [])) {
      out.push([
        r.created_at, r.cycle_month, r.executive, r.channel, r.product_name,
        r.total_qty, r.status, r.comment || '', r.admin_note || '',
        l.ruc, l.company, l.model, l.qty,
      ]);
    }
  }
  return out;
}

function downloadExcel() {
  const rows = excelRows();
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><table>' +
    rows.map((r, i) => '<tr>' + r.map((v) => `<${i ? 'td' : 'th'}>${esc(v)}</${i ? 'td' : 'th'}>`).join('') + '</tr>').join('') +
    '</table></body></html>';
  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HONOR_Rewards_${selectedMonth || currentMonth || 'historico'}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

$('#exportBtn').onclick = downloadExcel;
$('#exportBottomBtn').onclick = downloadExcel;

boot();
