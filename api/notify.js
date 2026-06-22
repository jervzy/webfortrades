// api/notify.js - demo request notifier.
// Sends a styled INTERNAL lead email + a styled CUSTOMER confirmation via Resend.
// The Resend API key comes from process.env.RESEND_API_KEY ONLY (never hardcoded).
// Supabase lead capture is handled separately by the front end; email here is best-effort
// and never blocks lead capture. On failure it logs clearly (without printing the key).

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error('[notify] RESEND_API_KEY is not set - cannot send emails.');
    return res.status(500).json({ ok: false, error: 'email_not_configured' });
  }

  const { name, business_name, whatsapp, email, trade, plan, message } = (req.body || {});

  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Area + optional website link are composed into `message` by the form
  // ("Area: <town>\nCurrent site / Google: <url>"). Parse them back out for clean display.
  const area = (((/Area:\s*([^\n]+)/i).exec(message || '')) || [, ''])[1].trim();
  const website = (((/Current site \/ Google:\s*([^\n]+)/i).exec(message || '')) || [, ''])[1].trim();

  const planLabel = {
    'One-off website': 'One-off website',
    'Monthly plan': 'Monthly plan',
    'Not sure yet': 'Not sure yet',
    starter: 'Starter', professional: 'Professional', premium: 'Premium', notsure: 'Not sure yet'
  }[plan] || plan || 'Not specified';

  const waDigits = String(whatsapp || '').replace(/\D/g, '').replace(/^0/, '44');
  const waLink = waDigits ? `https://wa.me/${waDigits}` : '';
  const CUSTOMER_WA = 'https://wa.me/447436427087';

  const SENDER = 'WebForTrades <noreply@webfortradesuk.co.uk>';
  const INTERNAL_TO = 'contact@webfortradesuk.co.uk';
  const validEmail = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));

  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const LOGO = '<span style="font-size:22px;font-weight:800;letter-spacing:-.3px;">'
    + '<span style="color:#ffffff;">Web</span>'
    + '<span style="color:#9fb3c8;font-style:italic;">For</span>'
    + '<span style="color:#f16517;">Trades</span></span>';

  function shell(preheader, bodyInner) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
      + `<body style="margin:0;padding:0;background:#eef2f7;font-family:${FONT};">`
      + `<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>`
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;"><tr><td align="center">'
      + '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">'
      + `<tr><td style="background:#07274c;border-radius:14px 14px 0 0;padding:24px 30px;">${LOGO}</td></tr>`
      + '<tr><td style="background:#f16517;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>'
      + bodyInner
      + '<tr><td style="background:#07274c;border-radius:0 0 14px 14px;padding:18px 30px;text-align:center;">'
      + '<p style="margin:0;font-size:12px;color:rgba(255,255,255,.6);">WebForTrades, websites for UK tradespeople. webfortradesuk.co.uk</p>'
      + '</td></tr></table></td></tr></table></body></html>';
  }

  const CARD_OPEN = '<tr><td style="background:#ffffff;padding:30px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">';
  const CARD_CLOSE = '</td></tr>';
  const row = (label, value) => value ? '<tr>'
    + `<td style="padding:9px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;width:130px;vertical-align:top;">${esc(label)}</td>`
    + `<td style="padding:9px 0;font-size:15px;color:#07274c;font-weight:600;">${esc(value)}</td></tr>` : '';

  // ----- internal lead email -----
  const internalHtml = shell(`New demo request from ${business_name || name || 'a tradesperson'}`,
    CARD_OPEN
    + '<p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#07274c;">New demo request</p>'
    + '<p style="margin:0 0 22px;font-size:15px;color:#64748b;">Someone just requested a free demo through the website.</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f6;">'
    + row('Name', name) + row('Business', business_name) + row('Trade', trade) + row('Area', area)
    + row('Plan', planLabel) + row('WhatsApp', whatsapp) + row('Email', email) + row('Current site', website)
    + '</table>'
    + (waLink ? `<div style="margin-top:24px;"><a href="${waLink}" style="display:inline-block;background:#f16517;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:9px;font-size:15px;font-weight:700;">Message ${esc(name || 'them')} on WhatsApp</a></div>` : '')
    + `<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">Copy details: ${esc(whatsapp || '-')} &nbsp;|&nbsp; ${esc(email || '-')}</p>`
    + CARD_CLOSE);

  const internalText = [
    'New WebForTrades demo request', '',
    `Name: ${name || ''}`, `Business: ${business_name || ''}`, `Trade: ${trade || ''}`,
    `Area: ${area || ''}`, `Plan: ${planLabel}`, `WhatsApp: ${whatsapp || ''}`, `Email: ${email || ''}`,
    website ? `Current site: ${website}` : '', '',
    waLink ? `WhatsApp them: ${waLink}` : ''
  ].filter(Boolean).join('\n');

  // ----- customer confirmation email -----
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'there';
  const customerHtml = shell('We have your demo request - your demo will be ready within 48 hours.',
    CARD_OPEN
    + `<p style="margin:0 0 14px;font-size:22px;font-weight:800;color:#07274c;">Thanks, ${esc(firstName)}. We have your request.</p>`
    + '<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">We will get your demo website ready for you to look over within 48 hours. There is nothing to pay, and nothing for you to do right now.</p>'
    + '<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">We may also message you on WhatsApp about the site, so keep an eye out for a message from WebForTrades.</p>'
    + '<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">What you sent us</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eef2f6;">'
    + row('Business', business_name) + row('Trade', trade) + row('Area', area) + row('Plan', planLabel) + row('WhatsApp', whatsapp)
    + '</table>'
    + `<div style="margin-top:24px;"><a href="${CUSTOMER_WA}" style="display:inline-block;background:#f16517;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:9px;font-size:15px;font-weight:700;">Message us on WhatsApp</a></div>`
    + '<p style="margin:18px 0 0;font-size:14px;color:#64748b;">Prefer to wait? No problem, we will be in touch.</p>'
    + CARD_CLOSE);

  const customerText = [
    `Thanks, ${firstName}. We have your request.`, '',
    'We will get your demo website ready for you to look over within 48 hours. There is nothing to pay, and nothing for you to do right now.', '',
    'We may also message you on WhatsApp about the site, so keep an eye out for a message from WebForTrades.', '',
    'What you sent us:',
    `Business: ${business_name || ''}`, `Trade: ${trade || ''}`, `Area: ${area || ''}`,
    `Plan: ${planLabel}`, `WhatsApp: ${whatsapp || ''}`, '',
    `Message us on WhatsApp: ${CUSTOMER_WA}`
  ].join('\n');

  // ----- send via Resend -----
  async function send(payload) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, id: (data && data.id) || null, error: r.ok ? null : ((data && (data.message || data.name)) || 'unknown') };
    } catch (e) {
      return { ok: false, status: 0, id: null, error: String((e && e.message) || e) };
    }
  }

  const internal = await send({
    from: SENDER,
    to: [INTERNAL_TO],
    ...(validEmail ? { reply_to: [email] } : {}),
    subject: `New WebForTrades demo request: ${business_name || name || 'New lead'}`,
    html: internalHtml,
    text: internalText
  });
  if (!internal.ok) console.error('[notify] internal lead email FAILED:', internal.status, internal.error);

  let customer = { ok: false, status: null, id: null, skipped: true };
  if (validEmail) {
    customer = await send({
      from: SENDER,
      to: [email],
      reply_to: [INTERNAL_TO],
      subject: 'We got your WebForTrades demo request',
      html: customerHtml,
      text: customerText
    });
    customer.skipped = false;
    if (!customer.ok) console.error('[notify] customer confirmation email FAILED:', customer.status, customer.error);
  } else {
    console.warn('[notify] no valid customer email; skipped confirmation email.');
  }

  // 200 when the internal lead email sent (the lead reached us); surface both statuses.
  return res.status(internal.ok ? 200 : 502).json({
    ok: internal.ok,
    internal: { ok: internal.ok, status: internal.status, id: internal.id },
    customer: { ok: customer.ok, status: customer.status, id: customer.id, skipped: !!customer.skipped }
  });
};
