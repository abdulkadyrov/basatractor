export const ORDER_STATUSES = [
  { value: "pending", label: "Ожидает" },
  { value: "done", label: "Выполнено" },
  { value: "cancelled", label: "Отменено" },
];

export const WORK_TYPES = [
  "Огород",
  "Парник",
  "Культивация",
  "Фрезеровка",
  "Вспашка",
  "Доставка",
  "Другое",
];

export const CLIENT_SOURCES = [
  "Сарафанка",
  "Повторный клиент",
  "Авито",
  "Реклама в WhatsApp",
  "Остановили в дороге",
  "Знакомые",
  "Другое",
];

export const EXPENSE_CATEGORIES = [
  "Заправка",
  "Ремонт",
  "Покупка",
  "Масло",
  "Запчасти",
  "Расходники",
  "Другое",
];

export const RELATION_TYPES = ["Сосед", "Знакомый", "Родственник", "Другое"];

export const REPORT_PERIODS = [
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
  { value: "all", label: "Все время" },
  { value: "custom", label: "Свой период" },
];

export const NAVIGATION_ITEMS = [
  { screen: "home", label: "Главная" },
  { screen: "orders", label: "Заказы" },
  { screen: "clients", label: "Клиенты" },
  { screen: "reports", label: "Отчеты" },
  { screen: "settings", label: "Настройки" },
];

export const HOME_PERIODS = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
];

export const DEFAULT_SETTINGS = {
  theme: "dark",
  calculatorReady: true,
  lastBackupAt: "",
};

export const DEFAULT_FILTERS = {
  orders: {
    status: "all",
    city: "",
    clientId: "",
    source: "",
    workType: "",
    fromDate: "",
    toDate: "",
    query: "",
  },
  clients: {
    query: "",
    city: "",
    source: "",
  },
  reports: {
    period: "month",
    fromDate: "",
    toDate: "",
  },
};
