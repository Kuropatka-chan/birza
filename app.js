const state = {
  products: [],
  selectedProductId: null,
  searchQuery: '',
  sortBy: 'name',
  sortDir: 1,
  adminEnabled: false,
  purchases: {},
  statsMode: 'market',
};

const els = {
  tabs: [...document.querySelectorAll('.tab')],
  panels: [...document.querySelectorAll('.tab-panel')],
  marketBody: document.getElementById('marketBody'),
  productOffersBody: document.getElementById('productOffersBody'),
  productTitle: document.getElementById('productTitle'),
  sortBy: document.getElementById('sortBy'),
  sortDirBtn: document.getElementById('sortDirBtn'),
  globalSearch: document.getElementById('globalSearch'),
  searchSuggestions: document.getElementById('searchSuggestions'),
  statsContent: document.getElementById('statsContent'),
  adminToggleBtn: document.getElementById('adminToggleBtn'),
  adminBadge: document.getElementById('adminBadge'),
  lotForm: document.getElementById('lotForm'),
  lotName: document.getElementById('lotName'),
  lotPrice: document.getElementById('lotPrice'),
  lotQty: document.getElementById('lotQty'),
  productsList: document.getElementById('productsList'),
};

const round2 = (n) => Math.round(n * 100) / 100;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function init() {
  await loadProducts();
  bindEvents();
  refreshProductListDatalist();
  renderMarket();
  renderStats();
}

async function loadProducts() {
  const source = await fetch('Биржа_с_ценами.txt').then((r) => r.text());
  const lines = source.split('\n').map((line) => line.trim());

  let currentCategory = 'Без категории';
  const products = [];

  for (const line of lines) {
    if (!line) continue;

    if (line.endsWith(':') || /^[А-Яа-яЁё\s]+$/.test(line)) {
      if (!line.includes('—')) {
        currentCategory = line.replace(':', '').trim();
      }
    }

    const match = line.match(/^(.*?)\s*—\s*([\d.]+)\s*ДСМ/);
    if (match) {
      const name = match[1].trim();
      const basePrice = Number(match[2]);
      const offers = [
        { id: uid(), price: round2(basePrice), quantity: 20, source: 'Базовая цена' },
        { id: uid(), price: round2(basePrice * 0.9), quantity: 15, source: 'Скидка -10%' },
        { id: uid(), price: round2(basePrice * 1.1), quantity: 10, source: 'Наценка +10%' },
      ];
      products.push({
        id: uid(),
        name,
        category: currentCategory,
        offers,
      });
    }
  }

  state.products = products;
  state.selectedProductId = products[0]?.id || null;
}

function bindEvents() {
  els.tabs.forEach((tabBtn) => tabBtn.addEventListener('click', () => activateTab(tabBtn.dataset.tab)));

  els.sortBy.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderMarket();
  });

  els.sortDirBtn.addEventListener('click', () => {
    state.sortDir *= -1;
    els.sortDirBtn.textContent = state.sortDir === 1 ? '↑' : '↓';
    renderMarket();
  });

  els.globalSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderSuggestions();
    renderMarket();
  });

  document.getElementById('backToMarket').addEventListener('click', () => activateTab('market'));
  document.getElementById('goToProductStats').addEventListener('click', () => {
    state.statsMode = 'product';
    activateTab('stats');
    renderStats();
  });
  document.getElementById('showMarketStats').addEventListener('click', () => {
    state.statsMode = 'market';
    renderStats();
  });
  document.getElementById('showProductStats').addEventListener('click', () => {
    state.statsMode = 'product';
    renderStats();
  });

  els.adminToggleBtn.addEventListener('click', toggleAdminMode);

  els.lotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    createUserLot();
  });
}

function activateTab(tabId) {
  els.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tabId));
  els.panels.forEach((p) => p.classList.toggle('active', p.id === tabId));
  if (tabId === 'product') renderProductTab();
  if (tabId === 'stats') renderStats();
}

function getProductSummary(product) {
  const prices = product.offers.map((o) => o.price);
  const totalQty = product.offers.reduce((sum, o) => sum + o.quantity, 0);
  const weighted = product.offers.reduce((sum, o) => sum + o.price * o.quantity, 0);
  return {
    avg: totalQty ? round2(weighted / totalQty) : 0,
    min: round2(Math.min(...prices)),
    max: round2(Math.max(...prices)),
    totalQty,
  };
}

function getFilteredSortedProducts() {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => p.name.toLowerCase().includes(query));

  return filtered.sort((a, b) => {
    if (state.sortBy === 'name') return a.name.localeCompare(b.name, 'ru') * state.sortDir;
    const sa = getProductSummary(a);
    const sb = getProductSummary(b);
    if (state.sortBy === 'price') return (sa.avg - sb.avg) * state.sortDir;
    return (sa.totalQty - sb.totalQty) * state.sortDir;
  });
}

function renderMarket() {
  const rows = getFilteredSortedProducts().map((product) => {
    const summary = getProductSummary(product);
    return `
      <tr>
        <td><div class="icon-placeholder">заглушка</div></td>
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>${summary.avg}</td>
        <td>${summary.min}</td>
        <td>${summary.max}</td>
        <td>${summary.totalQty}</td>
        <td>
          <button data-open-product="${product.id}" class="secondary">Открыть</button>
          <button data-open-product-stats="${product.id}" class="secondary">Статистика</button>
        </td>
      </tr>
    `;
  });

  els.marketBody.innerHTML = rows.join('') || '<tr><td colspan="8">Ничего не найдено.</td></tr>';

  els.marketBody.querySelectorAll('[data-open-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedProductId = btn.dataset.openProduct;
      activateTab('product');
      renderProductTab();
    });
  });

  els.marketBody.querySelectorAll('[data-open-product-stats]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedProductId = btn.dataset.openProductStats;
      state.statsMode = 'product';
      activateTab('stats');
      renderStats();
    });
  });
}

function renderProductTab() {
  const product = state.products.find((p) => p.id === state.selectedProductId);
  if (!product) return;
  els.productTitle.textContent = `Карточка: ${product.name}`;

  els.productOffersBody.innerHTML = product.offers.map((offer) => `
    <tr>
      <td>${product.name}</td>
      <td>${editableCell(offer.price, product.id, offer.id, 'price')}</td>
      <td>${editableCell(offer.quantity, product.id, offer.id, 'quantity')}</td>
      <td>${offer.source}</td>
      <td><button class="buy" data-buy-offer="${offer.id}" data-buy-product="${product.id}">Купить</button></td>
    </tr>
  `).join('');

  els.productOffersBody.querySelectorAll('[data-buy-offer]').forEach((btn) => {
    btn.addEventListener('click', () => buyOffer(btn.dataset.buyProduct, btn.dataset.buyOffer));
  });

  bindAdminInputs();
}

function editableCell(value, productId, offerId, field) {
  if (!state.adminEnabled) return value;
  return `<input class="editable-input" type="number" min="0" step="0.01" value="${value}" data-edit-product="${productId}" data-edit-offer="${offerId}" data-edit-field="${field}"/>`;
}

function bindAdminInputs() {
  document.querySelectorAll('.editable-input').forEach((inp) => {
    inp.addEventListener('change', () => {
      const product = state.products.find((p) => p.id === inp.dataset.editProduct);
      if (!product) return;
      const offer = product.offers.find((o) => o.id === inp.dataset.editOffer);
      if (!offer) return;
      const f = inp.dataset.editField;
      const val = Number(inp.value);
      if (Number.isNaN(val) || val < 0) return;
      offer[f] = f === 'quantity' ? Math.floor(val) : round2(val);
      renderProductTab();
      renderMarket();
      renderStats();
    });
  });
}

function buyOffer(productId, offerId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const offer = product.offers.find((o) => o.id === offerId);
  if (!offer || offer.quantity < 1) return;

  offer.quantity -= 1;
  if (!state.purchases[productId]) {
    state.purchases[productId] = { name: product.name, qty: 0, spent: 0 };
  }
  state.purchases[productId].qty += 1;
  state.purchases[productId].spent += offer.price;

  renderProductTab();
  renderMarket();
  renderStats();
}

function renderStats() {
  if (state.statsMode === 'product') {
    const product = state.products.find((p) => p.id === state.selectedProductId);
    if (!product) {
      els.statsContent.innerHTML = '<p>Товар не выбран.</p>';
      return;
    }
    const p = state.purchases[product.id] || { qty: 0, spent: 0 };
    const avg = p.qty ? round2(p.spent / p.qty) : 0;
    els.statsContent.innerHTML = `
      <h3>Статистика по товару: ${product.name}</h3>
      <p>Куплено: <strong>${p.qty}</strong></p>
      <p>Средняя цена покупки: <strong>${avg} ДСМ</strong></p>
    `;
    return;
  }

  const entries = Object.values(state.purchases);
  if (!entries.length) {
    els.statsContent.innerHTML = '<p>Покупок пока нет.</p>';
    return;
  }

  const rows = entries.map((e) => {
    const avg = e.qty ? round2(e.spent / e.qty) : 0;
    return `<tr><td>${e.name}</td><td>${e.qty}</td><td>${avg}</td></tr>`;
  }).join('');

  els.statsContent.innerHTML = `
    <table>
      <thead><tr><th>Товар</th><th>Куплено</th><th>Средняя цена покупки</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSuggestions() {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) {
    els.searchSuggestions.innerHTML = '';
    return;
  }

  const matches = state.products
    .filter((p) => p.name.toLowerCase().startsWith(query))
    .slice(0, 8);

  els.searchSuggestions.innerHTML = matches.map((m) => `<li data-suggestion="${m.name}">${m.name}</li>`).join('');

  els.searchSuggestions.querySelectorAll('[data-suggestion]').forEach((node) => {
    node.addEventListener('click', () => {
      els.globalSearch.value = node.dataset.suggestion;
      state.searchQuery = node.dataset.suggestion;
      els.searchSuggestions.innerHTML = '';
      renderMarket();
    });
  });
}

function refreshProductListDatalist() {
  els.productsList.innerHTML = state.products.map((p) => `<option value="${p.name}"></option>`).join('');
}

function createUserLot() {
  const name = els.lotName.value.trim();
  const price = Number(els.lotPrice.value);
  const qty = Math.floor(Number(els.lotQty.value));
  if (!name || Number.isNaN(price) || Number.isNaN(qty) || price <= 0 || qty <= 0) return;

  let product = state.products.find((p) => p.name.toLowerCase() === name.toLowerCase());

  if (!product) {
    product = { id: uid(), name, category: 'Пользовательские', offers: [] };
    state.products.push(product);
  }

  product.offers.push({
    id: uid(),
    price: round2(price),
    quantity: qty,
    source: 'Личный лот',
  });

  els.lotForm.reset();
  refreshProductListDatalist();
  renderMarket();
  if (state.selectedProductId === product.id) renderProductTab();
}

function toggleAdminMode() {
  if (!state.adminEnabled) {
    const pass = prompt('Введите пароль администратора');
    if (pass !== 'admin123') {
      alert('Неверный пароль.');
      return;
    }
    state.adminEnabled = true;
    els.adminToggleBtn.textContent = 'Выключить админ-доступ';
    els.adminBadge.textContent = 'Режим: администратор';
    renderProductTab();
  } else {
    state.adminEnabled = false;
    els.adminToggleBtn.textContent = 'Включить админ-доступ';
    els.adminBadge.textContent = 'Режим: пользователь';
    renderProductTab();
  }
}

init();
