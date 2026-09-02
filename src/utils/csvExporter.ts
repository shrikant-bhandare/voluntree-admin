/**
 * Cells that start with a formula trigger (= + - @, tab, CR) are evaluated by
 * Excel/LibreOffice when the file is opened. Names, titles and report reasons
 * in these exports are user-supplied, so neutralise them with a leading quote.
 */
function csvCell(cell: string | number): string {
  let text = String(cell ?? "");
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export const exportToCsv = (
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) => {
  const csvContent = [
    headers.map(csvCell).join(","),
    ...rows.map(row => row.map(csvCell).join(",")),
  ].join("\r\n");

  // BOM so Excel decodes non-ASCII names (Zoë, Müller, emoji) correctly.
  const blob = new Blob(["﻿" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Some browsers abort the download if the URL is revoked synchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
