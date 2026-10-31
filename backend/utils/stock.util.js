function planBatchDeductions(rows, requestedQuantity) {
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) throw new Error('Requested quantity must be a positive integer.');
  const eligible = rows.filter((row) => Number(row.quantity) > 0)
    .sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date)) || Number(a.inventory_id) - Number(b.inventory_id));
  let remaining = requestedQuantity;
  const deductions = [];
  for (const row of eligible) {
    if (!remaining) break;
    const quantity = Math.min(remaining, Number(row.quantity));
    const item = { inventory_id: row.inventory_id, quantity };
    if (row.batch_id !== undefined) item.batch_id = row.batch_id;
    if (row.location_id !== undefined) item.location_id = row.location_id;
    deductions.push(item);
    remaining -= quantity;
  }
  if (remaining) throw new Error('Insufficient eligible stock.');
  return deductions;
}
module.exports = { planBatchDeductions };
