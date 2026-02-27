const BASE_OWNER = 'NotAHamster';
const USER_OWNER = 'Текущий пользователь';

const state = {
  products: [],
  selectedProductId: null,
  searchQuery: '',
  categoryFilter: 'all',
  marketLotType: 'sell',
  marketSortColumn: null,
  marketSortDir: 1,
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
  sortableHeaders: [...document.querySelectorAll('[data-sort-col]')],
  productOffersBody: document.getElementById('productOffersBody'),
  productTitle: document.getElementById('productTitle'),
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
  lotNameInput: document.getElementById('lotNameInput'),
  lotNameSuggestions: document.getElementById('lotNameSuggestions'),
  lotType: document.getElementById('lotType'),
  lotPrice: document.getElementById('lotPrice'),
  lotQty: document.getElementById('lotQty'),
  userBalance: document.getElementById('userBalance'),
  userBalanceBtn: document.getElementById('userBalanceBtn'),
  myLotsBody: document.getElementById('myLotsBody'),
};

const round2 = (n) => Math.round(n * 100) / 100;
const getOfferLabel = (type) => (type === 'sell' ? 'Продажа' : 'Покупка');

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function init() {
  await loadProducts();
  bindEvents();
  refreshCategoryFilter();
  renderBalance();
  renderMarket();
  renderStats();
  renderLotSuggestions();
  renderMyLots();
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
          active: true,
          visible: true,
          ...offer,
        },
        {
          id: uid(),
          type: 'buy',
          owner: BASE_OWNER,
          active: true,
          visible: true,
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

  els.sortableHeaders.forEach((header) => {
    header.addEventListener('click', () => toggleMarketSort(header.dataset.sortCol));
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
  els.userBalanceBtn.addEventListener('click', () => {
    if (!state.adminEnabled) return;
    editBalanceByAdmin();
  });

  els.lotNameInput.addEventListener('input', renderLotSuggestions);
  els.lotNameInput.addEventListener('focus', renderLotSuggestions);

  document.addEventListener('click', (e) => {
    if (!els.lotNameSuggestions.contains(e.target) && e.target !== els.lotNameInput) {
      els.lotNameSuggestions.innerHTML = '';
    }
  });

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
  if (tabId === 'cabinet') {
    renderMyLots();
    renderLotSuggestions();
  }
}

function isOfferPublic(offer) {
  return offer.active !== false && offer.visible !== false && offer.quantity > 0;
}

function getProductSummary(product, lotType = state.marketLotType) {
  const offers = product.offers.filter((o) => o.type === lotType && isOfferPublic(o));
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

function toggleMarketSort(column) {
  if (state.marketSortColumn !== column) {
    state.marketSortColumn = column;
    state.marketSortDir = 1;
  } else if (state.marketSortDir === 1) {
    state.marketSortDir = -1;
  } else {
    state.marketSortColumn = null;
    state.marketSortDir = 1;
  }
  renderMarket();
}

function getFilteredSortedProducts() {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    const byName = p.name.toLowerCase().includes(query);
    const byCategory = state.categoryFilter === 'all' || p.category === state.categoryFilter;
    const byType = p.offers.some((o) => o.type === state.marketLotType && isOfferPublic(o));
    return byName && byCategory && byType;
  });

  if (!state.marketSortColumn) return filtered;

  return filtered.sort((a, b) => {
    const sa = getProductSummary(a, state.marketLotType);
    const sb = getProductSummary(b, state.marketLotType);
    if (state.marketSortColumn === 'category') return a.category.localeCompare(b.category, 'ru') * state.marketSortDir;
    if (state.marketSortColumn === 'avg') return (sa.avg - sb.avg) * state.marketSortDir;
    if (state.marketSortColumn === 'min') return (sa.min - sb.min) * state.marketSortDir;
    if (state.marketSortColumn === 'max') return (sa.max - sb.max) * state.marketSortDir;
    return (sa.totalQty - sb.totalQty) * state.marketSortDir;
  });
}

function renderMarket() {
  els.sortableHeaders.forEach((h) => {
    const col = h.dataset.sortCol;
    let suffix = '';
    if (state.marketSortColumn === col) suffix = state.marketSortDir === 1 ? ' ↑' : ' ↓';
    h.textContent = h.textContent.replace(/\s[↑↓]$/, '') + suffix;
  });

  const rows = getFilteredSortedProducts().map((product) => {
    const summary = getProductSummary(product, state.marketLotType);
    return `
      <tr>
        <td><div class="icon-placeholder">заглушка</div></td>
        <td><button data-open-product="${product.id}" class="link-btn">${product.name}</button></td>
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
    .filter((o) => o.type === state.productLotType && isOfferPublic(o))
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
      renderMyLots();
    });
  });
}

function executeDeal(productId, offerId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  const offer = product.offers.find((o) => o.id === offerId);
  if (!offer || !isOfferPublic(offer)) return;

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
  renderMyLots();
}

function renderStats() {
  const isProductMode = state.statsMode === 'product';
  const selectedProduct = state.products.find((p) => p.id === state.selectedProductId);
  renderStatsTable(isProductMode, selectedProduct);
}

function renderStatsTable(isProductMode, selectedProduct) {
  const lotType = isProductMode ? state.productLotType : state.marketLotType;
  const filteredDeals = state.dealsHistory.filter((deal) => {
    if (deal.type !== lotType) return false;
    if (isProductMode) return selectedProduct && deal.productId === selectedProduct.id;
    return true;
  });

  if (!filteredDeals.length) {
    els.statsContent.innerHTML = '<p>Сделок пока нет.</p>';
    return;
  }

  const grouped = aggregateDealsByPeriod(filteredDeals, state.statsPeriod, isProductMode);

  const rows = grouped.map((item) => `
    <tr>
      <td>${item.period}</td>
      <td>${item.productName}</td>
      <td>${item.soldQty}</td>
      <td>${item.avgPrice}</td>
    </tr>
  `).join('');

  els.statsContent.innerHTML = `
    <h3>${isProductMode && selectedProduct ? `Статистика: ${selectedProduct.name}` : 'Статистика: общий рынок'} (${getOfferLabel(lotType)})</h3>
    <table>
      <thead>
        <tr>
          <th>Период</th>
          <th>Товар</th>
          <th>Куплено/продано (шт.)</th>
          <th>Средняя цена</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function aggregateDealsByPeriod(entries, period, isProductMode) {
  const groups = new Map();

  for (const entry of entries) {
    const date = new Date(entry.ts);
    const pKey = periodKey(date, period);
    const key = isProductMode ? pKey : `${pKey}|${entry.productName}`;

    if (!groups.has(key)) {
      groups.set(key, {
        period: pKey,
        productName: entry.productName,
        totalValue: 0,
        totalQty: 0,
      });
    }

    const group = groups.get(key);
    group.totalValue += entry.price * entry.qty;
    group.totalQty += entry.qty;
  }

  return [...groups.values()]
    .map((g) => ({
      period: g.period,
      productName: g.productName,
      avgPrice: g.totalQty ? round2(g.totalValue / g.totalQty) : 0,
      soldQty: g.totalQty,
    }))
    .sort((a, b) => `${a.period}|${a.productName}`.localeCompare(`${b.period}|${b.productName}`, 'ru'));
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

function renderLotSuggestions() {
  const query = els.lotNameInput.value.trim().toLowerCase();
  const matched = state.products
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .slice(0, 10);

  els.lotNameSuggestions.innerHTML = matched
    .map((m) => `<li data-lot-suggestion="${m.name}">${m.name}</li>`)
    .join('');

  els.lotNameSuggestions.querySelectorAll('[data-lot-suggestion]').forEach((node) => {
    node.addEventListener('click', () => {
      els.lotNameInput.value = node.dataset.lotSuggestion;
      els.lotNameSuggestions.innerHTML = '';
    });
  });
}

function refreshCategoryFilter() {
  const categories = ['all', ...new Set(state.products.map((p) => p.category))];
  els.categoryFilter.innerHTML = categories
    .map((c) => `<option value="${c}">${c === 'all' ? 'Все категории' : c}</option>`)
    .join('');
  els.categoryFilter.value = state.categoryFilter;
}

function createUserLot() {
  const name = els.lotNameInput.value.trim();
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
    active: true,
    visible: true,
    price: round2(price),
    quantity: qty,
  });

  els.lotForm.reset();
  renderMarket();
  renderMyLots();
  renderLotSuggestions();
  if (state.selectedProductId === product.id) renderProductTab();
}

function getUserOffers() {
  return state.products.flatMap((product) => product.offers
    .filter((offer) => offer.owner === USER_OWNER)
    .map((offer) => ({ product, offer })));
}

function renderMyLots() {
  const myLots = getUserOffers();

  if (!myLots.length) {
    els.myLotsBody.innerHTML = '<tr><td colspan="6">У вас пока нет лотов.</td></tr>';
    return;
  }

  els.myLotsBody.innerHTML = myLots.map(({ product, offer }) => `
    <tr>
      <td>
        <select data-edit-user-lot="product" data-offer-id="${offer.id}">
          ${state.products.map((p) => `<option value="${p.id}" ${p.id === product.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </td>
      <td>${getOfferLabel(offer.type)}</td>
      <td><input type="number" min="0.01" step="0.01" value="${offer.price}" data-edit-user-lot="price" data-offer-id="${offer.id}" /></td>
      <td><input type="number" min="1" step="1" value="${offer.quantity}" data-edit-user-lot="quantity" data-offer-id="${offer.id}" /></td>
      <td>${offer.active === false ? 'Снят' : (offer.visible === false ? 'Скрыт' : 'Виден')}</td>
      <td>
        <button class="secondary" data-toggle-active="${offer.id}">${offer.active === false ? 'Вернуть в продажу/покупку' : 'Снять с продажи/покупки'}</button>
        <button class="secondary" data-toggle-visible="${offer.id}">${offer.visible === false ? 'Сделать видимым' : 'Скрыть'}</button>
      </td>
    </tr>
  `).join('');

  els.myLotsBody.querySelectorAll('[data-toggle-active]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const found = findUserOffer(btn.dataset.toggleActive);
      if (!found) return;
      found.offer.active = found.offer.active === false;
      renderMyLots();
      renderMarket();
      renderProductTab();
    });
  });

  els.myLotsBody.querySelectorAll('[data-toggle-visible]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const found = findUserOffer(btn.dataset.toggleVisible);
      if (!found) return;
      found.offer.visible = found.offer.visible === false;
      renderMyLots();
      renderMarket();
      renderProductTab();
    });
  });

  els.myLotsBody.querySelectorAll('[data-edit-user-lot]').forEach((input) => {
    input.addEventListener('change', () => {
      const found = findUserOffer(input.dataset.offerId);
      if (!found) return;
      const mode = input.dataset.editUserLot;

      if (mode === 'product') {
        const targetProduct = state.products.find((p) => p.id === input.value);
        if (!targetProduct) return;
        found.product.offers = found.product.offers.filter((o) => o.id !== found.offer.id);
        targetProduct.offers.push(found.offer);
      }

      if (mode === 'price') {
        const value = Number(input.value);
        if (Number.isNaN(value) || value <= 0) return;
        found.offer.price = round2(value);
      }

      if (mode === 'quantity') {
        const value = Math.floor(Number(input.value));
        if (Number.isNaN(value) || value <= 0) return;
        found.offer.quantity = value;
      }

      renderMyLots();
      renderMarket();
      renderProductTab();
    });
  });
}

function findUserOffer(offerId) {
  for (const product of state.products) {
    const offer = product.offers.find((o) => o.id === offerId && o.owner === USER_OWNER);
    if (offer) return { product, offer };
  }
  return null;
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
