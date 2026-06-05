module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  // Centros de custo — ver estrutura completa
  const ccUrl = `https://api.nibo.com.br/empresas/v1/costcenters?apitoken=${token}&$top=50`;
  const ccR = await fetch(ccUrl, { headers: { 'Accept': 'application/json' } });
  const ccData = await ccR.json();

  // Mostrar estrutura do primeiro item
  const primeiroItem = (ccData.items||[])[0] || {};
  
  // Buscar despesas por centro de custo para ver quais têm movimento em 2026
  const debitUrl = `https://api.nibo.com.br/empresas/v1/schedules/debit?apitoken=${token}&$top=500&$filter=year(dueDate) eq 2026`;
  const debitR = await fetch(debitUrl, { headers: { 'Accept': 'application/json' } });
  const debitData = await debitR.json();

  // Agrupar por centro de custo
  const ccMovimento = {};
  for (const item of (debitData.items||[])) {
    const ccs = item.costCenters || [];
    for (const cc of ccs) {
      const nome = cc.costCenterDescription || cc.name || cc.costCenterName || JSON.stringify(cc);
      ccMovimento[nome] = (ccMovimento[nome]||0) + Math.abs(item.value||0);
    }
    // Se não tem centro de custo
    if (ccs.length === 0) {
      ccMovimento['SEM_CC'] = (ccMovimento['SEM_CC']||0) + Math.abs(item.value||0);
    }
  }

  return res.status(200).json({
    totalCCs: ccData.count,
    estruturaPrimeiroCC: primeiroItem,
    todosCCs: (ccData.items||[]).slice(0,5),
    movimentoPorCC: ccMovimento,
  });
};
