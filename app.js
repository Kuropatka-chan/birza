const BASE_OWNER = 'NotAHamster';
const USER_OWNER = 'Текущий пользователь';

const state = {
  products: [],
  selectedProductId: null,
  searchQuery: '',
  categoryFilter: 'all',
  marketLotType: 'sell',
  sortBy: 'name',
  sortDir: 1,
  productLotType: 'sell',
  productSortBy: 'price',
  productSortDir: 1,
  adminEnabled: false,
  statsMode: 'market',
  statsPeriod: 'days',
  dealsHistory: [],
  userBalance: 10000,
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
  categoryFilter: document.getElementById('categoryFilter'),
  lotTypeFilter: document.getElementById('lotTypeFilter'),
  productLotTypeFilter: document.getElementById('productLotTypeFilter'),
  productSortBy: document.getElementById('productSortBy'),
  productSortDirBtn: document.getElementById('productSortDirBtn'),
  statsContent: document.getElementById('statsContent'),
  statsPeriod: document.getElementById('statsPeriod'),
  adminToggleBtn: document.getElementById('adminToggleBtn'),
  adminBadge: document.getElementById('adminBadge'),
  lotForm: document.getElementById('lotForm'),
  lotName: document.getElementById('lotName'),
  lotType: document.getElementById('lotType'),
  lotPrice: document.getElementById('lotPrice'),
  lotQty: document.getElementById('lotQty'),
  userBalance: document.getElementById('userBalance'),
};

const round2 = (n) => Math.round(n * 100) / 100;
const getOfferLabel = (type) => (type === 'sell' ? 'Продажа' : 'Покупка');

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function init() {
  await loadProducts();
  bindEvents();
  refreshProductListDatalist();
  refreshCategoryFilter();
  renderBalance();
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

    if ((line.endsWith(':') || /^[А-Яа-яЁё\s]+$/.test(line)) && !line.includes('—')) {
      currentCategory = line.replace(':', '').trim();
    }

    const match = line.match(/^(.*?)\s*—\s*([\d.]+)\s*ДСМ/);
    if (match) {
      const name = match[1].trim();
      const basePrice = Number(match[2]);
      const baseOffers = [
        { price: round2(basePrice), quantity: 20 },
        { price: round2(basePrice * 0.9), quantity: 15 },
        { price: round2(basePrice * 1.1), quantity: 10 },
      ];
      const offers = baseOffers.flatMap((offer) => ([
        {
          id: uid(),
          type: 'sell',
          owner: BASE_OWNER,
          ...offer,
        },
        {
          id: uid(),
          type: 'buy',
          owner: BASE_OWNER,
          price: round2(offer.price * 0.95),
          quantity: Math.max(5, Math.floor(offer.quantity * 0.7)),
        },
      ]));

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

  els.categoryFilter.addEventListener('change', (e) => {
    state.categoryFilter = e.target.value;
    renderMarket();
  });

  els.lotTypeFilter.addEventListener('change', (e) => {
    state.marketLotType = e.target.value;
    state.productLotType = e.target.value;
    els.productLotTypeFilter.value = state.productLotType;
    renderMarket();
    renderProductTab();
  });

  els.productLotTypeFilter.addEventListener('change', (e) => {
    state.productLotType = e.target.value;
    renderProductTab();
  });

  els.productSortBy.addEventListener('change', (e) => {
    state.productSortBy = e.target.value;
    renderProductTab();
  });

  els.productSortDirBtn.addEventListener('click', () => {
    state.productSortDir *= -1;
    els.productSortDirBtn.textContent = state.productSortDir === 1 ? '↑' : '↓';
    renderProductTab();
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

  els.statsPeriod.addEventListener('change', (e) => {
    state.statsPeriod = e.target.value;
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

function getProductSummary(product, lotType = state.marketLotType) {
  const offers = product.offers.filter((o) => o.type === lotType);
  if (!offers.length) return { avg: 0, min: 0, max: 0, totalQty: 0 };

  const prices = offers.map((o) => o.price);
  const totalQty = offers.reduce((sum, o) => sum + o.quantity, 0);
  const weighted = offers.reduce((sum, o) => sum + o.price * o.quantity, 0);
  return {
    avg: totalQty ? round2(weighted / totalQty) : 0,
    min: round2(Math.min(...prices)),
    max: round2(Math.max(...prices)),
    totalQty,
  };
}

function getFilteredSortedProducts() {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    const byName = p.name.toLowerCase().includes(query);
    const byCategory = state.categoryFilter === 'all' || p.category === state.categoryFilter;
    const byType = p.offers.some((o) => o.type === state.marketLotType && o.quantity > 0);
    return byName && byCategory && byType;
  });

  return filtered.sort((a, b) => {
    if (state.sortBy === 'name') return a.name.localeCompare(b.name, 'ru') * state.sortDir;
    const sa = getProductSummary(a, state.marketLotType);
    const sb = getProductSummary(b, state.marketLotType);
    if (state.sortBy === 'price') return (sa.avg - sb.avg) * state.sortDir;
    return (sa.totalQty - sb.totalQty) * state.sortDir;
  });
}

function renderMarket() {
  const rows = getFilteredSortedProducts().map((product) => {
    const summary = getProductSummary(product, state.marketLotType);
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
  els.productTitle.textContent = `Карточка: ${product.name} (${getOfferLabel(state.productLotType)})`;

  const offers = [...product.offers]
    .filter((o) => o.type === state.productLotType)
    .sort((a, b) => {
      if (state.productSortBy === 'price') return (a.price - b.price) * state.productSortDir;
      if (state.productSortBy === 'quantity') return (a.quantity - b.quantity) * state.productSortDir;
      return a.owner.localeCompare(b.owner, 'ru') * state.productSortDir;
    });

  if (!offers.length) {
    els.productOffersBody.innerHTML = '<tr><td colspan="5">Лотов этого типа нет.</td></tr>';
    return;
  }

  els.productOffersBody.innerHTML = offers.map((offer) => `
    <tr>
      <td>${product.name}</td>
      <td>${editableCell(offer.price, product.id, offer.id, 'price')}</td>
      <td>${editableCell(offer.quantity, product.id, offer.id, 'quantity')}</td>
      <td>${offer.owner}</td>
      <td><button class="buy" data-deal-offer="${offer.id}" data-deal-product="${product.id}">${state.productLotType === 'sell' ? 'Купить' : 'Продать'}</button></td>
    </tr>
  `).join('');

  els.productOffersBody.querySelectorAll('[data-deal-offer]').forEach((btn) => {
    btn.addEventListener('click', () => executeDeal(btn.dataset.dealProduct, btn.dataset.dealOffer));
  });

  bindAdminInputs();
}

function editableCell(value, productId, offerId, field) {
  if (!state.adminEnabled) return value;
  const step = field === 'quantity' ? '1' : '0.01';
  return `<input class="editable-input" type="number" min="0" step="${step}" value="${value}" data-edit-product="${productId}" data-edit-offer="${offerId}" data-edit-field="${field}"/>`;
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

function executeDeal(productId, offerId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const offer = product.offers.find((o) => o.id === offerId);
  if (!offer || offer.quantity < 1) return;

  const maxQty = offer.quantity;
  const entered = prompt(`Введите количество (1-${maxQty})`, '1');
  if (entered === null) return;

  const qty = Math.floor(Number(entered));
  if (Number.isNaN(qty) || qty < 1 || qty > maxQty) {
    alert('Некорректное количество.');
    return;
  }

  const amount = round2(offer.price * qty);
  const action = state.productLotType === 'sell' ? 'покупку' : 'продажу';
  const confirmed = confirm(`Подтвердите ${action}: ${qty} шт. за ${amount} ДСМ`);
  if (!confirmed) return;

  if (offer.type === 'sell') {
    if (state.userBalance < amount) {
      alert(`Недостаточно средств. Баланс: ${round2(state.userBalance)} ДСМ`);
      return;
    }
    state.userBalance = round2(state.userBalance - amount);
  } else {
    state.userBalance = round2(state.userBalance + amount);
  }

  offer.quantity -= qty;

  state.dealsHistory.push({
    ts: new Date().toISOString(),
    productId: product.id,
    productName: product.name,
    type: offer.type,
    qty,
    price: offer.price,
  });

  if (state.dealsHistory.length > 5000) {
    state.dealsHistory = state.dealsHistory.slice(-5000);
  }

  renderBalance();
  renderProductTab();
  renderMarket();
  renderStats();
}

function renderStats() {
  const isProductMode = state.statsMode === 'product';
  const selectedProduct = state.products.find((p) => p.id === state.selectedProductId);
  renderGraphStats(isProductMode, selectedProduct);
}

function renderGraphStats(isProductMode, selectedProduct) {
  const lotType = isProductMode ? state.productLotType : state.marketLotType;
  const filteredDeals = state.dealsHistory.filter((deal) => {
    if (deal.type !== lotType) return false;
    if (isProductMode) return selectedProduct && deal.productId === selectedProduct.id;
    return true;
  });

  if (!filteredDeals.length) {
    els.statsContent.innerHTML = '<p>Сделок пока нет, график пуст.</p>';
    return;
  }

  const grouped = aggregateDealsByPeriod(filteredDeals, state.statsPeriod);
  const chart = renderLineChart(grouped);

  els.statsContent.innerHTML = `
    <h3>${isProductMode && selectedProduct ? `График: ${selectedProduct.name}` : 'График: общий рынок'} (${getOfferLabel(lotType)})</h3>
    <p class="hint">Ось X — период времени, ось Y — цена товара. Наведите на точку для просмотра объёма продаж и цены.</p>
    ${chart}
  `;
}

function aggregateDealsByPeriod(entries, period) {
  const groups = new Map();

  for (const entry of entries) {
    const date = new Date(entry.ts);
    const key = periodKey(date, period);
    if (!groups.has(key)) {
      groups.set(key, { label: key, totalValue: 0, totalQty: 0, dealsCount: 0 });
    }

    const group = groups.get(key);
    group.totalValue += entry.price * entry.qty;
    group.totalQty += entry.qty;
    group.dealsCount += 1;
  }

  return [...groups.values()]
    .map((g) => ({
      label: g.label,
      avgPrice: g.totalQty ? round2(g.totalValue / g.totalQty) : 0,
      soldQty: g.totalQty,
      dealsCount: g.dealsCount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

function renderLineChart(points) {
  if (points.length === 1) {
    return `
      <div class="single-point-chart">
        <p><strong>${points[0].label}</strong></p>
        <p>Цена: ${points[0].avgPrice} ДСМ</p>
        <p>Продано: ${points[0].soldQty} шт.</p>
      </div>
    `;
  }

  const width = 760;
  const height = 340;
  const padding = 40;

  const maxY = Math.max(...points.map((p) => p.avgPrice), 1);
  const minY = Math.min(...points.map((p) => p.avgPrice), 0);
  const yRange = Math.max(1, maxY - minY);
  const stepX = (width - padding * 2) / (points.length - 1);

  const coords = points.map((p, idx) => {
    const x = round2(padding + stepX * idx);
    const y = round2(height - padding - ((p.avgPrice - minY) / yRange) * (height - padding * 2));
    return { ...p, x, y };
  });

  const pathD = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  const xLabels = coords.map((c) => `<text x="${c.x}" y="${height - 8}" class="axis-label" text-anchor="middle">${c.label}</text>`).join('');
  const yTicks = [0, 0.5, 1].map((ratio) => {
    const y = round2(padding + (height - padding * 2) * ratio);
    const val = round2(maxY - (maxY - minY) * ratio);
    return `
      <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="grid-line" />
      <text x="8" y="${y + 4}" class="axis-label">${val}</text>
    `;
  }).join('');

  const pointsSvg = coords.map((c) => `
    <circle cx="${c.x}" cy="${c.y}" r="5" class="chart-point">
      <title>${c.label}\nЦена: ${c.avgPrice} ДСМ\nПродано: ${c.soldQty} шт.\nСделок: ${c.dealsCount}</title>
    </circle>
  `).join('');

  return `
    <div class="line-chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" class="line-chart" role="img" aria-label="График цены товаров по периодам">
        ${yTicks}
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="axis-line" />
        <path d="${pathD}" class="price-line" />
        ${pointsSvg}
        ${xLabels}
      </svg>
    </div>
  `;
}

function periodKey(date, period) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (period === 'months') return `${year}-${month}`;
  if (period === 'weeks') {
    const oneJan = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  return `${year}-${month}-${day}`;
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
  els.lotName.innerHTML = state.products.map((p) => `<option value="${p.name}">${p.name}</option>`).join('');
}

function refreshCategoryFilter() {
  const categories = ['all', ...new Set(state.products.map((p) => p.category))];
  els.categoryFilter.innerHTML = categories
    .map((c) => `<option value="${c}">${c === 'all' ? 'Все категории' : c}</option>`)
    .join('');
  els.categoryFilter.value = state.categoryFilter;
}

function createUserLot() {
  const name = els.lotName.value.trim();
  const type = els.lotType.value;
  const price = Number(els.lotPrice.value);
  const qty = Math.floor(Number(els.lotQty.value));

  if (!name || Number.isNaN(price) || Number.isNaN(qty) || price <= 0 || qty <= 0) return;

  const product = state.products.find((p) => p.name === name);
  if (!product) {
    alert('Нельзя добавить новый товар. Выберите товар из списка.');
    return;
  }

  product.offers.push({
    id: uid(),
    type,
    owner: USER_OWNER,
    price: round2(price),
    quantity: qty,
  });

  els.lotForm.reset();
  renderMarket();
  if (state.selectedProductId === product.id) renderProductTab();
}

function renderBalance() {
  els.userBalance.textContent = `${round2(state.userBalance)} ДСМ`;
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
    editBalanceByAdmin();
    renderProductTab();
  } else {
    state.adminEnabled = false;
    els.adminToggleBtn.textContent = 'Включить админ-доступ';
    els.adminBadge.textContent = 'Режим: пользователь';
    renderProductTab();
  }
}

function editBalanceByAdmin() {
  const entered = prompt('Введите новый баланс пользователя (ДСМ)', String(state.userBalance));
  if (entered === null) return;
  const val = Number(entered);
  if (Number.isNaN(val) || val < 0) {
    alert('Некорректный баланс.');
    return;
  }
  state.userBalance = round2(val);
  renderBalance();
}

init();
