module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const url = `https://api.nibo.com.br/empresas/v1/schedules/debit?apitoken=${token}&$orderby=dueDate&$top=500`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await response.json();

  // Inspecionar primeiros 3 itens para entender estrutura
  const amostra = (data.items || []).slice(0, 3).map(i => ({
    dueDate: i.dueDate,
    scheduleDate: i.scheduleDate,
    createDate: i.createDate,
    value: i.value,
    categoryName: i.categoryName,
    categories: i.categories,
    description: i.description?.substring(0, 50),
  }));

  // Categorias sem filtro de ano
  const cats = {};
  for (const item of (data.items || [])) {
    const catArr = item.categories || [];
    const catName = catArr.length > 0 ? catArr[0].name : (item.categoryName || 'SEM_CATEGORIA');
    const v = Math.abs(item.value || 0);
    // Detectar qual campo de data usar
    const dt = item.dueDate || item.scheduleDate || item.createDate || '';
    const year = dt.substring(0, 4);
    if (!cats[catName]) cats[catName] = { total: 0, anos: {} };
    cats[catName].total += v;
    cats[catName].anos[year] = (cats[catName].anos[year] || 0) + v;
  }

  const sorted = Object.entries(cats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([nome, d]) => ({ nome, total: Math.round(d.total), anos: d.anos }));

  return res.status(200).json({ totalItens: data.items?.length, amostra, categorias: sorted });
};
