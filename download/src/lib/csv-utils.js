function convertToCSV(watchlist) {
  const items = watchlist.items;
  if (items.length === 0) {
    return "";
  }

  const headers = Object.keys(items[0]);
  const csvRows = [headers.join(",")];

  for (const item of items) {
    const values = headers.map(header => {
      const escaped = ('' + item[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

module.exports = { convertToCSV };