export function createId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function formatCurrency(value) {
  const safeValue = Number(value || 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatDate(value, withTime = false) {
  if (!value) {
    return "Не указано";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function normalizeString(value) {
  return String(value || "").trim().toLowerCase();
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function getDateRange(period, fromDate = "", toDate = "") {
  const now = new Date();
  const todayStart = startOfDay(now);

  if (period === "today") {
    return { from: todayStart, to: endOfDay(now) };
  }

  if (period === "yesterday") {
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }

  if (period === "week") {
    const from = new Date(todayStart);
    from.setDate(from.getDate() - 6);
    return { from, to: endOfDay(now) };
  }

  if (period === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: endOfDay(now),
    };
  }

  if (period === "year") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: endOfDay(now),
    };
  }

  if (period === "custom") {
    return {
      from: fromDate ? startOfDay(new Date(fromDate)) : null,
      to: toDate ? endOfDay(new Date(toDate)) : null,
    };
  }

  return { from: null, to: null };
}

export function isDateInRange(value, from, to) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          const escaped = value.replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(","),
    )
    .join("\n");
}

export function sumBy(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

export function uniqueCount(values) {
  return new Set(values.filter(Boolean)).size;
}

export function sortByDateDesc(items, selector) {
  return [...items].sort((firstItem, secondItem) => {
    const firstDate = new Date(selector(firstItem) || 0).getTime();
    const secondDate = new Date(selector(secondItem) || 0).getTime();
    return secondDate - firstDate;
  });
}

export function pluralizeOrders(count) {
  const remainder10 = count % 10;
  const remainder100 = count % 100;

  if (remainder10 === 1 && remainder100 !== 11) {
    return "заказ";
  }

  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) {
    return "заказа";
  }

  return "заказов";
}
