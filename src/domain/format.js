// Pure formatting helpers. No locale/currency logic belongs anywhere else.
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "narrowSymbol",
});

export function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return CURRENCY_FORMATTER.format(value);
}

export function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function joinList(items, separator = ", ") {
  if (!items || items.length === 0) return "—";
  return items.join(separator);
}
