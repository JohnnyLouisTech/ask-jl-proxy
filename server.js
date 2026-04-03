/**
 * ============================================================
 * ASK JL — Backend Proxy Server
 * ============================================================
 * This server sits between your website and the Anthropic API.
 * Your API key lives ONLY here — never in the browser.
 *
 * STACK: Node.js + Express
 * REQUIREMENTS: Node.js 18+
 *
 * SETUP:
 *   1. npm install
 *   2. Copy .env.example to .env and add your API key
 *   3. node server.js   (or: npm start)
 *
 * DEPLOY OPTIONS:
 *   - Railway.app     (free tier available, easiest)
 *   - Render.com      (free tier available)
 *   - Heroku
 *   - VPS / cPanel Node app
 * ============================================================
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const fetch      = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ──────────────────────────────────────────
   MIDDLEWARE
────────────────────────────────────────── */

// Parse JSON bodies
app.use(express.json({ limit: '16kb' }));

// CORS — only allow your website domain
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (server-to-server, Postman, etc.)
    if (!origin) return callback(null, true);

    // In development, allow everything
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

// Rate limiting — prevents abuse / runaway API costs
const limiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute window
  max:      30,               // max 30 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api/', limiter);

/* ──────────────────────────────────────────
   HEALTH CHECK
────────────────────────────────────────── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ASK JL Proxy', version: '1.0.0' });
});

/* ──────────────────────────────────────────
   MAIN PROXY ENDPOINT
   POST /api/chat
────────────────────────────────────────── */
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  // Basic validation
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  // Sanitize: only forward role + content, strip anything else
  const sanitized = messages
    .filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) })); // cap per-message length

  if (sanitized.length === 0) {
    return res.status(400).json({ error: 'No valid messages provided.' });
  }

  // System prompt (lives on the server — clients never see this)
  const SYSTEM = `You are ASK JL, the warm, knowledgeable, and professional virtual assistant for JL Solutions Groupe (www.jlsolutionsgroupe.com). You represent the company with confidence and care.

SERVICES YOU SUPPORT:
1. TAX SERVICES — individual & business tax preparation, tax planning, IRS correspondence, extensions, amendments, back taxes, maximizing deductions & credits.
2. CREDIT REPAIR — improving credit scores, disputing inaccurate items on credit reports, understanding credit reports (Equifax, TransUnion, Experian), building credit, debt management strategies.
3. NOTARY PUBLIC & LOAN SIGNING AGENT — general notarization, mortgage & refinance closings, loan document signings, apostilles, remote online notarization guidance, what documents require notarization.
4. IMMIGRATION SERVICES — DACA renewals, naturalization (N-400), green card applications (I-485), family petitions (I-130), work permits (EAD), visitor/student visas, TPS, status inquiries. Always note that you provide document preparation assistance and NOT legal advice — recommend consulting a licensed immigration attorney for legal matters.
5. WEB DESIGN — professional business websites, landing pages, e-commerce stores, redesigns, website maintenance, pricing expectations, project timelines, what information clients need to prepare.

YOUR PERSONALITY & RULES:
- You are warm, friendly, and professional. You use the client's first name once you learn it.
- The very first time a client messages, ask their name before anything else.
- Ask clarifying questions to understand their specific situation before recommending solutions.
- Give clear, plain-English explanations — never condescending, never overly technical.
- For tax and immigration questions that require a licensed professional's judgment, say so clearly and offer to schedule a consultation.
- Keep responses concise: 2–3 short paragraphs. Avoid walls of text.
- Always end with either a follow-up question, a clear next step, or an offer to help with something else.
- If asked about pricing, say that pricing depends on the client's specific situation and invite them to book a free consultation.
- You can offer to connect clients with the team by telling them to visit the website.
- Never make up license numbers, addresses, phone numbers, or prices.

CONTACT PROMPT: When appropriate, remind clients they can reach JL Solutions Groupe directly at www.jlsolutionsgroupe.com to book a consultation.`;

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system:     SYSTEM,
        messages:   sanitized
      })
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errBody);
      return res.status(502).json({ error: 'Upstream API error. Please try again.' });
    }

    const data  = await apiRes.json();
    const reply = data?.content?.[0]?.text || '';

    // Return only the reply text — never echo back the full Anthropic response
    return res.json({ reply });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/* ──────────────────────────────────────────
   CATCH-ALL
────────────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

/* ──────────────────────────────────────────
   START
────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`✅  ASK JL proxy running on port ${PORT}`);
  console.log(`    Health: http://localhost:${PORT}/health`);
  console.log(`    Chat:   POST http://localhost:${PORT}/api/chat`);
});
