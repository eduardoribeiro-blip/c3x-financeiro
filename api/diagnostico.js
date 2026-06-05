module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const url = `https://api.nibo.com.br/empresas/v1/schedules/debit?apitoken=${token}&$orderby=dueDate&$top=500`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await response.json();

  const cats = {};
  for (const item of (data.items || [])) {
    const dt = (item.dueDate || item.scheduleDate || '');
    const year = dt.substring(0, 4);
    if (year !== '2026') continue;
    const mes = dt.substring(5, 7);
    const catArr = item.categories || [];
    const catName = catArr.length > 0 ? catArr[0].name : (item.categoryName || 'SEM_CATEGORIA');
    const v = Math.abs(item.value || 0);
    if (!cats[catName]) cats[catName] = { total: 0, meses: {} };
    cats[catName].total += v;
    cats[catName].meses[mes] = (cats[catName].meses[mes] || 0) + v;
  }

  // Ordenar por total
  const sorted = Object.entries(cats)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([nome, d]) => ({ nome, total: Math.round(d.total * 100) / 100, meses: d.meses }));

  return res.status(200).json({ totalItens: data.items?.length || 0, categorias: sorted });
};
