module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  // Filtrar por dueDate 2026
  const url = `https://api.nibo.com.br/empresas/v1/schedules/debit?apitoken=${token}&$orderby=dueDate&$top=500&$filter=year(dueDate) eq 2026`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await response.json();

  const cats = {};
  for (const item of (data.items || [])) {
    const catArr = item.categories || [];
    // Campo correto é categories[0].categoryName
    const catName = catArr.length > 0 ? catArr[0].categoryName : (item.categoryName || 'SEM_CATEGORIA');
    const v = Math.abs(item.value || 0);
    const mes = (item.dueDate || '').substring(5, 7);
    if (!cats[catName]) cats[catName] = { total: 0, meses: {} };
    cats[catName].total += v;
    cats[catName].meses[mes] = (cats[catName].meses[mes] || 0) + v;
  }

  const sorted = Object.entries(cats)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([nome, d]) => ({ nome, total: Math.round(d.total), meses: d.meses }));

  return res.status(200).json({ totalItens: data.items?.length, categorias: sorted });
};
