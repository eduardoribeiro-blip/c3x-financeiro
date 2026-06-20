module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token obrigatorio' });

  const base = `https://api.nibo.com.br/empresas/v1`;
  const h = { 'Accept': 'application/json' };

  async function nibo(path) {
    const r = await fetch(`${base}${path}&apitoken=${token}`, { headers: h });
    return { status: r.status, data: await r.json() };
  }

  try {
    const results = {};

    // ABORDAGEM A: filtro por dueDate (atual)
    const a = await nibo(`/schedules/credit?$top=500&$filter=isPaid eq true AND year(dueDate) eq 2026 AND month(dueDate) eq 1`);
    results.A_dueDate_jan = {
      status: a.status,
      total: (a.data.items||[]).reduce((s,i) => s + Math.abs(i.value||0), 0).toFixed(2),
      qtd: a.data.items?.length,
    };

    // ABORDAGEM B: filtro por paymentDate (teste — pode não funcionar)
    const b = await nibo(`/schedules/credit?$top=500&$filter=isPaid eq true AND year(paymentDate) eq 2026 AND month(paymentDate) eq 1`);
    results.B_paymentDate_jan = {
      status: b.status,
      total: (b.data.items||[]).reduce((s,i) => s + Math.abs(i.value||0), 0).toFixed(2),
      qtd: b.data.items?.length,
      erro: b.data.message || null,
    };

    // ABORDAGEM C: todos isPaid=true de 2026 sem filtro de mês, agrupados por paymentDate
    const c = await nibo(`/schedules/credit?$top=500&$filter=isPaid eq true AND year(dueDate) eq 2026`);
    const porMes = Array(12).fill(0);
    const porMesPay = Array(12).fill(0);
    for (const item of (c.data.items||[])) {
      const v = Math.abs(item.value||0);
      if (item.dueDate) porMes[new Date(item.dueDate).getMonth()] += v;
      if (item.paymentDate) porMesPay[new Date(item.paymentDate).getMonth()] += v;
    }
    results.C_pago2026 = {
      qtd: c.data.items?.length,
      comPaymentDate: (c.data.items||[]).filter(i=>i.paymentDate).length,
      semPaymentDate: (c.data.items||[]).filter(i=>!i.paymentDate).length,
      totalPorDueDate_jan: porMes[0].toFixed(2),
      totalPorPaymentDate_jan: porMesPay[0].toFixed(2),
    };

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
