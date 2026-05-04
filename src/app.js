import {
  CLIENT_SOURCES,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
  REPORT_PERIODS,
  WORK_TYPES,
} from "./constants.js";
import {
  STORE_NAMES,
  bulkPut,
  clearStore,
  deleteRecord,
  exportDatabase,
  getAll,
  importDatabase,
  putRecord,
} from "./db.js";
import {
  buildCsv,
  createId,
  downloadFile,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatNumber,
  getDateRange,
  isDateInRange,
  normalizeString,
  nowIso,
  pluralizeOrders,
  sortByDateDesc,
  sumBy,
  toDateInputValue,
  uniqueCount,
} from "./utils.js";

const state = {
  screen: "home",
  homePeriod: "today",
  filters: structuredClone(DEFAULT_FILTERS),
  expandedCards: {
    orders: {},
    clients: {},
    expenses: {},
  },
  ui: {
    orderFiltersOpen: false,
  },
  data: {
    clients: [],
    orders: [],
    expenses: [],
    settings: { ...DEFAULT_SETTINGS },
  },
  activeSheet: null,
  calculatorMinimized: false,
};

const appContent = document.querySelector("#appContent");
const sheetRoot = document.querySelector("#sheetRoot");
const toastRoot = document.querySelector("#toastRoot");
const quickAddButton = document.querySelector("#quickAddButton");
const themeToggleButton = document.querySelector("#themeToggleButton");
const headerCalculatorButton = document.querySelector("#headerCalculatorButton");

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    setScreen(button.dataset.screen);
  });
});

quickAddButton.addEventListener("click", () => {
  openQuickAddSheet();
});

themeToggleButton.addEventListener("click", async () => {
  const nextTheme = state.data.settings.theme === "dark" ? "light" : "dark";
  state.data.settings.theme = nextTheme;
  applyTheme();
  await saveSetting("theme", nextTheme);
  toast("Тема обновлена");
});

headerCalculatorButton.addEventListener("click", () => {
  openCalculatorSheet();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.deferredPrompt = event;
});

window.addEventListener("DOMContentLoaded", async () => {
  await bootstrap();
});

async function bootstrap() {
  await ensureDemoData();
  await loadAllData();
  applyTheme();
  render();
  registerServiceWorker();
}

async function ensureDemoData() {
  const [clients, orders, expenses] = await Promise.all([
    getAll(STORE_NAMES.clients),
    getAll(STORE_NAMES.orders),
    getAll(STORE_NAMES.expenses),
  ]);

  if (clients.length || orders.length || expenses.length) {
    return;
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const clientAhmedId = createId("client");
  const clientMaratId = createId("client");
  const clientNeighborId = createId("client");

  await bulkPut(STORE_NAMES.clients, [
    {
      id: clientAhmedId,
      name: "Ахмед",
      phone: "79995554433",
      city: "Баса",
      address: "ул. Центральная, 12",
      notes: "Часто заказывает вспашку перед сезоном.",
      source: "Повторный клиент",
      sourceComment: "Работали прошлой весной",
      hasOwnPhone: true,
      linkedClientId: "",
      relationType: "",
      referredByClientId: "",
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: nowIso(),
    },
    {
      id: clientMaratId,
      name: "Марат",
      phone: "79001239876",
      city: "Карасу",
      address: "ул. Полевая, 3",
      notes: "Важно приехать после 15:00.",
      source: "Авито",
      sourceComment: "",
      hasOwnPhone: true,
      linkedClientId: "",
      relationType: "",
      referredByClientId: "",
      createdAt: yesterday.toISOString(),
      updatedAt: nowIso(),
    },
    {
      id: clientNeighborId,
      name: "Сосед Ахмеда",
      phone: "",
      city: "Баса",
      address: "рядом с домом Ахмеда",
      notes: "Связь только через Ахмеда",
      source: "Сарафанка",
      sourceComment: "Познакомил Ахмед",
      hasOwnPhone: false,
      linkedClientId: clientAhmedId,
      relationType: "Сосед",
      referredByClientId: clientAhmedId,
      createdAt: now.toISOString(),
      updatedAt: nowIso(),
    },
  ]);

  await bulkPut(STORE_NAMES.orders, [
    {
      id: createId("order"),
      clientId: clientAhmedId,
      workType: "Вспашка",
      amount: 7000,
      status: "done",
      city: "Баса",
      address: "ул. Центральная, 12",
      comment: "Участок 8 соток",
      plannedDate: yesterday.toISOString(),
      completedDate: yesterday.toISOString(),
      source: "Повторный клиент",
      createdAt: twoDaysAgo.toISOString(),
      updatedAt: nowIso(),
    },
    {
      id: createId("order"),
      clientId: clientMaratId,
      workType: "Парник",
      amount: 4500,
      status: "pending",
      city: "Карасу",
      address: "ул. Полевая, 3",
      comment: "Нужна подготовка двух парников",
      plannedDate: tomorrow.toISOString(),
      completedDate: "",
      source: "Авито",
      createdAt: now.toISOString(),
      updatedAt: nowIso(),
    },
    {
      id: createId("order"),
      clientId: clientNeighborId,
      workType: "Культивация",
      amount: 5200,
      status: "done",
      city: "Баса",
      address: "рядом с домом Ахмеда",
      comment: "Связь через соседа",
      plannedDate: now.toISOString(),
      completedDate: now.toISOString(),
      source: "Сарафанка",
      createdAt: now.toISOString(),
      updatedAt: nowIso(),
    },
  ]);

  await bulkPut(STORE_NAMES.expenses, [
    {
      id: createId("expense"),
      date: now.toISOString(),
      category: "Заправка",
      amount: 1800,
      comment: "Полный бак перед выездом",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: createId("expense"),
      date: yesterday.toISOString(),
      category: "Масло",
      amount: 900,
      comment: "Доливка масла",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ]);

  await Promise.all([
    saveSetting("theme", DEFAULT_SETTINGS.theme),
    saveSetting("calculatorReady", true),
  ]);
}

async function loadAllData() {
  const [clients, orders, expenses, settingsRecords] = await Promise.all([
    getAll(STORE_NAMES.clients),
    getAll(STORE_NAMES.orders),
    getAll(STORE_NAMES.expenses),
    getAll(STORE_NAMES.settings),
  ]);

  const settings = { ...DEFAULT_SETTINGS };
  settingsRecords.forEach((record) => {
    settings[record.key] = record.value;
  });

  state.data.clients = sortByDateDesc(clients, (client) => client.createdAt);
  state.data.orders = sortByDateDesc(orders, (order) => order.createdAt);
  state.data.expenses = sortByDateDesc(expenses, (expense) => expense.date);
  state.data.settings = settings;
}

function applyTheme() {
  document.body.classList.toggle("light-theme", state.data.settings.theme === "light");
}

function setScreen(screen) {
  state.screen = screen;
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.screen === screen);
  });
  render();
}

function render() {
  const markupByScreen = {
    home: renderHomeScreen(),
    orders: renderOrdersScreen(),
    clients: renderClientsScreen(),
    reports: renderReportsScreen(),
    settings: renderSettingsScreen(),
  };

  appContent.innerHTML = markupByScreen[state.screen];
  bindScreenEvents();
}

function renderHomeScreen() {
  const todayStats = getOperationalPeriodSummary("today");
  const pendingOrders = getOrdersByStatus("pending");
  const recentActivity = sortByDateDesc(state.data.orders, (order) => order.updatedAt).slice(0, 6);

  return `
    <section class="screen-stack">
      <section class="stats-grid">
        ${renderMetricCard("Доход сегодня", todayStats.income, `${todayStats.doneOrders} выполнено`, "success")}
        ${renderMetricCard("Расход сегодня", todayStats.expense, `${todayStats.expenseCount} расходов`, "amber")}
        ${renderMetricCard("Чистыми сегодня", todayStats.netProfit, "Доход минус расход", "blue")}
        ${renderMetricCard("Ожидают", pendingOrders.length, `${pendingOrders.length} ${pluralizeOrders(pendingOrders.length)}`, "plain", true)}
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Главное</p>
            <h3>Последние заказы</h3>
          </div>
          <button class="ghost-button" type="button" data-go-screen="orders">Все заказы</button>
        </div>
        <div class="list-stack">
          ${
            recentActivity.length
              ? recentActivity.map((order) => renderOrderCard(order, { compact: true })).join("")
              : renderEmptyCard("Пока нет заказов", "Добавьте первый заказ через кнопку +.")
          }
        </div>
      </section>
    </section>
  `;
}

function renderOrdersScreen() {
  const filters = state.filters.orders;
  const orders = getFilteredOrders();

  return `
    <section class="screen-stack">
      <section class="orders-control-bar">
        <div class="segment-control order-status-tabs">
          <button class="chip-button ${filters.status === "all" ? "is-active" : ""}" type="button" data-order-status="all">
            Все
          </button>
          ${ORDER_STATUSES.map(
            (status) => `
              <button class="chip-button ${filters.status === status.value ? "is-active" : ""}" type="button" data-order-status="${status.value}">
                ${status.label}
              </button>
            `,
          ).join("")}
          <button class="chip-button ${state.ui.orderFiltersOpen ? "is-active" : ""}" type="button" data-action="toggle-order-filters">
            Фильтр
          </button>
        </div>
        <div class="inline-actions order-toolbar-actions">
          <button class="primary-button" type="button" data-action="new-order">Новый</button>
        </div>
      </section>

      ${
        state.ui.orderFiltersOpen
          ? `
      <section class="section-card search-card">
        <div class="filters-grid">
          <div class="field">
            <label for="orderQueryInput">Поиск</label>
            <input id="orderQueryInput" class="text-input" type="search" value="${escapeHtml(filters.query)}" placeholder="Имя, город, телефон" />
          </div>
          <div class="field">
            <label for="orderCityFilter">Город</label>
            <input id="orderCityFilter" class="text-input" type="text" value="${escapeHtml(filters.city)}" list="orderCityFilterList" placeholder="Например, Баса" />
            ${renderDatalist("orderCityFilterList", getKnownCities())}
          </div>
          <div class="field">
            <label for="orderClientFilter">Клиент</label>
            <select id="orderClientFilter" class="select-input">
              <option value="">Все клиенты</option>
              ${state.data.clients
                .map(
                  (client) => `
                    <option value="${client.id}" ${filters.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>
                  `,
                )
                .join("")}
            </select>
          </div>
          <div class="field">
            <label for="orderWorkTypeFilter">Тип работы</label>
            <select id="orderWorkTypeFilter" class="select-input">
              <option value="">Все типы</option>
              ${WORK_TYPES.map(
                (type) => `
                  <option value="${type}" ${filters.workType === type ? "selected" : ""}>${type}</option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="orderSourceFilter">Источник</label>
            <select id="orderSourceFilter" class="select-input">
              <option value="">Все источники</option>
              ${CLIENT_SOURCES.map(
                (source) => `
                  <option value="${source}" ${filters.source === source ? "selected" : ""}>${source}</option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="orderFromDateFilter">Дата от</label>
            <input id="orderFromDateFilter" class="text-input" type="date" value="${escapeHtml(filters.fromDate)}" />
          </div>
          <div class="field">
            <label for="orderToDateFilter">Дата до</label>
            <input id="orderToDateFilter" class="text-input" type="date" value="${escapeHtml(filters.toDate)}" />
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="ghost-button" type="button" data-action="reset-order-filters">Сбросить фильтры</button>
          </div>
        </div>
      </section>
          `
          : ""
      }

      ${renderOrderFunnel(orders, filters.status)}
    </section>
  `;
}

function renderClientsScreen() {
  const clients = getFilteredClients();

  return `
    <section class="screen-stack">
      <section class="section-card search-card">
        <div class="page-header">
          <div class="page-title">
            <p class="eyebrow">Единая база</p>
            <h2>Клиенты</h2>
          </div>
          <div class="inline-actions">
            <button class="ghost-button" type="button" data-action="open-calculator">Калькулятор</button>
            <button class="primary-button" type="button" data-action="new-client">Добавить</button>
          </div>
        </div>

        <div class="filters-grid">
          <div class="field">
            <label for="clientQueryInput">Поиск</label>
            <input id="clientQueryInput" class="text-input" type="search" value="${escapeHtml(state.filters.clients.query)}" placeholder="Имя, телефон, город" />
          </div>
          <div class="field">
            <label for="clientCityFilter">Город</label>
            <input id="clientCityFilter" class="text-input" type="text" value="${escapeHtml(state.filters.clients.city)}" list="clientCityFilterList" placeholder="Например, Карасу" />
            ${renderDatalist("clientCityFilterList", getKnownCities())}
          </div>
          <div class="field">
            <label for="clientSourceFilter">Источник</label>
            <select id="clientSourceFilter" class="select-input">
              <option value="">Все источники</option>
              ${CLIENT_SOURCES.map(
                (source) => `
                  <option value="${source}" ${state.filters.clients.source === source ? "selected" : ""}>${source}</option>
                `,
              ).join("")}
            </select>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Список клиентов</p>
            <h3>${clients.length} контактов в базе</h3>
          </div>
          <button class="ghost-button" type="button" data-action="new-client">Новый клиент</button>
        </div>
        <div class="list-stack">
          ${clients.length ? clients.map((client) => renderClientCard(client)).join("") : renderEmptyCard("Клиенты не найдены", "Проверьте фильтры или добавьте нового клиента.")}
        </div>
      </section>
    </section>
  `;
}

function renderReportsScreen() {
  const report = buildReportData();
  const expenses = getFilteredExpensesForPeriod(report.range.from, report.range.to);

  return `
    <section class="screen-stack">
      <section class="section-card">
        <div class="page-header">
          <div class="page-title">
            <p class="eyebrow">Аналитика</p>
            <h2>Отчеты</h2>
          </div>
          <div class="inline-actions">
            <button class="ghost-button" type="button" data-action="open-calculator">Калькулятор</button>
            <button class="secondary-button" type="button" data-action="new-expense">Новый расход</button>
          </div>
        </div>

        <div class="segment-control">
          ${REPORT_PERIODS.map(
            (period) => `
              <button class="chip-button ${state.filters.reports.period === period.value ? "is-active" : ""}" type="button" data-report-period="${period.value}">
                ${period.label}
              </button>
            `,
          ).join("")}
        </div>

        ${
          state.filters.reports.period === "custom"
            ? `
              <div class="filters-grid">
                <div class="field">
                  <label for="reportFromDate">Дата от</label>
                  <input id="reportFromDate" class="text-input" type="date" value="${escapeHtml(state.filters.reports.fromDate)}" />
                </div>
                <div class="field">
                  <label for="reportToDate">Дата до</label>
                  <input id="reportToDate" class="text-input" type="date" value="${escapeHtml(state.filters.reports.toDate)}" />
                </div>
              </div>
            `
            : ""
        }
      </section>

      <section class="stats-grid">
        ${renderMetricCard("Выполнено заказов", report.summary.doneOrders, "По дате выполнения", "plain", true)}
        ${renderMetricCard("Доход", report.summary.income, "Только completed", "success")}
        ${renderMetricCard("Расход", report.summary.expense, `${expenses.length} записей`, "amber")}
        ${renderMetricCard("Чистая прибыль", report.summary.netProfit, "Доход - расход", "blue")}
        ${renderMetricCard("Средний чек", report.summary.averageTicket, "По выполненным заказам", "plain")}
        ${renderMetricCard("Клиентов", report.summary.clientCount, `${report.summary.newClients} новых`, "plain", true)}
        ${renderMetricCard("Повторных", report.summary.repeatClients, "Клиенты с 2+ выполненными заказами", "plain", true)}
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Разрезы</p>
            <h3>Где зарабатываем и тратим</h3>
          </div>
        </div>
        <div class="report-grid">
          ${renderBreakdownCard("По городам", report.breakdowns.cities, "city")}
          ${renderBreakdownCard("По источникам", report.breakdowns.sources, "source")}
          ${renderBreakdownCard("По типам работ", report.breakdowns.workTypes, "workType")}
          ${renderBreakdownCard("По категориям расходов", report.breakdowns.expenseCategories, "expenseCategory")}
          ${renderBreakdownCard("По дням", report.breakdowns.days, "day")}
          ${renderBreakdownCard("По клиентам", report.breakdowns.clients, "client")}
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Расходы периода</p>
            <h3>Отдельный учет расходов</h3>
          </div>
          <button class="ghost-button" type="button" data-action="new-expense">Добавить расход</button>
        </div>
        <div class="list-stack">
          ${expenses.length ? expenses.map((expense) => renderExpenseCard(expense)).join("") : renderEmptyCard("Нет расходов в периоде", "Добавьте расход через плюс или из этого раздела.")}
        </div>
      </section>
    </section>
  `;
}

function renderSettingsScreen() {
  const { settings } = state.data;

  return `
    <section class="screen-stack">
      <section class="section-card">
        <div class="page-header">
          <div class="page-title">
            <p class="eyebrow">Сервис и безопасность данных</p>
            <h2>Настройки</h2>
          </div>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-header">
          <div>
            <h3>Данные</h3>
          </div>
        </div>
        <div class="settings-actions">
          <button class="primary-button" type="button" data-action="export-json">Экспорт JSON</button>
          <button class="ghost-button" type="button" data-action="backup-json">Резервная копия</button>
          <button class="secondary-button" type="button" data-action="import-json">Импорт JSON</button>
        </div>
        <div class="settings-actions">
          <button class="ghost-button" type="button" data-action="export-orders-csv">CSV заказов</button>
          <button class="ghost-button" type="button" data-action="export-clients-csv">CSV клиентов</button>
          <button class="ghost-button" type="button" data-action="export-expenses-csv">CSV расходов</button>
        </div>
        <p class="tiny-text">Последняя резервная копия: ${settings.lastBackupAt ? formatDate(settings.lastBackupAt, true) : "еще не создана"}</p>
      </section>

      <section class="settings-card">
        <div class="settings-header">
          <div>
            <h3>Оформление и режимы</h3>
          </div>
        </div>
        <div class="settings-actions">
          <button class="chip-button" type="button" data-action="toggle-theme">Тема: ${settings.theme === "dark" ? "Темная" : "Светлая"}</button>
          <button class="chip-button" type="button" data-action="open-calculator">Калькулятор</button>
          <button class="chip-button" type="button" data-action="install-pwa">Установить PWA</button>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-header">
          <div>
            <h3>О приложении</h3>
          </div>
        </div>
        <ul class="settings-list">
          <li>Версия приложения: <strong>1.0.0</strong></li>
          <li>Хранилище: <strong>IndexedDB</strong></li>
          <li>Калькулятор: <strong>${settings.calculatorReady ? "Встроен" : "Ожидает исходник"}</strong></li>
        </ul>
        <div class="settings-actions">
          <button class="danger-button" type="button" data-action="clear-data">Очистить данные</button>
        </div>
      </section>
    </section>
  `;
}

function renderMetricCard(title, value, meta, tone = "plain", isCount = false) {
  const className =
    tone === "success"
      ? "status-done"
      : tone === "amber"
        ? "status-pending"
        : tone === "blue"
          ? ""
          : "";

  return `
    <article class="metric-card">
      <span class="muted-label">${title}</span>
      <strong>${isCount ? formatNumber(value) : formatCurrency(value)}</strong>
      <span class="status-badge ${className}">${escapeHtml(meta)}</span>
    </article>
  `;
}

function renderOrderFunnel(orders, activeStatus) {
  const statuses = activeStatus === "all" ? ORDER_STATUSES : ORDER_STATUSES.filter((status) => status.value === activeStatus);

  if (!orders.length) {
    return `
      <section class="section-card">
        ${renderEmptyCard("Ничего не найдено", "Измените фильтры или добавьте новый заказ через кнопку +.")}
      </section>
    `;
  }

  return `
    <section class="order-funnel">
      ${statuses
        .map((status) => {
          const statusOrders = orders.filter((order) => order.status === status.value);

          return `
            <section class="funnel-list status-${status.value}">
              <div class="funnel-header">
                <h3>${status.label}</h3>
                <span class="status-badge status-${status.value}">${statusOrders.length}</span>
              </div>
              <div class="list-stack">
                ${statusOrders.length ? statusOrders.map((order) => renderOrderCard(order)).join("") : `<div class="funnel-empty">Пусто</div>`}
              </div>
            </section>
          `;
        })
        .join("")}
    </section>
  `;
}

function renderDatalist(id, values) {
  return `
    <datalist id="${id}">
      ${values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join("")}
    </datalist>
  `;
}

function renderQuickActionCard(title, description, action) {
  return `
    <button class="quick-action-card" type="button" data-action="${action}">
      <strong>${title}</strong>
      <span>${description}</span>
    </button>
  `;
}

function renderOrderCard(order, options = {}) {
  const client = getClientById(order.clientId);
  const source = order.source || client?.source || "Не указан";
  const isExpanded = options.forceExpanded || isCardExpanded("orders", order.id);
  const relationBadge =
    client?.linkedClientId && client?.relationType
      ? `<span class="tiny-pill">Связь: ${escapeHtml(client.relationType)}</span>`
      : "";

  return `
    <article class="record-card is-collapsible ${options.forceExpanded ? "is-static" : ""} ${isExpanded ? "is-expanded" : "is-collapsed"}" data-card-type="orders" data-card-id="${order.id}">
      <button class="record-toggle" type="button" ${options.forceExpanded ? "" : `data-toggle-card="orders" data-card-id="${order.id}"`} aria-expanded="${isExpanded ? "true" : "false"}">
        <div class="record-title-row">
          <div>
            <h4>${escapeHtml(client?.name || "Клиент удален")}</h4>
            <p>${escapeHtml(order.city || client?.city || "Город не указан")}</p>
          </div>
          <span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span>
        </div>
      </button>

      <div class="record-details" ${isExpanded ? "" : "hidden"}>
        <div>
          <div class="pill-row">
            <span class="info-pill">${escapeHtml(order.workType)}</span>
            <span class="info-pill">${order.amount ? formatCurrency(order.amount) : "Сумма не указана"}</span>
            <span class="tiny-pill">${escapeHtml(source)}</span>
            ${relationBadge}
          </div>
        </div>

        <div class="record-data-grid">
          <div class="data-item">
            <span class="muted-label">План</span>
            <strong>${formatDate(order.plannedDate)}</strong>
          </div>
          <div class="data-item">
            <span class="muted-label">Выполнено</span>
            <strong>${formatDate(order.completedDate)}</strong>
          </div>
        </div>

        <div class="inline-actions">
          ${order.status !== "done" ? `<button class="primary-button" type="button" data-action="complete-order" data-order-id="${order.id}">Выполнить</button>` : ""}
          <button class="ghost-button" type="button" data-action="edit-order" data-order-id="${order.id}">Редактировать</button>
          ${order.status !== "cancelled" ? `<button class="danger-button" type="button" data-action="cancel-order" data-order-id="${order.id}">Отменить</button>` : ""}
          <button class="danger-button" type="button" data-action="delete-order" data-order-id="${order.id}">Удалить</button>
          ${!options.compact ? `<button class="chip-button" type="button" data-action="view-client" data-client-id="${order.clientId}">Клиент</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderClientCard(client) {
  const orderSummary = getClientOrderSummary(client.id);
  const linkedClient = getClientById(client.linkedClientId);
  const isExpanded = isCardExpanded("clients", client.id);

  return `
    <article class="record-card is-collapsible ${isExpanded ? "is-expanded" : "is-collapsed"}" data-card-type="clients" data-card-id="${client.id}">
      <button class="record-toggle" type="button" data-toggle-card="clients" data-card-id="${client.id}" aria-expanded="${isExpanded ? "true" : "false"}">
        <div class="record-title-row">
          <div>
            <h4>${escapeHtml(client.name)}</h4>
            <p>${escapeHtml(client.city || "Город не указан")}</p>
          </div>
          <span class="tiny-pill">${escapeHtml(client.source || "Источник не указан")}</span>
        </div>
      </button>

      <div class="record-details" ${isExpanded ? "" : "hidden"}>
        <div>
          <div class="pill-row">
            <span class="info-pill">${escapeHtml(client.phone || "Номер не указан")}</span>
            ${
              linkedClient
                ? `<span class="info-pill">Через: ${escapeHtml(linkedClient.name)}</span>`
                : `<span class="info-pill">${client.hasOwnPhone ? "Есть свой номер" : "Без номера"}</span>`
            }
            ${client.relationType ? `<span class="tiny-pill">${escapeHtml(client.relationType)}</span>` : ""}
          </div>
        </div>

        <div class="order-stats">
          <div class="data-item">
            <span class="muted-label">Заказов</span>
            <strong>${formatNumber(orderSummary.total)}</strong>
          </div>
          <div class="data-item">
            <span class="muted-label">Выполнено</span>
            <strong>${formatNumber(orderSummary.done)}</strong>
          </div>
          <div class="data-item">
            <span class="muted-label">Сумма</span>
            <strong>${formatCurrency(orderSummary.doneAmount)}</strong>
          </div>
        </div>

        <div class="inline-actions">
          <button class="primary-button" type="button" data-action="view-client" data-client-id="${client.id}">Открыть</button>
          <button class="ghost-button" type="button" data-action="edit-client" data-client-id="${client.id}">Редактировать</button>
          <button class="chip-button" type="button" data-action="new-order-for-client" data-client-id="${client.id}">Новый заказ</button>
        </div>
      </div>
    </article>
  `;
}

function renderExpenseCard(expense) {
  const isExpanded = isCardExpanded("expenses", expense.id);

  return `
    <article class="record-card is-collapsible ${isExpanded ? "is-expanded" : "is-collapsed"}" data-card-type="expenses" data-card-id="${expense.id}">
      <button class="record-toggle" type="button" data-toggle-card="expenses" data-card-id="${expense.id}" aria-expanded="${isExpanded ? "true" : "false"}">
        <div class="record-title-row">
          <div>
            <h4>${escapeHtml(expense.category)}</h4>
            <p>${formatDate(expense.date)}</p>
          </div>
          <span class="status-badge status-pending">${formatCurrency(expense.amount)}</span>
        </div>
      </button>

      <div class="record-details" ${isExpanded ? "" : "hidden"}>
        <div>
          <p class="field-copy">${escapeHtml(expense.comment || "Без комментария")}</p>
        </div>
        <div class="inline-actions">
          <button class="ghost-button" type="button" data-action="edit-expense" data-expense-id="${expense.id}">Редактировать</button>
          <button class="danger-button" type="button" data-action="delete-expense" data-expense-id="${expense.id}">Удалить</button>
        </div>
      </div>
    </article>
  `;
}

function renderBreakdownCard(title, items, type = "") {
  return `
    <article class="report-card">
      <div class="report-header">
        <div>
          <h3>${title}</h3>
        </div>
      </div>
      <div class="table-like-list">
        ${
          items.length
            ? items
                .slice(0, 6)
                .map(
                  (item) => `
                    <button class="data-item report-breakdown-item" type="button" data-action="open-report-orders" data-report-type="${escapeHtml(type)}" data-report-label="${escapeHtml(item.label)}">
                      <span class="muted-label">${escapeHtml(item.label)}</span>
                      <strong>${item.isMoney ? formatCurrency(item.value) : formatNumber(item.value)}</strong>
                    </button>
                  `,
                )
                .join("")
            : `<div class="state-card"><h3>Пусто</h3><p>Появится после первых операций.</p></div>`
        }
      </div>
    </article>
  `;
}

function renderEmptyCard(title, description) {
  return `
    <article class="empty-card">
      <h3>${title}</h3>
      <p>${description}</p>
    </article>
  `;
}

function bindScreenEvents() {
  appContent.querySelectorAll("[data-go-screen]").forEach((button) => {
    button.addEventListener("click", () => setScreen(button.dataset.goScreen));
  });

  appContent.querySelectorAll("[data-home-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.homePeriod = button.dataset.homePeriod;
      render();
    });
  });

  appContent.querySelectorAll("[data-order-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.orders.status = button.dataset.orderStatus;
      render();
    });
  });

  appContent.querySelectorAll("[data-report-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.reports.period = button.dataset.reportPeriod;
      render();
    });
  });

  bindRecordInteractions(appContent);

  bindFilterInputs();
}

function bindRecordInteractions(root) {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset));
  });

  root.querySelectorAll("[data-toggle-card]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleCardExpansion(button.dataset.toggleCard, button.dataset.cardId);
      render();
    });
  });
}

function bindFilterInputs() {
  const orderQueryInput = document.querySelector("#orderQueryInput");
  if (orderQueryInput) {
    orderQueryInput.addEventListener("input", (event) => {
      state.filters.orders.query = event.target.value;
      render();
    });
  }

  const orderCityFilter = document.querySelector("#orderCityFilter");
  if (orderCityFilter) {
    orderCityFilter.addEventListener("input", (event) => {
      state.filters.orders.city = event.target.value;
      render();
    });
  }

  const orderClientFilter = document.querySelector("#orderClientFilter");
  if (orderClientFilter) {
    orderClientFilter.addEventListener("change", (event) => {
      state.filters.orders.clientId = event.target.value;
      render();
    });
  }

  const orderWorkTypeFilter = document.querySelector("#orderWorkTypeFilter");
  if (orderWorkTypeFilter) {
    orderWorkTypeFilter.addEventListener("change", (event) => {
      state.filters.orders.workType = event.target.value;
      render();
    });
  }

  const orderSourceFilter = document.querySelector("#orderSourceFilter");
  if (orderSourceFilter) {
    orderSourceFilter.addEventListener("change", (event) => {
      state.filters.orders.source = event.target.value;
      render();
    });
  }

  const orderFromDateFilter = document.querySelector("#orderFromDateFilter");
  if (orderFromDateFilter) {
    orderFromDateFilter.addEventListener("change", (event) => {
      state.filters.orders.fromDate = event.target.value;
      render();
    });
  }

  const orderToDateFilter = document.querySelector("#orderToDateFilter");
  if (orderToDateFilter) {
    orderToDateFilter.addEventListener("change", (event) => {
      state.filters.orders.toDate = event.target.value;
      render();
    });
  }

  const clientQueryInput = document.querySelector("#clientQueryInput");
  if (clientQueryInput) {
    clientQueryInput.addEventListener("input", (event) => {
      state.filters.clients.query = event.target.value;
      render();
    });
  }

  const clientCityFilter = document.querySelector("#clientCityFilter");
  if (clientCityFilter) {
    clientCityFilter.addEventListener("input", (event) => {
      state.filters.clients.city = event.target.value;
      render();
    });
  }

  const clientSourceFilter = document.querySelector("#clientSourceFilter");
  if (clientSourceFilter) {
    clientSourceFilter.addEventListener("change", (event) => {
      state.filters.clients.source = event.target.value;
      render();
    });
  }

  const reportFromDate = document.querySelector("#reportFromDate");
  if (reportFromDate) {
    reportFromDate.addEventListener("change", (event) => {
      state.filters.reports.fromDate = event.target.value;
      render();
    });
  }

  const reportToDate = document.querySelector("#reportToDate");
  if (reportToDate) {
    reportToDate.addEventListener("change", (event) => {
      state.filters.reports.toDate = event.target.value;
      render();
    });
  }
}

async function handleAction(action, payload) {
  if (action === "new-order") {
    openOrderForm();
    return;
  }

  if (action === "new-client") {
    openClientForm();
    return;
  }

  if (action === "new-expense") {
    openExpenseForm();
    return;
  }

  if (action === "new-order-for-client") {
    openOrderForm({ clientId: payload.clientId });
    return;
  }

  if (action === "view-client") {
    openClientDetails(payload.clientId);
    return;
  }

  if (action === "edit-client") {
    openClientForm({ clientId: payload.clientId });
    return;
  }

  if (action === "edit-order") {
    openOrderForm({ orderId: payload.orderId });
    return;
  }

  if (action === "complete-order") {
    await markOrderDone(payload.orderId);
    return;
  }

  if (action === "cancel-order") {
    await markOrderCancelled(payload.orderId);
    return;
  }

  if (action === "delete-order") {
    openDeleteOrderSheet(payload.orderId);
    return;
  }

  if (action === "edit-expense") {
    openExpenseForm({ expenseId: payload.expenseId });
    return;
  }

  if (action === "delete-expense") {
    await deleteExpense(payload.expenseId);
    return;
  }

  if (action === "open-calculator") {
    openCalculatorSheet();
    return;
  }

  if (action === "reset-order-filters") {
    state.filters.orders = { ...DEFAULT_FILTERS.orders };
    render();
    return;
  }

  if (action === "toggle-order-filters") {
    state.ui.orderFiltersOpen = !state.ui.orderFiltersOpen;
    render();
    return;
  }

  if (action === "open-report-orders") {
    openReportOrdersSheet(payload.reportType, payload.reportLabel);
    return;
  }

  if (action === "toggle-theme") {
    themeToggleButton.click();
    return;
  }

  if (action === "export-json") {
    await handleExportJson(false);
    return;
  }

  if (action === "backup-json") {
    await handleExportJson(true);
    return;
  }

  if (action === "import-json") {
    openImportSheet();
    return;
  }

  if (action === "export-orders-csv") {
    exportOrdersCsv();
    return;
  }

  if (action === "export-clients-csv") {
    exportClientsCsv();
    return;
  }

  if (action === "export-expenses-csv") {
    exportExpensesCsv();
    return;
  }

  if (action === "clear-data") {
    openClearDataSheet();
    return;
  }

  if (action === "install-pwa") {
    await installPwa();
  }
}

function openSheet({ kicker = "", title = "", body = "", onBind }) {
  const template = document.querySelector("#sheetTemplate");
  const fragment = template.content.cloneNode(true);
  const backdrop = fragment.querySelector(".sheet-backdrop");

  fragment.querySelector(".sheet-kicker").textContent = kicker;
  fragment.querySelector(".sheet-title").textContent = title;
  fragment.querySelector(".sheet-body").innerHTML = body;
  fragment.querySelector(".sheet-close").addEventListener("click", closeSheet);

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeSheet();
    }
  });

  sheetRoot.innerHTML = "";
  sheetRoot.appendChild(fragment);
  sheetRoot.style.pointerEvents = "auto";

  if (onBind) {
    onBind(sheetRoot.querySelector(".sheet-body"));
  }
}

function closeSheet() {
  sheetRoot.innerHTML = "";
  sheetRoot.style.pointerEvents = "none";
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  toastRoot.appendChild(element);

  setTimeout(() => {
    element.remove();
  }, 2800);
}

function openQuickAddSheet() {
  openSheet({
    kicker: "Быстрое добавление",
    title: "Что добавить?",
    body: `
      <section class="sheet-section">
        <button class="primary-button" type="button" data-sheet-action="new-order">Добавить заказ</button>
        <button class="ghost-button" type="button" data-sheet-action="new-expense">Добавить расходы</button>
      </section>
    `,
    onBind: (sheetBody) => {
      sheetBody.querySelectorAll("[data-sheet-action]").forEach((button) => {
        button.addEventListener("click", () => {
          closeSheet();
          handleAction(button.dataset.sheetAction, {});
        });
      });
    },
  });
}

function openCalculatorSheet() {
  openSheet({
    kicker: "Встроенный калькулятор",
    title: "Калькулятор",
    body: `
      <section class="sheet-section">
        <iframe
          id="calculatorFrame"
          title="Встроенный калькулятор"
          src="./calculator-embedded.html"
          loading="eager"
          style="width:100%;min-height:78vh;border:0;border-radius:24px;background:#050509;box-shadow:var(--shadow-lg);"
        ></iframe>
        <div class="sheet-footer">
          <button class="chip-button" type="button" id="minimizeCalculatorButton">Свернуть</button>
          <button class="primary-button" type="button" id="closeCalculatorButton">Закрыть</button>
        </div>
      </section>
    `,
    onBind: (sheetBody) => {
      sheetBody.querySelector("#closeCalculatorButton").addEventListener("click", closeSheet);
      sheetBody.querySelector("#minimizeCalculatorButton").addEventListener("click", () => {
        state.calculatorMinimized = true;
        closeSheet();
        toast("Калькулятор свернут. Вернуться можно через кнопку в шапке.");
      });
    },
  });
}

function openClientDetails(clientId) {
  const client = getClientById(clientId);

  if (!client) {
    toast("Клиент не найден");
    return;
  }

  const linkedClient = getClientById(client.linkedClientId);
  const referredByClient = getClientById(client.referredByClientId);
  const orders = sortByDateDesc(
    state.data.orders.filter((order) => order.clientId === clientId),
    (order) => order.completedDate || order.plannedDate || order.createdAt,
  );
  const summary = getClientOrderSummary(clientId);

  openSheet({
    kicker: "Карточка клиента",
    title: client.name,
    body: `
      <section class="sheet-section">
        <div class="details-grid">
          <div class="data-item"><span class="muted-label">Телефон</span><strong>${escapeHtml(client.phone || "Номер не указан")}</strong></div>
          <div class="data-item"><span class="muted-label">Город</span><strong>${escapeHtml(client.city || "Не указан")}</strong></div>
          <div class="data-item"><span class="muted-label">Источник</span><strong>${escapeHtml(client.source || "Не указан")}</strong></div>
          <div class="data-item"><span class="muted-label">Тип связи</span><strong>${escapeHtml(client.relationType || "Нет")}</strong></div>
          <div class="data-item"><span class="muted-label">Через кого связь</span><strong>${escapeHtml(linkedClient?.name || "Нет")}</strong></div>
          <div class="data-item"><span class="muted-label">Кто рекомендовал</span><strong>${escapeHtml(referredByClient?.name || "Нет")}</strong></div>
        </div>
      </section>

      <section class="sheet-section">
        <h3>Сводка</h3>
        <div class="client-summary">
          <div class="data-item"><span class="muted-label">Всего заказов</span><strong>${summary.total}</strong></div>
          <div class="data-item"><span class="muted-label">Выполнено</span><strong>${summary.done}</strong></div>
          <div class="data-item"><span class="muted-label">Отменено</span><strong>${summary.cancelled}</strong></div>
          <div class="data-item"><span class="muted-label">Сумма выполненных</span><strong>${formatCurrency(summary.doneAmount)}</strong></div>
        </div>
      </section>

      <section class="sheet-section">
        <div class="section-header">
          <div>
            <h3>История заказов</h3>
            <p>Дата, тип работы, сумма и статус.</p>
          </div>
        </div>
        <div class="history-list">
          ${orders.length ? orders.map((order) => renderOrderCard(order, { compact: true })).join("") : renderEmptyCard("История пуста", "У клиента пока нет заказов.")}
        </div>
      </section>

      <section class="sheet-section">
        <div class="settings-actions">
          <button class="primary-button" type="button" data-client-action="new-order">Новый заказ</button>
          <button class="ghost-button" type="button" data-client-action="edit-client">Редактировать</button>
          <button class="danger-button" type="button" data-client-action="archive-client">Удалить / архивировать</button>
        </div>
      </section>
    `,
    onBind: (sheetBody) => {
      sheetBody.querySelector('[data-client-action="new-order"]').addEventListener("click", () => {
        closeSheet();
        openOrderForm({ clientId: client.id });
      });

      sheetBody.querySelector('[data-client-action="edit-client"]').addEventListener("click", () => {
        closeSheet();
        openClientForm({ clientId: client.id });
      });

      sheetBody.querySelector('[data-client-action="archive-client"]').addEventListener("click", async () => {
        closeSheet();
        await archiveClient(client.id);
      });

      bindRecordInteractions(sheetBody);
    },
  });
}

function openClientForm({ clientId } = {}) {
  const client = clientId ? getClientById(clientId) : null;
  const canPickContact = supportsContactPicker();

  openSheet({
    kicker: client ? "Редактирование клиента" : "Новый клиент",
    title: client ? client.name : "Добавить клиента",
    body: `
      <form id="clientForm" class="sheet-section">
        <div class="form-grid">
          <div class="field">
            <label for="clientNameInput">Имя клиента</label>
            <input id="clientNameInput" class="text-input" type="text" required value="${escapeHtml(client?.name || "")}" list="clientNameList" />
            ${renderDatalist("clientNameList", getKnownClientNames())}
          </div>
          <div class="field">
            <label for="clientPhoneInput">Телефон</label>
            <input id="clientPhoneInput" class="text-input" type="tel" inputmode="tel" value="${escapeHtml(client?.phone || "")}" placeholder="+7 (999) 123-45-67" />
            <button class="ghost-button contact-picker-button" type="button" id="clientPickContactButton" ${canPickContact ? "" : "disabled"}>
              ${canPickContact ? "Выбрать из контактов" : "Контакты недоступны"}
            </button>
          </div>
          <div class="field">
            <label for="clientCityInput">Город / село</label>
            <input id="clientCityInput" class="text-input" type="text" value="${escapeHtml(client?.city || "")}" list="clientCityList" />
            ${renderDatalist("clientCityList", getKnownCities())}
          </div>
          <div class="field">
            <label for="clientSourceSelect">Откуда пришел</label>
            <select id="clientSourceSelect" class="select-input">
              ${CLIENT_SOURCES.map(
                (source) => `
                  <option value="${source}" ${client?.source === source ? "selected" : ""}>${source}</option>
                `,
              ).join("")}
            </select>
          </div>
        </div>

        <div class="sheet-footer">
          <button class="primary-button" type="submit">${client ? "Сохранить клиента" : "Создать клиента"}</button>
        </div>
      </form>
    `,
    onBind: (sheetBody) => {
      const form = sheetBody.querySelector("#clientForm");
      const clientNameInput = sheetBody.querySelector("#clientNameInput");
      const clientPhoneInput = sheetBody.querySelector("#clientPhoneInput");
      const clientCityInput = sheetBody.querySelector("#clientCityInput");
      const clientPickContactButton = sheetBody.querySelector("#clientPickContactButton");

      bindContactPickerButton({
        button: clientPickContactButton,
        nameInput: clientNameInput,
        phoneInput: clientPhoneInput,
      });

      clientNameInput.addEventListener("change", () => {
        const matchedClient = findClientByName(clientNameInput.value, client?.id);
        if (!matchedClient) {
          return;
        }

        if (!clientPhoneInput.value.trim()) {
          clientPhoneInput.value = matchedClient.phone || "";
        }

        if (!clientCityInput.value.trim()) {
          clientCityInput.value = matchedClient.city || "";
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const record = {
          id: client?.id || createId("client"),
          name: sheetBody.querySelector("#clientNameInput").value.trim(),
          phone: sheetBody.querySelector("#clientPhoneInput").value.trim(),
          city: sheetBody.querySelector("#clientCityInput").value.trim(),
          address: client?.address || "",
          notes: client?.notes || "",
          source: sheetBody.querySelector("#clientSourceSelect").value,
          sourceComment: client?.sourceComment || "",
          hasOwnPhone: true,
          linkedClientId: client?.linkedClientId || "",
          relationType: client?.relationType || "",
          referredByClientId: client?.referredByClientId || "",
          createdAt: client?.createdAt || nowIso(),
          updatedAt: nowIso(),
        };

        if (!record.name) {
          toast("Укажите имя клиента");
          return;
        }

        await putRecord(STORE_NAMES.clients, record);
        await loadAllData();
        closeSheet();
        render();
        toast(client ? "Клиент обновлен" : "Клиент добавлен");
      });
    },
  });
}

function openOrderForm({ orderId, clientId } = {}) {
  const order = orderId ? state.data.orders.find((item) => item.id === orderId) : null;
  const selectedClient = order ? getClientById(order.clientId) : getClientById(clientId);
  const canPickContact = supportsContactPicker();
  const sourceValue = order?.source || selectedClient?.source || CLIENT_SOURCES[0];

  openSheet({
    kicker: order ? "Редактирование заказа" : "Новый заказ",
    title: order ? "Обновить заказ" : "Создать заказ",
    body: `
      <form id="orderForm" class="sheet-section">
        <div class="form-grid">
          <div class="field">
            <label for="orderClientNameInput">Имя</label>
            <input id="orderClientNameInput" class="text-input" type="text" required value="${escapeHtml(selectedClient?.name || "")}" list="orderClientNameList" />
            ${renderDatalist("orderClientNameList", getKnownClientNames())}
          </div>
          <div class="field">
            <label for="orderClientPhoneInput">Номер</label>
            <input id="orderClientPhoneInput" class="text-input" type="tel" inputmode="tel" value="${escapeHtml(selectedClient?.phone || "")}" placeholder="+7 (999) 123-45-67" />
            <button class="ghost-button contact-picker-button" type="button" id="orderPickContactButton" ${canPickContact ? "" : "disabled"}>
              ${canPickContact ? "Выбрать из контактов" : "Контакты недоступны"}
            </button>
          </div>
          <div class="field">
            <label for="orderAmountInput">Сумма</label>
            <input id="orderAmountInput" class="text-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(order?.amount || "")}" placeholder="Можно оставить пустым" />
          </div>
          <div class="field">
            <label for="orderCityInput">Город</label>
            <input id="orderCityInput" class="text-input" type="text" required value="${escapeHtml(order?.city || selectedClient?.city || "")}" list="orderCityList" />
            ${renderDatalist("orderCityList", getKnownCities())}
          </div>
          <div class="field">
            <label for="orderSourceSelect">Откуда пришел</label>
            <select id="orderSourceSelect" class="select-input">
              ${CLIENT_SOURCES.map(
                (source) => `
                  <option value="${source}" ${sourceValue === source ? "selected" : ""}>${source}</option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="orderWorkTypeSelect">Тип работы</label>
            <select id="orderWorkTypeSelect" class="select-input">
              ${WORK_TYPES.map(
                (type) => `
                  <option value="${type}" ${order?.workType === type ? "selected" : ""}>${type}</option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="orderPlannedDateInput">Планируемая дата</label>
            <input id="orderPlannedDateInput" class="text-input" type="date" value="${escapeHtml(toDateInputValue(order?.plannedDate || new Date().toISOString()))}" />
          </div>
          <div class="field">
            <label for="orderStatusSelect">Статус</label>
            <select id="orderStatusSelect" class="select-input">
              ${ORDER_STATUSES.map(
                (status) => `
                  <option value="${status.value}" ${(order?.status || "pending") === status.value ? "selected" : ""}>${status.label}</option>
                `,
              ).join("")}
            </select>
          </div>
        </div>

        <div id="completedDateField" class="field" style="${(order?.status || "pending") === "done" ? "" : "display:none;"}">
          <label for="orderCompletedDateInput">Дата выполнения</label>
          <input id="orderCompletedDateInput" class="text-input" type="date" value="${escapeHtml(toDateInputValue(order?.completedDate || new Date().toISOString()))}" />
        </div>

        <label class="field-checkbox">
          <input id="orderReminderInput" type="checkbox" ${order ? "" : "checked"} />
          <span>Напомнить в телефоне в планируемую дату</span>
        </label>

        <div class="sheet-footer">
          <button class="primary-button" type="submit">${order ? "Сохранить заказ" : "Создать заказ"}</button>
        </div>
      </form>
    `,
    onBind: (sheetBody) => {
      const form = sheetBody.querySelector("#orderForm");
      const statusSelect = sheetBody.querySelector("#orderStatusSelect");
      const completedDateField = sheetBody.querySelector("#completedDateField");
      const nameInput = sheetBody.querySelector("#orderClientNameInput");
      const phoneInput = sheetBody.querySelector("#orderClientPhoneInput");
      const cityInput = sheetBody.querySelector("#orderCityInput");
      const sourceSelect = sheetBody.querySelector("#orderSourceSelect");

      statusSelect.addEventListener("change", () => {
        completedDateField.style.display = statusSelect.value === "done" ? "" : "none";
      });

      nameInput.addEventListener("change", () => {
        const matchedClient = findClientByName(nameInput.value, selectedClient?.id);
        if (!matchedClient) {
          return;
        }

        phoneInput.value = matchedClient.phone || phoneInput.value;
        cityInput.value = matchedClient.city || cityInput.value;
        sourceSelect.value = matchedClient.source || sourceSelect.value;
      });

      bindContactPickerButton({
        button: sheetBody.querySelector("#orderPickContactButton"),
        nameInput,
        phoneInput,
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = nameInput.value.trim();
        const city = cityInput.value.trim();

        if (!name) {
          toast("Укажите имя");
          return;
        }

        if (!city) {
          toast("Укажите город");
          return;
        }

        const wantsReminder = sheetBody.querySelector("#orderReminderInput").checked;
        const reminderPermission = wantsReminder ? await requestNotificationPermission() : "";
        let currentClient = selectedClient || findClientByName(name);
        currentClient = {
          ...(currentClient || {}),
          id: currentClient?.id || createId("client"),
          name,
          phone: phoneInput.value.trim(),
          city,
          address: currentClient?.address || "",
          notes: currentClient?.notes || "",
          source: sourceSelect.value,
          sourceComment: currentClient?.sourceComment || "",
          hasOwnPhone: true,
          linkedClientId: currentClient?.linkedClientId || "",
          relationType: currentClient?.relationType || "",
          referredByClientId: currentClient?.referredByClientId || "",
          createdAt: currentClient?.createdAt || nowIso(),
          updatedAt: nowIso(),
        };

        await putRecord(STORE_NAMES.clients, currentClient);

        const status = statusSelect.value;
        const plannedDateValue = sheetBody.querySelector("#orderPlannedDateInput").value;
        const completedDateValue = sheetBody.querySelector("#orderCompletedDateInput")?.value || "";
        const amountValue = sheetBody.querySelector("#orderAmountInput").value.replace(/\D/g, "");
        const record = {
          id: order?.id || createId("order"),
          clientId: currentClient.id,
          workType: sheetBody.querySelector("#orderWorkTypeSelect").value,
          amount: amountValue ? Number(amountValue) : 0,
          status,
          city,
          address: order?.address || "",
          comment: order?.comment || "",
          plannedDate: plannedDateValue ? new Date(plannedDateValue).toISOString() : "",
          completedDate:
            status === "done"
              ? new Date(completedDateValue || plannedDateValue || new Date().toISOString()).toISOString()
              : "",
          source: sourceSelect.value,
          createdAt: order?.createdAt || nowIso(),
          updatedAt: nowIso(),
        };

        await putRecord(STORE_NAMES.orders, record);
        await loadAllData();
        closeSheet();
        render();

        if (wantsReminder) {
          scheduleOrderReminder(record, currentClient, reminderPermission);
        }

        toast(order ? "Заказ обновлен" : "Заказ создан");
      });
    },
  });
}

function isCardExpanded(type, id) {
  return Boolean(state.expandedCards[type]?.[id]);
}

function toggleCardExpansion(type, id) {
  if (!state.expandedCards[type]) {
    state.expandedCards[type] = {};
  }

  state.expandedCards[type][id] = !state.expandedCards[type][id];
}

function supportsContactPicker() {
  return Boolean(navigator.contacts?.select);
}

function bindContactPickerButton({ button, nameInput, phoneInput }) {
  if (!button || !phoneInput || !supportsContactPicker()) {
    return;
  }

  button.addEventListener("click", async () => {
    try {
      const [contact] = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (!contact) {
        return;
      }

      const selectedPhone = Array.isArray(contact.tel) ? contact.tel.find(Boolean) : "";
      const selectedName = Array.isArray(contact.name) ? contact.name.find(Boolean) : "";

      if (selectedPhone) {
        phoneInput.value = selectedPhone;
      }

      if (nameInput && !nameInput.value.trim() && selectedName) {
        nameInput.value = selectedName;
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast("Не удалось открыть контакты");
      }
    }
  });
}

function openExpenseForm({ expenseId } = {}) {
  const expense = expenseId ? state.data.expenses.find((item) => item.id === expenseId) : null;

  openSheet({
    kicker: expense ? "Редактирование расхода" : "Новый расход",
    title: expense ? "Обновить расход" : "Добавить расход",
    body: `
      <form id="expenseForm" class="sheet-section">
        <div class="form-grid">
          <div class="field">
            <label for="expenseDateInput">Дата</label>
            <input id="expenseDateInput" class="text-input" type="date" value="${escapeHtml(toDateInputValue(expense?.date || new Date().toISOString()))}" />
          </div>
          <div class="field">
            <label for="expenseCategorySelect">Категория</label>
            <select id="expenseCategorySelect" class="select-input">
              ${EXPENSE_CATEGORIES.map(
                (category) => `
                  <option value="${category}" ${expense?.category === category ? "selected" : ""}>${category}</option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="expenseAmountInput">Сумма</label>
            <input id="expenseAmountInput" class="text-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(expense?.amount || "")}" placeholder="Только цифры" />
          </div>
        </div>
        <div class="field">
          <label for="expenseCommentInput">Комментарий</label>
          <textarea id="expenseCommentInput" class="textarea-input">${escapeHtml(expense?.comment || "")}</textarea>
        </div>
        <div class="sheet-footer">
          <button class="primary-button" type="submit">${expense ? "Сохранить расход" : "Добавить расход"}</button>
        </div>
      </form>
    `,
    onBind: (sheetBody) => {
      const form = sheetBody.querySelector("#expenseForm");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const amount = Number(sheetBody.querySelector("#expenseAmountInput").value.replace(/\D/g, ""));
        if (!amount) {
          toast("Укажите сумму расхода");
          return;
        }

        const record = {
          id: expense?.id || createId("expense"),
          date: new Date(sheetBody.querySelector("#expenseDateInput").value || new Date().toISOString()).toISOString(),
          category: sheetBody.querySelector("#expenseCategorySelect").value,
          amount,
          comment: sheetBody.querySelector("#expenseCommentInput").value.trim(),
          createdAt: expense?.createdAt || nowIso(),
          updatedAt: nowIso(),
        };

        await putRecord(STORE_NAMES.expenses, record);
        await loadAllData();
        closeSheet();
        render();
        toast(expense ? "Расход обновлен" : "Расход добавлен");
      });
    },
  });
}

function openImportSheet() {
  openSheet({
    kicker: "Импорт данных",
    title: "Восстановление из резервной копии",
    body: `
      <section class="sheet-section">
        <div class="helper-banner">
          Поддерживается полная JSON-резервная копия приложения. При импорте текущие локальные данные будут заменены.
        </div>
        <div class="field">
          <label for="importJsonInput">Выберите JSON-файл</label>
          <input id="importJsonInput" class="text-input" type="file" accept="application/json,.json" />
        </div>
        <div class="sheet-footer">
          <button id="confirmImportButton" class="primary-button" type="button">Импортировать</button>
        </div>
      </section>
    `,
    onBind: (sheetBody) => {
      sheetBody.querySelector("#confirmImportButton").addEventListener("click", async () => {
        const input = sheetBody.querySelector("#importJsonInput");
        const [file] = input.files || [];

        if (!file) {
          toast("Выберите JSON-файл");
          return;
        }

        let payload;

        try {
          const content = await file.text();
          payload = JSON.parse(content);
        } catch (error) {
          toast("Не удалось прочитать JSON-файл");
          return;
        }

        if (
          !payload ||
          typeof payload !== "object" ||
          !Array.isArray(payload.clients) ||
          !Array.isArray(payload.orders) ||
          !Array.isArray(payload.expenses)
        ) {
          toast("Файл не похож на резервную копию приложения");
          return;
        }

        await importDatabase(payload);
        await loadAllData();
        closeSheet();
        render();
        toast("Данные успешно импортированы");
      });
    },
  });
}

function openClearDataSheet() {
  openSheet({
    kicker: "Подтверждение",
    title: "Очистить все данные?",
    body: `
      <section class="sheet-section">
        <div class="helper-banner">
          Это действие удалит клиентов, заказы, расходы и локальные настройки из IndexedDB на этом устройстве.
        </div>
        <div class="settings-actions">
          <button class="danger-button" type="button" id="confirmClearDataButton">Да, очистить</button>
          <button class="ghost-button" type="button" id="cancelClearDataButton">Отмена</button>
        </div>
      </section>
    `,
    onBind: (sheetBody) => {
      sheetBody.querySelector("#cancelClearDataButton").addEventListener("click", closeSheet);
      sheetBody.querySelector("#confirmClearDataButton").addEventListener("click", async () => {
        await clearStore(STORE_NAMES.clients);
        await clearStore(STORE_NAMES.orders);
        await clearStore(STORE_NAMES.expenses);
        await clearStore(STORE_NAMES.settings);
        state.filters = structuredClone(DEFAULT_FILTERS);
        state.homePeriod = "today";
        await loadAllData();
        closeSheet();
        render();
        toast("Локальные данные очищены");
      });
    },
  });
}

function openReportOrdersSheet(type, label) {
  const orders = getReportBreakdownOrders(type, label);

  openSheet({
    kicker: "Отчет",
    title: label || "Заказы",
    body: `
      <section class="sheet-section">
        <div class="section-header">
          <div>
            <h3>${orders.length} ${pluralizeOrders(orders.length)}</h3>
          </div>
        </div>
        <div class="list-stack">
          ${
            orders.length
              ? orders.map((order) => renderOrderCard(order, { compact: true, forceExpanded: true })).join("")
              : renderEmptyCard("Заказов нет", "В этом пункте нет выполненных заказов за выбранный период.")
          }
        </div>
      </section>
    `,
    onBind: (sheetBody) => {
      bindRecordInteractions(sheetBody);
    },
  });
}

async function markOrderDone(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) {
    return;
  }

  await putRecord(STORE_NAMES.orders, {
    ...order,
    status: "done",
    completedDate: order.completedDate || nowIso(),
    updatedAt: nowIso(),
  });

  await loadAllData();
  render();
  toast("Заказ отмечен как выполненный");
}

async function markOrderCancelled(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  if (!order) {
    return;
  }

  await putRecord(STORE_NAMES.orders, {
    ...order,
    status: "cancelled",
    completedDate: "",
    updatedAt: nowIso(),
  });

  await loadAllData();
  render();
  toast("Заказ отменен");
}

function openDeleteOrderSheet(orderId) {
  const order = state.data.orders.find((item) => item.id === orderId);
  const client = getClientById(order?.clientId);

  if (!order) {
    toast("Заказ не найден");
    return;
  }

  openSheet({
    kicker: "Подтверждение",
    title: "Удалить заказ?",
    body: `
      <section class="sheet-section">
        <div class="helper-banner">
          Заказ ${escapeHtml(client?.name || "клиента")} будет полностью удален. Это действие нельзя отменить.
        </div>
        <div class="settings-actions">
          <button class="danger-button" type="button" id="confirmDeleteOrderButton">Да, удалить</button>
          <button class="ghost-button" type="button" id="cancelDeleteOrderButton">Отмена</button>
        </div>
      </section>
    `,
    onBind: (sheetBody) => {
      sheetBody.querySelector("#cancelDeleteOrderButton").addEventListener("click", closeSheet);
      sheetBody.querySelector("#confirmDeleteOrderButton").addEventListener("click", async () => {
        await deleteRecord(STORE_NAMES.orders, orderId);
        await loadAllData();
        closeSheet();
        render();
        toast("Заказ удален");
      });
    },
  });
}

async function deleteExpense(expenseId) {
  await deleteRecord(STORE_NAMES.expenses, expenseId);
  await loadAllData();
  render();
  toast("Расход удален");
}

async function archiveClient(clientId) {
  const hasOrders = state.data.orders.some((order) => order.clientId === clientId);
  if (hasOrders) {
    toast("Нельзя удалить клиента, пока за ним закреплены заказы");
    return;
  }

  await deleteRecord(STORE_NAMES.clients, clientId);
  await loadAllData();
  render();
  toast("Клиент удален");
}

function getClientById(clientId) {
  return state.data.clients.find((client) => client.id === clientId) || null;
}

function findClientByName(name, ignoredClientId = "") {
  const normalizedName = normalizeString(name);

  if (!normalizedName) {
    return null;
  }

  return (
    state.data.clients.find(
      (client) => client.id !== ignoredClientId && normalizeString(client.name) === normalizedName,
    ) || null
  );
}

function getKnownClientNames() {
  return getUniqueSortedValues(state.data.clients.map((client) => client.name));
}

function getKnownCities() {
  return getUniqueSortedValues([
    ...state.data.clients.map((client) => client.city),
    ...state.data.orders.map((order) => order.city),
  ]);
}

function getUniqueSortedValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((first, second) =>
    first.localeCompare(second, "ru"),
  );
}

function getStatusLabel(status) {
  return ORDER_STATUSES.find((item) => item.value === status)?.label || status;
}

function getOrdersByStatus(status) {
  return state.data.orders.filter((order) => order.status === status);
}

function getFilteredOrders() {
  const filters = state.filters.orders;
  const fromDate = filters.fromDate ? new Date(filters.fromDate) : null;
  const toDate = filters.toDate ? new Date(`${filters.toDate}T23:59:59`) : null;
  const query = normalizeString(filters.query);

  return state.data.orders.filter((order) => {
    const client = getClientById(order.clientId);
    const searchableText = [
      client?.name,
      client?.phone,
      order.city,
      order.address,
      order.comment,
      order.workType,
    ]
      .map(normalizeString)
      .join(" ");

    const relevantDate = order.status === "done" ? order.completedDate : order.plannedDate || order.createdAt;

    return (
      (filters.status === "all" || order.status === filters.status) &&
      (!filters.city || normalizeString(order.city).includes(normalizeString(filters.city))) &&
      (!filters.clientId || order.clientId === filters.clientId) &&
      (!filters.workType || order.workType === filters.workType) &&
      (!filters.source || (order.source || client?.source || "") === filters.source) &&
      (!query || searchableText.includes(query)) &&
      (!fromDate || isDateInRange(relevantDate, fromDate, null)) &&
      (!toDate || isDateInRange(relevantDate, null, toDate))
    );
  });
}

function getFilteredClients() {
  const filters = state.filters.clients;
  const query = normalizeString(filters.query);

  return state.data.clients.filter((client) => {
    const text = [client.name, client.phone, client.city, client.notes].map(normalizeString).join(" ");

    return (
      (!query || text.includes(query)) &&
      (!filters.city || normalizeString(client.city).includes(normalizeString(filters.city))) &&
      (!filters.source || client.source === filters.source)
    );
  });
}

function getOperationalPeriodSummary(period) {
  const { from, to } = getDateRange(period);
  const doneOrders = state.data.orders.filter(
    (order) => order.status === "done" && isDateInRange(order.completedDate, from, to),
  );
  const expenses = state.data.expenses.filter((expense) => isDateInRange(expense.date, from, to));

  const income = sumBy(doneOrders, (order) => order.amount);
  const expense = sumBy(expenses, (expenseItem) => expenseItem.amount);

  return {
    income,
    expense,
    netProfit: income - expense,
    doneOrders: doneOrders.length,
    expenseCount: expenses.length,
  };
}

function getClientOrderSummary(clientId) {
  const orders = state.data.orders.filter((order) => order.clientId === clientId);
  const doneOrders = orders.filter((order) => order.status === "done");
  const cancelledOrders = orders.filter((order) => order.status === "cancelled");

  return {
    total: orders.length,
    done: doneOrders.length,
    cancelled: cancelledOrders.length,
    doneAmount: sumBy(doneOrders, (order) => order.amount),
  };
}

function buildReportData() {
  const { period, fromDate, toDate } = state.filters.reports;
  const range = getDateRange(period, fromDate, toDate);

  const doneOrders = state.data.orders.filter(
    (order) => order.status === "done" && isDateInRange(order.completedDate, range.from, range.to),
  );
  const expenses = getFilteredExpensesForPeriod(range.from, range.to);
  const income = sumBy(doneOrders, (order) => order.amount);
  const expense = sumBy(expenses, (expenseItem) => expenseItem.amount);
  const doneClientIds = doneOrders.map((order) => order.clientId);
  const uniqueClientIds = new Set(doneClientIds);
  const newClients = state.data.clients.filter((client) => isDateInRange(client.createdAt, range.from, range.to));
  const repeatClients = [...uniqueClientIds].filter(
    (clientId) => state.data.orders.filter((order) => order.clientId === clientId && order.status === "done").length > 1,
  );

  return {
    range,
    summary: {
      doneOrders: doneOrders.length,
      income,
      expense,
      netProfit: income - expense,
      averageTicket: doneOrders.length ? Math.round(income / doneOrders.length) : 0,
      clientCount: uniqueCount(doneClientIds),
      newClients: newClients.length,
      repeatClients: repeatClients.length,
    },
    breakdowns: {
      cities: buildGroupedBreakdown(doneOrders, (order) => order.city || "Не указан", (order) => order.amount, true),
      sources: buildGroupedBreakdown(
        doneOrders,
        (order) => order.source || getClientById(order.clientId)?.source || "Не указан",
        (order) => order.amount,
        true,
      ),
      workTypes: buildGroupedBreakdown(doneOrders, (order) => order.workType || "Не указан", (order) => order.amount, true),
      expenseCategories: buildGroupedBreakdown(expenses, (expenseItem) => expenseItem.category || "Не указан", (expenseItem) => expenseItem.amount, true),
      days: buildGroupedBreakdown(doneOrders, (order) => formatDate(order.completedDate), () => 1, false),
      clients: buildGroupedBreakdown(
        doneOrders,
        (order) => getClientById(order.clientId)?.name || "Клиент удален",
        (order) => order.amount,
        true,
      ),
    },
  };
}

function getReportDoneOrders() {
  const { period, fromDate, toDate } = state.filters.reports;
  const range = getDateRange(period, fromDate, toDate);

  return state.data.orders.filter(
    (order) => order.status === "done" && isDateInRange(order.completedDate, range.from, range.to),
  );
}

function getReportBreakdownOrders(type, label) {
  const orders = getReportDoneOrders();

  if (type === "city") {
    return orders.filter((order) => (order.city || "Не указан") === label);
  }

  if (type === "source") {
    return orders.filter((order) => (order.source || getClientById(order.clientId)?.source || "Не указан") === label);
  }

  if (type === "workType") {
    return orders.filter((order) => (order.workType || "Не указан") === label);
  }

  if (type === "day") {
    return orders.filter((order) => formatDate(order.completedDate) === label);
  }

  if (type === "client") {
    return orders.filter((order) => (getClientById(order.clientId)?.name || "Клиент удален") === label);
  }

  return [];
}

function getFilteredExpensesForPeriod(from, to) {
  return state.data.expenses.filter((expense) => isDateInRange(expense.date, from, to));
}

function buildGroupedBreakdown(items, labelSelector, valueSelector, isMoney) {
  const map = new Map();

  items.forEach((item) => {
    const label = labelSelector(item);
    const current = map.get(label) || 0;
    map.set(label, current + Number(valueSelector(item) || 0));
  });

  return [...map.entries()]
    .map(([label, value]) => ({ label, value, isMoney }))
    .sort((firstItem, secondItem) => secondItem.value - firstItem.value);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission === "granted" ? "granted" : Notification.requestPermission();
}

async function scheduleOrderReminder(order, client, permission) {
  if (permission === "unsupported") {
    toast("Уведомления не поддерживаются на этом телефоне");
    return;
  }

  if (permission !== "granted") {
    toast("Разрешите уведомления, чтобы получать напоминания");
    return;
  }

  const plannedDate = toDateInputValue(order.plannedDate);
  if (!plannedDate) {
    return;
  }

  const reminderAt = new Date(`${plannedDate}T09:00:00`);
  const delay = reminderAt.getTime() - Date.now();
  if (delay <= 0) {
    toast("Дата уже наступила, напоминание не поставлено");
    return;
  }

  window.setTimeout(() => {
    showOrderNotification(order, client);
  }, Math.min(delay, 2147483647));

  toast("Напоминание поставлено");
}

async function showOrderNotification(order, client) {
  const title = `Заказ: ${client?.name || "клиент"}`;
  const body = `${order.city || "Город не указан"} • ${order.workType || "Тип работы не указан"}`;

  if (navigator.serviceWorker?.ready) {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      body,
      tag: order.id,
      icon: "./assets/icon-192.svg",
      badge: "./assets/icon-192.svg",
    });
    return;
  }

  new Notification(title, {
    body,
    tag: order.id,
    icon: "./assets/icon-192.svg",
  });
}

async function saveSetting(key, value) {
  await putRecord(STORE_NAMES.settings, { key, value, updatedAt: nowIso() });
}

async function handleExportJson(isBackup) {
  const payload = await exportDatabase();
  const filename = isBackup
    ? `basa-tractor-backup-${new Date().toISOString().slice(0, 10)}.json`
    : `basa-tractor-export-${new Date().toISOString().slice(0, 10)}.json`;

  downloadFile(filename, JSON.stringify(payload, null, 2), "application/json");

  if (isBackup) {
    state.data.settings.lastBackupAt = nowIso();
    await saveSetting("lastBackupAt", state.data.settings.lastBackupAt);
    render();
  }

  toast(isBackup ? "Резервная копия создана" : "JSON экспортирован");
}

function exportOrdersCsv() {
  const rows = [
    ["ID", "Клиент", "Город", "Тип работы", "Сумма", "Статус", "Источник", "Дата создания", "План", "Дата выполнения", "Комментарий"],
    ...state.data.orders.map((order) => [
      order.id,
      getClientById(order.clientId)?.name || "",
      order.city,
      order.workType,
      order.amount,
      getStatusLabel(order.status),
      order.source || getClientById(order.clientId)?.source || "",
      formatDate(order.createdAt, true),
      formatDate(order.plannedDate),
      formatDate(order.completedDate),
      order.comment || "",
    ]),
  ];

  downloadFile("orders.csv", buildCsv(rows), "text/csv;charset=utf-8");
  toast("CSV заказов выгружен");
}

function exportClientsCsv() {
  const rows = [
    ["ID", "Имя", "Телефон", "Город", "Адрес", "Источник", "Комментарий к источнику", "Есть свой номер", "Связь через", "Тип связи", "Заметка"],
    ...state.data.clients.map((client) => [
      client.id,
      client.name,
      client.phone || "",
      client.city || "",
      client.address || "",
      client.source || "",
      client.sourceComment || "",
      client.hasOwnPhone ? "Да" : "Нет",
      getClientById(client.linkedClientId)?.name || "",
      client.relationType || "",
      client.notes || "",
    ]),
  ];

  downloadFile("clients.csv", buildCsv(rows), "text/csv;charset=utf-8");
  toast("CSV клиентов выгружен");
}

function exportExpensesCsv() {
  const rows = [
    ["ID", "Дата", "Категория", "Сумма", "Комментарий"],
    ...state.data.expenses.map((expense) => [
      expense.id,
      formatDate(expense.date, true),
      expense.category,
      expense.amount,
      expense.comment || "",
    ]),
  ];

  downloadFile("expenses.csv", buildCsv(rows), "text/csv;charset=utf-8");
  toast("CSV расходов выгружен");
}

async function installPwa() {
  if (window.deferredPrompt) {
    await window.deferredPrompt.prompt();
    window.deferredPrompt = null;
    toast("Окно установки открыто");
    return;
  }

  toast("Установка доступна через меню браузера, если устройство поддерживает PWA.");
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}
