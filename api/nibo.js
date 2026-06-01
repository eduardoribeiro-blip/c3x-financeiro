const https = require('https');
const url = require('url');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, endpoint, ...rest } = req.query;

  if (!token || !endpoint) {
    return res.status(400).json({ error: 'token e endpoint obrigatorios' });
  }

  // Monta query string sem token e endpoint
  const qs = Object.keys(rest)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(rest[k])}`)
    .join('&');

  const niboPath = `/empresas/v1/${endpoint}?apitoken=${token}${qs ? '&' + qs : ''}`;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.nibo.com.br',
      port: 443,
      path: niboPath,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'C3X-Dashboard/1.0'
      }
    };

    const req2 = https.request(options, (response) => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(body);
          res.status(response.statusCode).json(json);
        } catch (e) {
          res.status(500).json({ 
            error: 'Parse error', 
            status: response.statusCode,
            body: body.substring(0, 500) 
          });
        }
        resolve();
      });
    });

    req2.on('error', (e) => {
      res.status(500).json({ error: 'Request failed', detail: e.message, code: e.code });
      resolve();
    });

    req2.setTimeout(10000, () => {
      req2.destroy();
      res.status(504).json({ error: 'Timeout ao conectar com Nibo' });
      resolve();
    });

    req2.end();
  });
};
