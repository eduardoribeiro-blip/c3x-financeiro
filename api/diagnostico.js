module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  try {
    // Busca primeiros 5 transactions de janeiro para inspecionar estrutura completa
    const txUrl = `https://api.nibo.com.br/empresas/v1/transactions?apitoken=${token}&$orderby=date&$top=5&$filter=year(date) eq 2026 AND month(date) eq 1`;
    const txR = await fetch(txUrl, { headers: { 'Accept': 'application/json' } });
    const txData = await txR.json();

    // Retorna amostra bruta + lista de todas as chaves presentes
    const items = txData.items || [];
    const todasChaves = items.length > 0
      ? [...new Set(items.flatMap(i => Object.keys(i)))].sort()
      : [];

    // Resumo por tipo (positivo = entrada, negativo = saída)
    let totalEntradas = 0, totalSaidas = 0;
    for (const item of items) {
      const v = item.amount || 0;
      if (v > 0) totalEntradas += v;
      else totalSaidas += Math.abs(v);
    }

    return res.status(200).json({
      totalItens: txData.items?.length,
      todasChaves,
      amostra: items.map(i => ({
        // Campos de data
        date: i.date,
        dueDate: i.dueDate,
        paymentDate: i.paymentDate,
        competenceDate: i.competenceDate,
        // Valor e tipo
        amount: i.amount,
        value: i.value,
        type: i.type,
        // Categorias e centro de custo
        categories: i.categories,
        categoryName: i.categoryName,
        costCenters: i.costCenters,
        costCenter: i.costCenter,
        // Descrição
        description: i.description,
        memo: i.memo,
        // Outros identificadores
        scheduleId: i.scheduleId,
        transactionId: i.transactionId,
        id: i.id,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
