const pad2 = (value) => String(value).padStart(2, "0");

const getDateOnlyParts = (value) => {
  if (!value) return null;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const validationDate = new Date(Date.UTC(year, month - 1, day));

  if (
    validationDate.getUTCFullYear() !== year ||
    validationDate.getUTCMonth() + 1 !== month ||
    validationDate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
};

export const getLocalDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const toDateOnlyInputValue = (value) => {
  const parts = getDateOnlyParts(value);
  if (!parts) return "";

  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
};

export const formatDateOnly = (value, fallback = "-") => {
  const parts = getDateOnlyParts(value);
  if (!parts) return fallback;

  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
};
