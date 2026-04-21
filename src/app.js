import {
  CLIENT_SOURCES,
  DEFAULT_FILTERS,
  DEFAULT_SETTINGS,
  EXPENSE_CATEGORIES,
  HOME_PERIODS,
  ORDER_STATUSES,
  RELATION_TYPES,
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
      source: "Через соседа",
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
      source: "Через соседа",
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

  const periodSummary = getOperationalPeriodSummary(state.homePeriod);

  return `
    <section class="screen-stack">
      <article class="hero-card">
        <p class="eyebrow">Ежедневная работа без лишних действий</p>
        <h2>Доход, расходы и заявки в одном офлайн-приложении</h2>
        <p>Главный экран собран как рабочий пульт: видно заработок, нагрузку на сегодня и свежие заявки без переходов по вложенным меню.</p>
        <div class="hero-actions" style="margin-top: 16px;">
          <button class="primary-button" type="button" data-action="new-order">Новый заказ</button>
          <button class="ghost-button" type="button" data-action="new-expense">Новый расход</button>
          <button class="chip-button" type="button" data-action="open-calculator">Калькулятор</button>
        </div>
      </article>

      <section class="stats-grid">
        ${renderMetricCard("Доход сегодня", todayStats.income, `${todayStats.doneOrders} выполнено`, "success")}
        ${renderMetricCard("Расход сегодня", todayStats.expense, `${todayStats.expenseCount} расходов`, "amber")}
        ${renderMetricCard("Чистыми сегодня", todayStats.netProfit, "Доход минус расход", "blue")}
        ${renderMetricCard("Ожидают", pendingOrders.length, `${pendingOrders.length} ${pluralizeOrders(pendingOrders.length)}`, "plain", true)}
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Сводка периода</p>
            <h3>Сегодня, неделя, месяц</h3>
          </div>
          <div class="summary-switcher">
            ${HOME_PERIODS.map(
              (period) => `
                <button class="chip-button ${state.homePeriod === period.value ? "is-active" : ""}" type="button" data-home-period="${period.value}">
                  ${period.label}
                </button>
              `,
            ).join("")}
          </div>
        </div>

        <div class="report-grid">
          <div class="data-item">
            <span class="muted-label">Доход</span>
            <strong>${formatCurrency(periodSummary.income)}</strong>
          </div>
          <div class="data-item">
            <span class="muted-label">Расход</span>
            <strong>${formatCurrency(periodSummary.expense)}</strong>
          </div>
          <div class="data-item">
            <span class="muted-label">Чистая прибыль</span>
            <strong>${formatCurrency(periodSummary.netProfit)}</strong>
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Быстрые действия</p>
            <h3>То, что нужно под рукой</h3>
          </div>
        </div>
        <div class="quick-action-grid">
          ${renderQuickActionCard("Новый клиент", "Добавить контакт, источник и связь", "new-client")}
          ${renderQuickActionCard("Новый заказ", "Записать заявку и дату выполнения", "new-order")}
          ${renderQuickActionCard("Новый расход", "Учесть заправку, ремонт или покупку", "new-expense")}
          ${renderQuickActionCard("Калькулятор", "Открыть встроенный слой поверх экрана", "open-calculator")}
        </div>
      </section>

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Последние действия</p>
            <h3>Свежие заказы и изменения</h3>
          </div>
          <button class="ghost-button" type="button" data-go-screen="orders">Все заказы</button>
        </div>
        <div class="list-stack">
          ${
            recentActivity.length
              ? recentActivity.map((order) => renderOrderCard(order, { compact: true })).join("")
              : renderEmptyCard("Пока нет заказов", "Добавьте первый заказ через кнопку + или карточку быстрого действия.")
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
      <section class="section-card search-card">
        <div class="page-header">
          <div class="page-title">
            <p class="eyebrow">Основной рабочий экран</p>
            <h2>Заказы</h2>
            <p>Статусы, фильтры, быстрые действия и мгновенный переход в карточку клиента или заказа.</p>
          </div>
          <div class="inline-actions">
            <button class="ghost-button" type="button" data-action="open-calculator">Калькулятор</button>
            <button class="primary-button" type="button" data-action="new-order">Новый</button>
          </div>
        </div>

        <div class="segment-control">
          ${ORDER_STATUSES.map(
            (status) => `
              <button class="chip-button ${filters.status === status.value ? "is-active" : ""}" type="button" data-order-status="${status.value}">
                ${status.label}
              </button>
            `,
          ).join("")}
        </div>

        <div class="filters-grid">
          <div class="field">
            <label for="orderQueryInput">Поиск</label>
            <input id="orderQueryInput" class="text-input" type="search" value="${escapeHtml(filters.query)}" placeholder="Имя, город, адрес, комментарий" />
          </div>
          <div class="field">
            <label for="orderCityFilter">Город</label>
            <input id="orderCityFilter" class="text-input" type="text" value="${escapeHtml(filters.city)}" placeholder="Например, Баса" />
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

      <section class="section-card">
        <div class="section-header">
          <div>
            <p class="eyebrow">Список</p>
            <h3>${ORDER_STATUSES.find((status) => status.value === filters.status)?.label || "Заказы"}</h3>
          </div>
          <span class="info-pill">${orders.length} ${pluralizeOrders(orders.length)}</span>
        </div>
        <div class="list-stack">
          ${orders.length ? orders.map((order) => renderOrderCard(order)).join("") : renderEmptyCard("Ничего не найдено", "Измените фильтры или добавьте новый заказ через кнопку +.")}
        </div>
      </section>
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
            <p>Поиск по имени, телефону и городу, с поддержкой клиентов без номера и связей через других клиентов.</p>
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
            <input id="clientCityFilter" class="text-input" type="text" value="${escapeHtml(state.filters.clients.city)}" placeholder="Например, Карасу" />
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
            <p>Доход учитывается только по выполненным заказам и только по дате выполнения, как указано в бизнес-логике.</p>
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
          ${renderBreakdownCard("По городам", report.breakdowns.cities)}
          ${renderBreakdownCard("По источникам", report.breakdowns.sources)}
          ${renderBreakdownCard("По типам работ", report.breakdowns.workTypes)}
          ${renderBreakdownCard("По категориям расходов", report.breakdowns.expenseCategories)}
          ${renderBreakdownCard("По дням", report.breakdowns.days)}
          ${renderBreakdownCard("По клиентам", report.breakdowns.clients)}
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
            <p>Экспорт, импорт, резервная копия, тема, сведения о приложении и подготовка к будущей интеграции калькулятора.</p>
          </div>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-header">
          <div>
            <h3>Данные</h3>
            <p>Полный JSON-экспорт, CSV по сущностям и импорт резервной копии.</p>
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
            <p>Тема переключается локально и сохраняется в настройках устройства.</p>
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
            <p>Сборка сделана как offline-first PWA с IndexedDB и чистым разделением логики, интерфейса и хранения данных.</p>
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
  const relationBadge =
    client?.linkedClientId && client?.relationType
      ? `<span class="tiny-pill">Связь: ${escapeHtml(client.relationType)}</span>`
      : "";

  return `
    <article class="record-card">
      <div class="record-title-row">
        <div>
          <h4>${escapeHtml(client?.name || "Клиент удален")}</h4>
          <p>${escapeHtml(order.city || client?.city || "Город не указан")} • ${escapeHtml(order.workType)}</p>
        </div>
        <span class="status-badge status-${order.status}">${getStatusLabel(order.status)}</span>
      </div>

      <div class="pill-row">
        <span class="info-pill">${formatCurrency(order.amount)}</span>
        <span class="tiny-pill">${escapeHtml(source)}</span>
        ${relationBadge}
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

      <p class="field-copy">${escapeHtml(order.comment || "Комментарий не указан")}</p>

      <div class="inline-actions">
        ${order.status !== "done" ? `<button class="primary-button" type="button" data-action="complete-order" data-order-id="${order.id}">Выполнить</button>` : ""}
        <button class="ghost-button" type="button" data-action="edit-order" data-order-id="${order.id}">Редактировать</button>
        ${order.status !== "cancelled" ? `<button class="danger-button" type="button" data-action="cancel-order" data-order-id="${order.id}">Отменить</button>` : ""}
        ${!options.compact ? `<button class="chip-button" type="button" data-action="view-client" data-client-id="${order.clientId}">Клиент</button>` : ""}
      </div>
    </article>
  `;
}

function renderClientCard(client) {
  const orderSummary = getClientOrderSummary(client.id);
  const linkedClient = getClientById(client.linkedClientId);

  return `
    <article class="record-card">
      <div class="record-title-row">
        <div>
          <h4>${escapeHtml(client.name)}</h4>
          <p>${escapeHtml(client.phone || "Номер не указан")} • ${escapeHtml(client.city || "Город не указан")}</p>
        </div>
        <span class="tiny-pill">${escapeHtml(client.source || "Источник не указан")}</span>
      </div>

      <div class="pill-row">
        ${
          linkedClient
            ? `<span class="info-pill">Через: ${escapeHtml(linkedClient.name)}</span>`
            : `<span class="info-pill">${client.hasOwnPhone ? "Есть свой номер" : "Без номера"}</span>`
        }
        ${client.relationType ? `<span class="tiny-pill">${escapeHtml(client.relationType)}</span>` : ""}
      </div>

      <p class="field-copy">${escapeHtml(client.notes || "Без заметки")}</p>

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
    </article>
  `;
}

function renderExpenseCard(expense) {
  return `
    <article class="record-card">
      <div class="record-title-row">
        <div>
          <h4>${escapeHtml(expense.category)}</h4>
          <p>${formatDate(expense.date)} • ${escapeHtml(expense.comment || "Без комментария")}</p>
        </div>
        <span class="status-badge status-pending">${formatCurrency(expense.amount)}</span>
      </div>
      <div class="inline-actions">
        <button class="ghost-button" type="button" data-action="edit-expense" data-expense-id="${expense.id}">Редактировать</button>
        <button class="danger-button" type="button" data-action="delete-expense" data-expense-id="${expense.id}">Удалить</button>
      </div>
    </article>
  `;
}

function renderBreakdownCard(title, items) {
  return `
    <article class="report-card">
      <div class="report-header">
        <div>
          <h3>${title}</h3>
          <p>${items.length ? "Актуальная выборка за выбранный период" : "Нет данных для этого периода"}</p>
        </div>
      </div>
      <div class="table-like-list">
        ${
          items.length
            ? items
                .slice(0, 6)
                .map(
                  (item) => `
                    <div class="data-item">
                      <span class="muted-label">${escapeHtml(item.label)}</span>
                      <strong>${item.isMoney ? formatCurrency(item.value) : formatNumber(item.value)}</strong>
                    </div>
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

  appContent.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset));
  });

  bindFilterInputs();
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
          <div class="data-item"><span class="muted-label">Адрес</span><strong>${escapeHtml(client.address || "Не указан")}</strong></div>
          <div class="data-item"><span class="muted-label">Источник</span><strong>${escapeHtml(client.source || "Не указан")}</strong></div>
          <div class="data-item"><span class="muted-label">Комментарий к источнику</span><strong>${escapeHtml(client.sourceComment || "Нет")}</strong></div>
          <div class="data-item"><span class="muted-label">Тип связи</span><strong>${escapeHtml(client.relationType || "Нет")}</strong></div>
          <div class="data-item"><span class="muted-label">Через кого связь</span><strong>${escapeHtml(linkedClient?.name || "Нет")}</strong></div>
          <div class="data-item"><span class="muted-label">Кто рекомендовал</span><strong>${escapeHtml(referredByClient?.name || "Нет")}</strong></div>
        </div>
        <div class="helper-banner">${escapeHtml(client.notes || "Комментарий отсутствует")}</div>
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
    },
  });
}

function openClientForm({ clientId } = {}) {
  const client = clientId ? getClientById(clientId) : null;

  openSheet({
    kicker: client ? "Редактирование клиента" : "Новый клиент",
    title: client ? client.name : "Добавить клиента",
    body: `
      <form id="clientForm" class="sheet-section">
        <div class="form-grid">
          <div class="field">
            <label for="clientNameInput">Имя клиента</label>
            <input id="clientNameInput" class="text-input" type="text" required value="${escapeHtml(client?.name || "")}" />
          </div>
          <div class="field">
            <label for="clientPhoneInput">Телефон</label>
            <input id="clientPhoneInput" class="text-input" type="tel" inputmode="tel" value="${escapeHtml(client?.phone || "")}" placeholder="+7 (999) 123-45-67" />
          </div>
          <div class="field">
            <label for="clientCityInput">Город / село</label>
            <input id="clientCityInput" class="text-input" type="text" value="${escapeHtml(client?.city || "")}" />
          </div>
          <div class="field">
            <label for="clientAddressInput">Адрес</label>
            <input id="clientAddressInput" class="text-input" type="text" value="${escapeHtml(client?.address || "")}" />
          </div>
        </div>

        <div class="field">
          <label for="clientNotesInput">Комментарий</label>
          <textarea id="clientNotesInput" class="textarea-input">${escapeHtml(client?.notes || "")}</textarea>
        </div>

        <div class="form-grid">
          <label class="field-checkbox">
            <input id="clientHasOwnPhoneInput" type="checkbox" ${client?.hasOwnPhone !== false ? "checked" : ""} />
            <span>Есть собственный номер</span>
          </label>
          <label class="field-checkbox">
            <input id="clientLinkModeInput" type="checkbox" ${client?.linkedClientId ? "checked" : ""} />
            <span>Связь через другого клиента</span>
          </label>
        </div>

        <div id="clientRelationFields" class="form-grid" style="${client?.linkedClientId ? "" : "display:none;"}">
          <div class="field">
            <label for="linkedClientSelect">Выбрать клиента</label>
            <select id="linkedClientSelect" class="select-input">
              <option value="">Не выбран</option>
              ${state.data.clients
                .filter((item) => item.id !== clientId)
                .map(
                  (item) => `
                    <option value="${item.id}" ${client?.linkedClientId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>
                  `,
                )
                .join("")}
            </select>
          </div>
          <div class="field">
            <label for="relationTypeSelect">Тип связи</label>
            <select id="relationTypeSelect" class="select-input">
              <option value="">Не выбрано</option>
              ${RELATION_TYPES.map(
                (relation) => `
                  <option value="${relation}" ${client?.relationType === relation ? "selected" : ""}>${relation}</option>
                `,
              ).join("")}
            </select>
          </div>
        </div>

        <div class="divider"></div>

        <div class="form-grid">
          <div class="field">
            <label for="clientSourceSelect">Откуда узнал</label>
            <select id="clientSourceSelect" class="select-input">
              ${CLIENT_SOURCES.map(
                (source) => `
                  <option value="${source}" ${client?.source === source ? "selected" : ""}>${source}</option>
                `,
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="clientSourceCommentInput">Комментарий к источнику</label>
            <input id="clientSourceCommentInput" class="text-input" type="text" value="${escapeHtml(client?.sourceComment || "")}" />
          </div>
        </div>

        <div id="clientReferralField" class="field" style="${
          client?.source === "Знакомые" || client?.source === "Через соседа" ? "" : "display:none;"
        }">
          <label for="clientReferredBySelect">Через кого?</label>
          <select id="clientReferredBySelect" class="select-input">
            <option value="">Не выбрано</option>
            ${state.data.clients
              .filter((item) => item.id !== clientId)
              .map(
                (item) => `
                  <option value="${item.id}" ${client?.referredByClientId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>
                `,
              )
              .join("")}
          </select>
        </div>

        <div class="sheet-footer">
          <button class="primary-button" type="submit">${client ? "Сохранить клиента" : "Создать клиента"}</button>
        </div>
      </form>
    `,
    onBind: (sheetBody) => {
      const form = sheetBody.querySelector("#clientForm");
      const linkModeInput = sheetBody.querySelector("#clientLinkModeInput");
      const relationFields = sheetBody.querySelector("#clientRelationFields");
      const sourceSelect = sheetBody.querySelector("#clientSourceSelect");
      const referralField = sheetBody.querySelector("#clientReferralField");

      linkModeInput.addEventListener("change", () => {
        relationFields.style.display = linkModeInput.checked ? "" : "none";
      });

      sourceSelect.addEventListener("change", () => {
        const shouldShow = ["Знакомые", "Через соседа"].includes(sourceSelect.value);
        referralField.style.display = shouldShow ? "" : "none";
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const hasOwnPhone = sheetBody.querySelector("#clientHasOwnPhoneInput").checked;
        const linkedClientId = linkModeInput.checked ? sheetBody.querySelector("#linkedClientSelect").value : "";
        const referredByClientId = ["Знакомые", "Через соседа"].includes(sourceSelect.value)
          ? sheetBody.querySelector("#clientReferredBySelect").value
          : "";

        const record = {
          id: client?.id || createId("client"),
          name: sheetBody.querySelector("#clientNameInput").value.trim(),
          phone: sheetBody.querySelector("#clientPhoneInput").value.trim(),
          city: sheetBody.querySelector("#clientCityInput").value.trim(),
          address: sheetBody.querySelector("#clientAddressInput").value.trim(),
          notes: sheetBody.querySelector("#clientNotesInput").value.trim(),
          source: sourceSelect.value,
          sourceComment: sheetBody.querySelector("#clientSourceCommentInput").value.trim(),
          hasOwnPhone,
          linkedClientId,
          relationType: linkModeInput.checked ? sheetBody.querySelector("#relationTypeSelect").value : "",
          referredByClientId,
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
  const defaultClientMode = order?.clientId || clientId ? "existing" : "new";

  openSheet({
    kicker: order ? "Редактирование заказа" : "Новый заказ",
    title: order ? "Обновить заказ" : "Создать заказ",
    body: `
      <form id="orderForm" class="sheet-section">
        <section class="sheet-section">
          <h3>Клиент</h3>
          <div class="segment-control">
            <button id="existingClientModeButton" class="chip-button ${defaultClientMode === "existing" ? "is-active" : ""}" type="button">Выбрать из базы</button>
            <button id="newClientModeButton" class="chip-button ${defaultClientMode === "new" ? "is-active" : ""}" type="button">Новый клиент</button>
          </div>

          <div id="existingClientField" class="field" style="${defaultClientMode === "existing" ? "" : "display:none;"}">
            <label for="orderClientSelect">Выберите клиента</label>
            <select id="orderClientSelect" class="select-input">
              <option value="">Выбрать из базы</option>
              ${state.data.clients
                .map(
                  (clientItem) => `
                    <option value="${clientItem.id}" ${(order?.clientId || clientId) === clientItem.id ? "selected" : ""}>${escapeHtml(clientItem.name)} • ${escapeHtml(clientItem.city || "город не указан")}</option>
                  `,
                )
                .join("")}
            </select>
          </div>

          <div id="newClientFields" class="sheet-section" style="${defaultClientMode === "new" ? "" : "display:none;"}">
            <div class="form-grid">
              <div class="field">
                <label for="orderClientNameInput">Имя клиента</label>
                <input id="orderClientNameInput" class="text-input" type="text" value="${escapeHtml(selectedClient?.name || "")}" />
              </div>
              <div class="field">
                <label for="orderClientPhoneInput">Телефон</label>
                <input id="orderClientPhoneInput" class="text-input" type="tel" inputmode="tel" value="${escapeHtml(selectedClient?.phone || "")}" placeholder="+7 (999) 123-45-67" />
              </div>
              <div class="field">
                <label for="orderClientCityInlineInput">Город / село</label>
                <input id="orderClientCityInlineInput" class="text-input" type="text" value="${escapeHtml(selectedClient?.city || order?.city || "")}" />
              </div>
              <div class="field">
                <label for="orderClientAddressInlineInput">Адрес</label>
                <input id="orderClientAddressInlineInput" class="text-input" type="text" value="${escapeHtml(selectedClient?.address || order?.address || "")}" />
              </div>
            </div>

            <div class="field">
              <label for="orderClientNotesInlineInput">Комментарий</label>
              <textarea id="orderClientNotesInlineInput" class="textarea-input">${escapeHtml(selectedClient?.notes || "")}</textarea>
            </div>

            <div class="form-grid">
              <label class="field-checkbox">
                <input id="orderClientHasOwnPhoneInput" type="checkbox" ${selectedClient?.hasOwnPhone !== false ? "checked" : ""} />
                <span>Есть собственный номер</span>
              </label>
              <label class="field-checkbox">
                <input id="orderClientLinkModeInput" type="checkbox" ${selectedClient?.linkedClientId ? "checked" : ""} />
                <span>Связь через другого клиента</span>
              </label>
            </div>

            <div id="orderClientRelationFields" class="form-grid" style="${selectedClient?.linkedClientId ? "" : "display:none;"}">
              <div class="field">
                <label for="orderLinkedClientSelect">Выбрать клиента</label>
                <select id="orderLinkedClientSelect" class="select-input">
                  <option value="">Не выбран</option>
                  ${state.data.clients
                    .map(
                      (item) => `
                        <option value="${item.id}" ${selectedClient?.linkedClientId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>
                      `,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="orderRelationTypeSelect">Тип связи</label>
                <select id="orderRelationTypeSelect" class="select-input">
                  <option value="">Не выбрано</option>
                  ${RELATION_TYPES.map(
                    (relation) => `
                      <option value="${relation}" ${selectedClient?.relationType === relation ? "selected" : ""}>${relation}</option>
                    `,
                  ).join("")}
                </select>
              </div>
            </div>

            <div class="form-grid">
              <div class="field">
                <label for="orderClientSourceInlineSelect">Откуда узнал</label>
                <select id="orderClientSourceInlineSelect" class="select-input">
                  ${CLIENT_SOURCES.map(
                    (source) => `
                      <option value="${source}" ${(selectedClient?.source || "Авито") === source ? "selected" : ""}>${source}</option>
                    `,
                  ).join("")}
                </select>
              </div>
              <div class="field">
                <label for="orderClientSourceCommentInlineInput">Комментарий к источнику</label>
                <input id="orderClientSourceCommentInlineInput" class="text-input" type="text" value="${escapeHtml(selectedClient?.sourceComment || "")}" />
              </div>
            </div>

            <div id="orderClientReferralField" class="field" style="${
              selectedClient?.source === "Знакомые" || selectedClient?.source === "Через соседа" ? "" : "display:none;"
            }">
              <label for="orderClientReferredBySelect">Через кого?</label>
              <select id="orderClientReferredBySelect" class="select-input">
                <option value="">Не выбрано</option>
                ${state.data.clients
                  .map(
                    (item) => `
                      <option value="${item.id}" ${selectedClient?.referredByClientId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>
                    `,
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <div class="helper-banner">
            Заказ можно сохранить либо на клиента из базы, либо сразу с созданием нового клиента прямо в этой форме.
          </div>
        </section>

        <section class="sheet-section">
          <h3>Работа</h3>
          <div class="form-grid">
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
              <label for="orderAmountInput">Сумма</label>
              <input id="orderAmountInput" class="text-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(order?.amount || "")}" placeholder="Только цифры" />
            </div>
            <div class="field">
              <label for="orderCityInput">Город / село</label>
              <input id="orderCityInput" class="text-input" type="text" value="${escapeHtml(order?.city || selectedClient?.city || "")}" />
            </div>
            <div class="field">
              <label for="orderAddressInput">Адрес</label>
              <input id="orderAddressInput" class="text-input" type="text" value="${escapeHtml(order?.address || selectedClient?.address || "")}" />
            </div>
          </div>
          <div class="field">
            <label for="orderCommentInput">Комментарий</label>
            <textarea id="orderCommentInput" class="textarea-input">${escapeHtml(order?.comment || "")}</textarea>
          </div>
          <div class="form-grid">
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
        </section>

        <div class="sheet-footer">
          <button class="primary-button" type="submit">${order ? "Сохранить заказ" : "Создать заказ"}</button>
        </div>
      </form>
    `,
    onBind: (sheetBody) => {
      const form = sheetBody.querySelector("#orderForm");
      const statusSelect = sheetBody.querySelector("#orderStatusSelect");
      const completedDateField = sheetBody.querySelector("#completedDateField");
      const clientSelect = sheetBody.querySelector("#orderClientSelect");
      const existingClientModeButton = sheetBody.querySelector("#existingClientModeButton");
      const newClientModeButton = sheetBody.querySelector("#newClientModeButton");
      const existingClientField = sheetBody.querySelector("#existingClientField");
      const newClientFields = sheetBody.querySelector("#newClientFields");
      const cityInput = sheetBody.querySelector("#orderCityInput");
      const addressInput = sheetBody.querySelector("#orderAddressInput");
      const clientLinkModeInput = sheetBody.querySelector("#orderClientLinkModeInput");
      const relationFields = sheetBody.querySelector("#orderClientRelationFields");
      const sourceInlineSelect = sheetBody.querySelector("#orderClientSourceInlineSelect");
      const referralField = sheetBody.querySelector("#orderClientReferralField");
      let clientMode = defaultClientMode;

      statusSelect.addEventListener("change", () => {
        completedDateField.style.display = statusSelect.value === "done" ? "" : "none";
      });

      existingClientModeButton.addEventListener("click", () => {
        clientMode = "existing";
        syncClientMode();
      });

      newClientModeButton.addEventListener("click", () => {
        clientMode = "new";
        syncClientMode();
      });

      clientSelect.addEventListener("change", () => {
        const currentClient = getClientById(clientSelect.value);
        if (currentClient) {
          cityInput.value = currentClient.city || cityInput.value;
          addressInput.value = currentClient.address || addressInput.value;
        }
      });

      if (clientLinkModeInput) {
        clientLinkModeInput.addEventListener("change", () => {
          relationFields.style.display = clientLinkModeInput.checked ? "" : "none";
        });
      }

      if (sourceInlineSelect) {
        sourceInlineSelect.addEventListener("change", () => {
          const shouldShow = ["Знакомые", "Через соседа"].includes(sourceInlineSelect.value);
          referralField.style.display = shouldShow ? "" : "none";
        });
      }

      syncClientMode();

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        let selectedClientId = clientSelect.value;
        let currentClient = getClientById(selectedClientId);

        if (clientMode === "new") {
          const newClientName = sheetBody.querySelector("#orderClientNameInput").value.trim();
          const newClientSource = sheetBody.querySelector("#orderClientSourceInlineSelect").value;

          if (!newClientName) {
            toast("Укажите имя клиента");
            return;
          }

          currentClient = {
            id: order?.clientId || createId("client"),
            name: newClientName,
            phone: sheetBody.querySelector("#orderClientPhoneInput").value.trim(),
            city: sheetBody.querySelector("#orderClientCityInlineInput").value.trim(),
            address: sheetBody.querySelector("#orderClientAddressInlineInput").value.trim(),
            notes: sheetBody.querySelector("#orderClientNotesInlineInput").value.trim(),
            source: newClientSource,
            sourceComment: sheetBody.querySelector("#orderClientSourceCommentInlineInput").value.trim(),
            hasOwnPhone: sheetBody.querySelector("#orderClientHasOwnPhoneInput").checked,
            linkedClientId: sheetBody.querySelector("#orderClientLinkModeInput").checked ? sheetBody.querySelector("#orderLinkedClientSelect").value : "",
            relationType: sheetBody.querySelector("#orderClientLinkModeInput").checked ? sheetBody.querySelector("#orderRelationTypeSelect").value : "",
            referredByClientId: ["Знакомые", "Через соседа"].includes(newClientSource)
              ? sheetBody.querySelector("#orderClientReferredBySelect").value
              : "",
            createdAt: selectedClient?.createdAt || nowIso(),
            updatedAt: nowIso(),
          };

          await putRecord(STORE_NAMES.clients, currentClient);
          selectedClientId = currentClient.id;
        }

        if (!selectedClientId || !currentClient) {
          toast("Выберите клиента или заполните нового клиента");
          return;
        }

        const status = statusSelect.value;
        const plannedDateValue = sheetBody.querySelector("#orderPlannedDateInput").value;
        const completedDateValue = sheetBody.querySelector("#orderCompletedDateInput")?.value || "";

        const record = {
          id: order?.id || createId("order"),
          clientId: selectedClientId,
          workType: sheetBody.querySelector("#orderWorkTypeSelect").value,
          amount: Number(sheetBody.querySelector("#orderAmountInput").value.replace(/\D/g, "")),
          status,
          city: cityInput.value.trim(),
          address: addressInput.value.trim(),
          comment: sheetBody.querySelector("#orderCommentInput").value.trim(),
          plannedDate: plannedDateValue ? new Date(plannedDateValue).toISOString() : "",
          completedDate:
            status === "done"
              ? new Date(completedDateValue || plannedDateValue || new Date().toISOString()).toISOString()
              : "",
          source: currentClient.source || "",
          createdAt: order?.createdAt || nowIso(),
          updatedAt: nowIso(),
        };

        if (!record.amount) {
          toast("Укажите сумму заказа");
          return;
        }

        await putRecord(STORE_NAMES.orders, record);
        await loadAllData();
        closeSheet();
        render();
        toast(order ? "Заказ обновлен" : "Заказ создан");
      });

      function syncClientMode() {
        const isExistingMode = clientMode === "existing";
        existingClientModeButton.classList.toggle("is-active", isExistingMode);
        newClientModeButton.classList.toggle("is-active", !isExistingMode);
        existingClientField.style.display = isExistingMode ? "" : "none";
        newClientFields.style.display = isExistingMode ? "none" : "";
      }
    },
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
      order.status === filters.status &&
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
