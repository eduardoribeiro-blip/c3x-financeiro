/**
 * Relatório de receita — Janeiro 2026
 * Uso: node relatorio-janeiro.js SEU_TOKEN_NIBO
 * Gera: relatorio-janeiro.csv (abrir no Excel)
 */

const https = require('https');
const fs    = require('fs');

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error('Uso: node relatorio-janeiro.js SEU_TOKEN_NIBO');
  process.exit(1);
}

const NIBO_BASE = 'api.nibo.com.br';
const PAGE = 500;

function niboGet(endpoint, params) {
  const qs = Object.entries({ ...params, apitoken: TOKEN })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const path = `/empresas/v1/${endpoint}?${qs}`;

  return new Promise((resolve, reject) => {
    const req = https.get(
      { host: NIBO_BASE, path, headers: { Accept: 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          if (res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error('Parse error: ' + body.slice(0, 200))); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function niboGetAll(endpoint, params) {
  let allItems = [];
  let skip = 0;
  let page = 1;
  while (true) {
    process.stdout.write(`\r  Buscando página ${page} (${allItems.length} itens)...   `);
    const data = await niboGet(endpoint, { ...params, '$top': PAGE, '$skip': skip });
    const items = data.items || [];
    allItems = allItems.concat(items);
    if (items.length < PAGE) break;
    skip += PAGE;
    page++;
    if (skip > 9500) break;
  }
  console.log(`\r  ${allItems.length} itens recebidos.                    `);
  return allItems;
}

function fmtDate(d) { return d ? d.substring(0, 10) : ''; }
function fmtNum(v)  { return v == null ? '' : Number(v).toFixed(2).replace('.', ','); }

function csvRow(cells) {
  return cells.map(c => {
    const s = String(c == null ? '' : c);
    return s.includes(';') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }).join(';');
}

async function main() {
  console.log('=== Diagnóstico Receita — Janeiro 2026 ===\n');

  const filtro = {
    '$orderby': 'dueDate',
    '$filter':  '(year(dueDate) eq 2026 or year(dueDate) eq 2025 or year(dueDate) eq 2024)'
  };

  console.log('Buscando schedules/credit...');
  const items = await niboGetAll('schedules/credit', filtro);

  const linhas = [];
  const header = [
    'Linha', 'ID', 'Descrição', 'Stakeholder', 'Categoria',
    'isPaid', 'value', 'openValue', 'V_Contado',
    'paymentDate', 'dueDate', 'scheduleDate', 'DataUsada', 'CampoData',
    'Status'
  ];
  linhas.push(csvRow(header));

  let totalContado = 0;
  let countContado = 0;
  let countExcl    = 0;
  let linha = 1;

  for (const item of items) {
    const isPaidTrue = item.isPaid === true;
    const value      = Math.abs(item.value    || 0);
    const openValue  = Math.abs(item.openValue || 0);
    const v = isPaidTrue ? value : value - openValue;

    const datePay = item.paymentDate;
    const dateDue = item.dueDate;
    const dateSch = item.scheduleDate;
    const dateUsed  = datePay || dateDue || dateSch;
    const dateField = datePay ? 'paymentDate' : (dateDue ? 'dueDate' : 'scheduleDate');

    // Mesma lógica do dashboard
    let excl = null;
    let vContado = 0;

    if (v <= 0) {
      excl = v === 0 ? 'v=0' : `v negativo (${v.toFixed(2)})`;
    } else if (!dateUsed) {
      excl = 'sem data';
    } else {
      const dt  = new Date(dateUsed);
      const ano = dt.getFullYear();
      const mes = dt.getMonth(); // 0 = janeiro
      if (ano !== 2026)  excl = `ano=${ano} (≠2026)`;
      else if (mes !== 0) excl = `mes=${mes + 1} (≠jan)`;
    }

    if (!excl) {
      vContado = v;
      totalContado += v;
      countContado++;
    } else {
      countExcl++;
    }

    const cat   = item.categories?.[0]?.categoryName || item.categoryName || '';
    const desc  = item.description || '';
    const stake = item.stakeholder?.name || '';
    const id    = item.scheduleId || item.id || '';

    const statusPag = isPaidTrue ? 'PAGO' : (openValue > 0 && openValue < value) ? 'PARCIAL' : 'NAO_PAGO';

    linhas.push(csvRow([
      linha++,
      id,
      desc,
      stake,
      cat,
      statusPag,
      fmtNum(value),
      fmtNum(openValue),
      excl ? '' : fmtNum(vContado),
      fmtDate(datePay),
      fmtDate(dateDue),
      fmtDate(dateSch),
      fmtDate(dateUsed),
      dateField,
      excl ? `EXCLUIDO: ${excl}` : 'CONTA'
    ]));
  }

  // Linha de total
  linhas.push(csvRow([])); // linha em branco
  linhas.push(csvRow(['', '', '', '', '', '', '', 'TOTAL DASH', fmtNum(totalContado), '', '', '', '', '', '']));
  linhas.push(csvRow(['', '', '', '', '', '', '', 'TOTAL NIBO', '39882,07',           '', '', '', '', '', '']));
  const diff = totalContado - 39882.07;
  linhas.push(csvRow(['', '', '', '', '', '', '', 'DIFERENÇA',  fmtNum(diff),          '', '', '', '', '', '']));
  linhas.push(csvRow([]));
  linhas.push(csvRow(['', '', '', '', '', '', '', 'Itens contados', countContado, '', '', '', '', '', '']));
  linhas.push(csvRow(['', '', '', '', '', '', '', 'Itens excluídos', countExcl,   '', '', '', '', '', '']));
  linhas.push(csvRow(['', '', '', '', '', '', '', 'Total itens API', items.length, '', '', '', '', '', '']));

  // BOM UTF-8 para o Excel reconhecer acentos
  const bom = '﻿';
  const csv = bom + linhas.join('\r\n');

  const outFile = 'relatorio-janeiro.csv';
  fs.writeFileSync(outFile, csv, 'utf8');

  console.log('\n=== RESULTADO ===');
  console.log(`Total no dashboard : R$ ${totalContado.toFixed(2)}`);
  console.log(`Total no Nibo      : R$ 39882.07`);
  console.log(`Diferença          : R$ ${diff.toFixed(2)}`);
  console.log(`Itens contados     : ${countContado}`);
  console.log(`Itens excluídos    : ${countExcl}`);
  console.log(`\nArquivo gerado: ${outFile}`);
}

main().catch(e => { console.error('\nErro:', e.message); process.exit(1); });
