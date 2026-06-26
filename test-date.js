const chunkDateRange = (start, end, chunkDays = 90) => {
  const chunks = [];
  let cur = new Date(start + 'T00:00:00Z');
  const endDt = new Date(end + 'T00:00:00Z');
  while (cur <= endDt) {
    const chunkEnd = new Date(cur);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
    if (chunkEnd > endDt) chunkEnd.setTime(endDt.getTime());
    chunks.push([cur.toISOString().slice(0, 10), chunkEnd.toISOString().slice(0, 10)]);
    cur = new Date(chunkEnd);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return chunks;
};
console.log(chunkDateRange('2025-06-26', '2026-06-26', 90));
