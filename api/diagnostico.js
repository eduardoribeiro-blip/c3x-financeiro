module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  // Sem filtro de ano — ver estrutura real
  const url = `https://api.nibo.com.br/empresas/v1/schedules/credit?apitoken=${token}&$orderby=dueDate desc&$top=10`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await r.json();

  const amostra = (data.items||[]).slice(0,5).map(i => ({
    dueDate: i.dueDate,
    scheduleDate: i.scheduleDate,
    value: i.value,
    openValue: i.openValue,
    isPaid: i.isPaid,
    isDue: i.isDue,
    isOverdue: i.isOverdue,
    situation: i.situation,
    status: i.status,
    paymentDate: i.paymentDate,
    isFlagged: i.isFlagged,
    isEntry: i.isEntry,
    isBill: i.isBill,
    costCenters: (i.costCenters||[]).map(c=>c.costCenterDescription||c.description||c.name),
    categories: (i.categories||[]).map(c=>c.categoryName||c.name),
    description: (i.description||'').substring(0,50),
  }));

  // Contar situações
  const situacoes = {};
  for (const item of (data.items||[])) {
    const keys = ['isPaid','isDue','isOverdue','situation','status','isFlagged'].map(k=>`${k}:${item[k]}`).join(' | ');
    situacoes[keys] = (situacoes[keys]||0)+1;
  }

  return res.status(200).json({ total: data.items?.length, amostra, situacoes });
};
