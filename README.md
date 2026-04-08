# ASK JL — AI Chat Agent & Backend Proxy

**ASK JL** is a production-ready AI-powered virtual assistant for [JL Solutions Groupe LLC](https://www.jlsolutionsgroupe.com), built with Node.js, Express, and the Anthropic Claude API.

It handles client inquiries across five service areas — Tax Services, Credit Repair, Notary & Loan Signing, Immigration Services, and Web Design — and sends email notifications when clients request contact.

---

## Architecture

```
Client Browser (jlsolutionsgroupe.com)
        │
        ▼
ask-jl-widget.html   ← Chat UI (hosted on Lovable)
        │
        ▼
server.js (Railway)  ← Secure proxy — API key never exposed
        │
        ▼
Anthropic Claude API ← AI responses
        │
        ▼
Formspree            ← Email notifications to info@jlsolutionsgroupe.com
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend widget | HTML / CSS / JavaScript |
| Backend proxy | Node.js + Express |
| AI model | Claude Sonnet (Anthropic API) |
| Hosting | Railway.app |
| Email notifications | Formspree |
| Domain | GoDaddy |
| Website | Lovable |

---

## Features

- 🤖 AI-powered chat using Claude Sonnet
- 🔒 Secure API proxy — Anthropic key never exposed to browser
- 📬 Email notifications when clients want to call, book, or email
- 🌐 CORS protection — only your domains can use the proxy
- 🚦 Rate limiting — 30 requests/minute per IP
- 📱 Mobile-responsive floating chat widget
- ⚡ Auto-deploys from GitHub via Railway

---

## Environment Variables

Set these in your Railway project → Variables tab.  
**Never commit actual values to GitHub.**

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from console.anthropic.com |
| `ALLOWED_ORIGINS` | Comma-separated allowed domains (e.g. `https://www.jlsolutionsgroupe.com`) |
| `NODE_ENV` | Set to `production` for live, `development` to allow all origins |
| `FORMSPREE_ID` | Your 8-character Formspree form ID (from formspree.io) |
| `NOTIFY_EMAIL` | Email address to receive contact notifications |

---

## Local Development

```bash
# 1. Clone the repo
git clone https://github.com/JohnnyLouisTech/ask-jl-proxy.git
cd ask-jl-proxy

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env and add your actual keys

# 4. Start the server
npm run dev

# 5. Test the health endpoint
curl http://localhost:3000/health
```

---

## API Endpoints

### `GET /health`
Returns server status.
```json
{ "status": "ok", "service": "ASK JL Proxy", "version": "2.0.0" }
```

### `POST /api/chat`
Sends a message to the AI and returns a response.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "Hi, I need help with my credit score." }
  ]
}
```

**Response:**
```json
{
  "reply": "Hello! I'm ASK JL. Before we dive in, may I ask your name?"
}
```

---

## Deployment (Railway)

1. Push code to this GitHub repo
2. Railway auto-detects Node.js and deploys
3. Set all environment variables in Railway → Variables
4. Railway generates a public URL (e.g. `https://ask-jl-proxy-production.up.railway.app`)
5. Update `PROXY_URL` in `ask-jl-widget.html` to point to this URL

---

## Widget Integration

The chat widget (`ask-jl-widget.html`) is hosted separately on Lovable and embedded via a launcher script.

**Embed on any page:**
```html
<script src="/ask-jl-launcher.js"></script>
```

---

## Security Notes

- ✅ API key lives only on the Railway server — never in the browser
- ✅ CORS blocks requests from unauthorized domains
- ✅ Rate limiting prevents abuse
- ✅ Message length capped at 4,000 characters
- ✅ Only `user` and `assistant` roles accepted
- ⚠️ Never commit `.env` to Git
- ⚠️ Never share your `ANTHROPIC_API_KEY` in chat or email

---

## Contact
 
📧 info@jlsolutionsgroupe.com  

---

*Built with ❤️ for JL Solutions Groupe LLC*
