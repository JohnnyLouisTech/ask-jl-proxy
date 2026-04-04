/**
 * ============================================================
 * ASK JL — Backend Proxy Server v2
 * Email notifications via Resend.com (works with any email)
 * ============================================================
 */

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const fetch     = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '16kb' }));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === 'development') return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api/', limiter);

/* ── Email via Resend.com ──
   Railway environment variables needed:
     RESEND_API_KEY = re_xxxxxxxxxxxx  (from resend.com)
     NOTIFY_EMAIL   = info@jlsolutionsgroupe.com
*/
async function sendContactNotification(clientName, clientMessage, contactType) {
  const accessKey = process.env.WEB3FORMS_KEY;
  if (!accessKey) {
    console.log('WEB3FORMS_KEY not set — skipping email notification');
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0B2545;padding:24px 28px;border-radius:10px 10px 0 0;">
        <h2 style="color:#C9A84C;margin:0;">ASK JL — New Contact Request</h2>
        <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:13px;">JL Solutions Groupe LLC</p>
      </div>
      <div style="background:#f5f8ff;padding:28px;border-radius:0 0 10px 10px;border:1px solid #dce9f7;">
        <h3 style="color:#0B2545;margin:0 0 20px;">A client wants to reach you!</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #e3f0ff;">
            <td style="padding:10px 0;color:#5478A0;width:150px;font-weight:bold;">Client Name</td>
            <td style="padding:10px 0;color:#0B2545;">${clientName || 'Not provided yet'}</td>
          </tr>
          <tr style="border-bottom:1px solid #e3f0ff;">
            <td style="padding:10px 0;color:#5478A0;font-weight:bold;">Request Type</td>
            <td style="padding:10px 0;color:#0B2545;">${contactType}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;color:#5478A0;font-weight:bold;vertical-align:top;">Message</td>
            <td style="padding:10px 0;color:#0B2545;">${clientMessage}</td>
          </tr>
        </table>
        <div style="background:#fff;padding:18px;border-radius:8px;border:1px solid #dce9f7;margin-top:24px;">
          <p style="margin:0 0 10px;color:#0B2545;font-weight:bold;">Follow up with this client:</p>
          <p style="margin:4px 0;">📞 <a href="tel:8039047260" style="color:#1565C0;">803-904-7260</a></p>
          <p style="margin:4px 0;">📧 <a href="mailto:info@jlsolutionsgroupe.com" style="color:#1565C0;">info@jlsolutionsgroupe.com</a></p>
          <p style="margin:4px 0;">🌐 <a href="https://www.jlsolutionsgroupe.com" style="color:#1565C0;">www.jlsolutionsgroupe.com</a></p>
        </div>
        <p style="color:#aaa;font-size:11px;margin-top:20px;text-align:center;">
          Sent automatically by ASK JL — your AI assistant on jlsolutionsgroupe.com
        </p>
      </div>
    </div>`;

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `ASK JL — Contact Request: ${contactType}`,
        from_name: `ASK JL — ${clientName || 'A visitor'}`,
        message: `Client: ${clientName || 'Not provided'}
Request: ${contactType}
Message: ${clientMessage}

Follow up:
Phone: 803-904-7260
Email: info@jlsolutionsgroupe.com`
      })
    });
    const result = await res.json();
    if (result.success) {
      console.log(`✅ Email notification sent — ${contactType}`);
    } else {
      console.error('❌ Web3Forms error:', result.message);
    }
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
  }
}

/* ── Contact Detection ── */
function detectContactRequest(messages) {
  const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content?.toLowerCase() || '';
  if (['call','phone','reach you','speak with','talk to someone','give me a call'].some(k => lastUserMsg.includes(k))) return 'Phone call request';
  if (['email you','send me an email','write to you','contact by email'].some(k => lastUserMsg.includes(k))) return 'Email contact request';
  if (['book','schedule','appointment','consultation','set up a time','meet with'].some(k => lastUserMsg.includes(k))) return 'Booking / consultation request';
  return null;
}

function extractClientName(messages) {
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const match = m.content.match(/(?:my name is|i'?m|i am|call me|this is)\s+([A-Za-z]+)/i);
    if (match) return match[1];
    const words = m.content.trim().split(/\s+/);
    if (words.length === 1 && /^[A-Za-z]+$/.test(words[0])) return words[0];
  }
  return null;
}

/* ── System Prompt ── */
const SYSTEM = `You are ASK JL, the warm, knowledgeable, and professional virtual assistant for JL Solutions Groupe (www.jlsolutionsgroupe.com).

SERVICES:
1. TAX SERVICES — individual & business tax prep, tax planning, IRS issues, extensions, amendments, back taxes.
2. CREDIT REPAIR — improving credit scores, disputing errors, understanding credit reports, building credit.
3. NOTARY PUBLIC & LOAN SIGNING AGENT — notarizations, mortgage closings, loan signings, apostilles.
4. IMMIGRATION SERVICES — DACA renewals, naturalization, green cards, family petitions, work permits, visas. Note: document prep assistance only, not legal advice.
5. WEB DESIGN — business websites, landing pages, e-commerce, redesigns, maintenance.

RULES:
- Warm, friendly, professional. Use client's first name once known.
- First message: ask their name before anything else.
- Ask clarifying questions. Keep responses to 2-3 short paragraphs.
- End with a follow-up question or next step.
- For pricing: invite them to a free consultation.
- Never make up prices, license numbers, or addresses.

CONTACT — share whenever a client wants to call, email, or book:
- Phone: 803-904-7260
- Email: info@jlsolutionsgroupe.com
- Website: www.jlsolutionsgroupe.com

When a client asks to call, email, or book — share the contact info above and warmly encourage them to reach out.`;

/* ── Health Check ── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ASK JL Proxy', version: '2.0.0' });
});

/* ── Main Chat Endpoint ── */
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'messages array is required.' });

  const sanitized = messages
    .filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (sanitized.length === 0)
    return res.status(400).json({ error: 'No valid messages provided.' });

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM,
        messages: sanitized
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errBody);
      return res.status(502).json({ error: 'Upstream API error. Please try again.' });
    }

    const data  = await apiRes.json();
    const reply = data?.content?.[0]?.text || '';

    const contactType = detectContactRequest(sanitized);
    if (contactType) {
      const clientName  = extractClientName(sanitized);
      const lastUserMsg = sanitized.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
      sendContactNotification(clientName, lastUserMsg, contactType);
    }

    return res.json({ reply });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`✅  ASK JL proxy v2 running on port ${PORT}`);
});
