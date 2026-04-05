module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, business_name, whatsapp, email, trade, plan, message } = req.body || {};

  const planLabel = {
    starter: 'Starter',
    professional: 'Professional',
    premium: 'Premium',
    notsure: 'Not sure yet'
  }[plan] || plan || '—';

  const row = (label, value) => value ? `
    <tr>
      <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;width:140px;">${label}</td>
      <td style="padding:10px 16px;font-size:15px;color:#07274c;font-weight:500;">${value}</td>
    </tr>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Lead</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#07274c;border-radius:12px 12px 0 0;padding:28px 32px;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-.3px;">
                Web<span style="color:#f16517;">For</span>Trades
              </span>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.6);">New lead notification</p>
            </td>
          </tr>

          <!-- Orange accent bar -->
          <tr>
            <td style="background:#f16517;height:4px;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 32px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#07274c;">
                You have a new demo request
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:collapse;">
                ${row('Name', name)}
                ${row('Business', business_name)}
                ${row('WhatsApp', whatsapp)}
                ${row('Email', email)}
                ${row('Trade', trade)}
                ${row('Plan', planLabel)}
              </table>
            </td>
          </tr>

          <!-- Message block (if present) -->
          ${message ? `
          <tr>
            <td style="background:#ffffff;padding:24px 32px 8px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:.05em;">Their message</p>
              <div style="background:#f9f9f9;border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;font-size:15px;color:#07274c;line-height:1.7;white-space:pre-wrap;">${message}</div>
            </td>
          </tr>` : ''}

          <!-- CTA -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${whatsapp ? `<a href="https://wa.me/${whatsapp.replace(/\D/g,'').replace(/^0/,'44')}"
                style="display:inline-block;background:#f16517;color:#ffffff;text-decoration:none;
                       padding:13px 26px;border-radius:8px;font-size:15px;font-weight:700;">
                Reply on WhatsApp
              </a>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a0aec0;">WebForTrades &mdash; vertexwebworks.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer re_NY8eERuH_DTMBXpbkTShzgYia6CSYywzk',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'WebForTrades <leads@vertexwebworks.com>',
        to: ['20iulius.prodan@gmail.com'],
        subject: `New lead: ${name || 'Unknown'} — ${business_name || ''}`.trim().replace(/—\s*$/, ''),
        html
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('Resend error:', txt);
      return res.status(500).json({ error: txt });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
