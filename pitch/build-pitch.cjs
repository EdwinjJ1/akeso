const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const pptxgen = require('pptxgenjs')
const html2pptx = require('./html2pptx.js')

const root = __dirname
const work = path.join(root, 'work')
const out = path.join(root, 'Akeso-ICON-Lyra-Pitch.pptx')
fs.mkdirSync(work, { recursive: true })

const asset = (name) => pathToFileURL(path.join(root, 'assets', name)).href

const C = {
  cream: '#F5F2E8',
  ink: '#1B1D19',
  lime: '#C8F23D',
  green: '#72B56E',
  yellow: '#F6EA7B',
  coral: '#F49C86',
  blue: '#B9D7F2',
  white: '#FFFFFF',
  muted: '#667066',
  border: '#30342E',
}

const common = `
  * { box-sizing: border-box; }
  html { background: ${C.cream}; }
  body { width: 720pt; height: 405pt; margin: 0; padding: 0; display: flex; flex-direction: column; overflow: hidden; background: ${C.cream}; color: ${C.ink}; font-family: Arial, Helvetica, sans-serif; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-family: Impact, Arial, sans-serif; font-size: 38pt; line-height: 0.96; letter-spacing: 0.2pt; font-weight: 900; }
  h2 { font-family: Impact, Arial, sans-serif; font-size: 27pt; line-height: 1; letter-spacing: 0.2pt; font-weight: 900; }
  h3 { font-size: 15pt; line-height: 1.1; font-weight: 800; }
  p { font-size: 13pt; line-height: 1.22; }
  .slide { width: 720pt; height: 405pt; padding: 26pt 30pt 22pt; display: flex; flex-direction: column; position: relative; }
  .kicker { font-size: 8.5pt; font-weight: 800; letter-spacing: 1.4pt; color: ${C.muted}; text-transform: uppercase; margin-bottom: 8pt; }
  .footer { position: absolute; left: 30pt; right: 30pt; bottom: 8pt; display: flex; justify-content: space-between; }
  .footer p { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.8pt; color: ${C.muted}; }
  .card { border: 1.5pt solid ${C.border}; border-radius: 14pt; background: ${C.white}; }
  .pill { border: 1.2pt solid ${C.ink}; border-radius: 999pt; padding: 5pt 10pt; display: flex; align-items: center; justify-content: center; }
  .pill p { font-size: 9pt; font-weight: 800; }
  .small { font-size: 10pt; line-height: 1.25; }
  .micro { font-size: 7.5pt; line-height: 1.2; }
  .muted { color: ${C.muted}; }
  .row { display: flex; flex-direction: row; }
  .col { display: flex; flex-direction: column; }
  img { display: block; }
`

function doc(body, extra = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${common}${extra}</style></head><body>${body}</body></html>`
}

const foot = (n) => `<div class="footer"><p>AKESO · ICON × LYRA HACKATHON 2026</p><p>0${n}</p></div>`

const slides = [
  {
    notes: `Open with the joke, but immediately make the serious point. The internet describes energy as either complete chaos or total calm. We do not claim to measure cortisol. What we care about is the question underneath the meme: why does my energy feel so different from one day to the next?`,
    html: doc(`
      <div class="slide">
        <p class="kicker">THE PROBLEM, IN TWO MEMES</p>
        <h1>YOUR ENERGY IS TRYING<br>TO TELL YOU SOMETHING.</h1>
        <div class="row" style="gap:18pt; margin-top:16pt; align-items:stretch;">
          <div class="card" style="width:321pt; height:221pt; padding:8pt; background:${C.coral};">
            <img src="${asset('meme-high-cortisol.jpg')}" style="width:303pt; height:173pt; object-fit:cover; border-radius:8pt;">
            <p style="font-size:10pt; font-weight:800; margin-top:7pt;">WHEN YOUR BODY FEELS LIKE AN ALARM</p>
          </div>
          <div class="card" style="width:321pt; height:221pt; padding:8pt; background:${C.green};">
            <img src="${asset('meme-low-cortisol.jpg')}" style="width:303pt; height:173pt; object-fit:cover; border-radius:8pt;">
            <p style="font-size:10pt; font-weight:800; margin-top:7pt;">WHEN EVERYTHING FINALLY FEELS EASY</p>
          </div>
        </div>
        <p class="micro muted" style="margin-top:9pt;">The memes are the hook — Akeso does not measure or diagnose cortisol.</p>
        ${foot(1)}
      </div>
    `),
  },
  {
    notes: `Most people know when they feel tired, but they do not know what may be contributing to it. Nutrition, sleep, hydration, stress and mood are not five separate problems. They are connected signals shaping one daily energy state. Existing apps usually track only one category, so the relationship between the signals stays invisible.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">01 · THE REAL PROBLEM</p>
        <div class="row" style="justify-content:space-between; align-items:flex-start;">
          <div class="col" style="width:420pt;">
            <h1>TIRED<br>DOESN’T MEAN<br>LAZY.</h1>
            <p style="font-size:16pt; font-weight:700; line-height:1.25; margin-top:16pt; width:390pt;">People feel the outcome — low energy — but the connected signals behind it stay scattered.</p>
          </div>
          <div style="width:190pt; height:190pt; background:${C.yellow}; border-radius:50%; border:1.5pt solid ${C.ink}; display:flex; align-items:center; justify-content:center;">
            <img src="${asset('mascot-steady.png')}" style="width:164pt; height:164pt; object-fit:contain;">
          </div>
        </div>
        <div class="row" style="gap:12pt; margin-top:18pt;">
          <div class="card" style="width:206pt; padding:13pt; background:${C.white};"><p class="kicker" style="margin-bottom:4pt;">ONE SYSTEM</p><h3>Food · Sleep · Water</h3><p class="small muted" style="margin-top:6pt;">Plus stress and mood context.</p></div>
          <div class="card" style="width:206pt; padding:13pt; background:${C.blue};"><p class="kicker" style="margin-bottom:4pt;">OUTCOME</p><h3>“Why am I so low?”</h3><p class="small muted" style="margin-top:6pt;">The pattern is hard to see.</p></div>
          <div class="card" style="width:206pt; padding:13pt; background:${C.coral};"><p class="kicker" style="margin-bottom:4pt;">CURRENT TOOLS</p><h3>Tasks, not the person</h3><p class="small muted" style="margin-top:6pt;">Every hour looks identical.</p></div>
        </div>
        ${foot(2)}
      </div>
    `),
  },
  {
    notes: `Akeso is a personal energy and nutrition coach in your pocket. Our difference is not five separate trackers. Akeso connects daily signals into one energy picture. Today, the MVP provides connected check-ins, explainable energy context and nutrition guidance. A dedicated emotion coach is explicitly part of our next stage, not a feature we are claiming today.`,
    html: doc(`
      <div class="slide" style="background:${C.ink}; color:${C.cream};">
        <p class="kicker" style="color:${C.lime};">02 · OUR SOLUTION</p>
        <div class="row" style="gap:28pt; flex:1; align-items:center;">
          <div class="col" style="width:405pt;">
            <h1 style="font-size:43pt;">A PERSONAL<br>ENERGY + NUTRITION<br>COACH.</h1>
            <p style="font-size:16pt; line-height:1.25; margin-top:18pt; color:#DDE1D8;">Understand what may be shaping your energy — then turn that insight into food and routine choices you can actually follow.</p>
            <div class="row" style="gap:8pt; margin-top:20pt; flex-wrap:wrap;">
              <div class="pill" style="background:${C.lime}; color:${C.ink};"><p>NOW · CONNECTED SIGNALS</p></div>
              <div class="pill" style="background:${C.yellow}; color:${C.ink};"><p>NOW · NUTRITION GUIDANCE</p></div>
              <div class="pill" style="background:${C.blue}; color:${C.ink}; margin-top:7pt;"><p>NEXT · EMOTION COACH</p></div>
            </div>
          </div>
          <div class="card" style="width:198pt; height:300pt; padding:8pt; background:${C.green}; border:4pt solid ${C.lime};">
            <img src="${asset('akeso-today.jpg')}" style="width:180pt; height:282pt; object-fit:cover; object-position:top; border-radius:8pt;">
          </div>
        </div>
        <div class="footer"><p style="color:#AEB5AA;">AKESO · ICON × LYRA HACKATHON 2026</p><p style="color:#AEB5AA;">03</p></div>
      </div>
    `),
  },
  {
    notes: `The experience is deliberately lightweight. First, the user checks in on energy, sleep, food and hydration, with stress and mood recorded as contextual signals where available. Second, Akeso connects those inputs into an explainable energy picture. Third, it recommends meals from the user's own fridge. Planning is useful, but it is only one small output of the larger energy and nutrition system.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">03 · HOW IT WORKS</p>
        <h1>20 SECONDS IN.<br>A CLEARER DAY OUT.</h1>
        <div class="row" style="gap:16pt; margin-top:10pt; align-items:flex-start;">
          <div class="col" style="width:205pt; align-items:center;">
            <div class="card" style="width:136pt; height:196pt; padding:5pt; background:${C.yellow};"><img src="${asset('akeso-checkin.jpg')}" style="width:124pt; height:183pt; object-fit:cover; object-position:top; border-radius:7pt;"></div>
            <div class="pill" style="background:${C.yellow}; margin-top:7pt;"><p>1 · CHECK IN</p></div>
            <p class="small muted" style="text-align:center; margin-top:5pt;">Daily signals, one place</p>
          </div>
          <div class="col" style="width:205pt; align-items:center;">
            <div class="card" style="width:136pt; height:196pt; padding:5pt; background:${C.green};"><img src="${asset('akeso-today.jpg')}" style="width:124pt; height:183pt; object-fit:cover; object-position:top; border-radius:7pt;"></div>
            <div class="pill" style="background:${C.green}; margin-top:7pt;"><p>2 · CONNECT</p></div>
            <p class="small muted" style="text-align:center; margin-top:5pt;">One explainable energy picture</p>
          </div>
          <div class="col" style="width:205pt; align-items:center;">
            <div class="card" style="width:136pt; height:196pt; padding:5pt; background:${C.blue};"><img src="${asset('akeso-nutrition.jpg')}" style="width:124pt; height:183pt; object-fit:cover; object-position:top; border-radius:7pt;"></div>
            <div class="pill" style="background:${C.blue}; margin-top:7pt;"><p>3 · TAKE ACTION</p></div>
            <p class="small muted" style="text-align:center; margin-top:5pt;">Meals from what you have</p>
          </div>
        </div>
        ${foot(4)}
      </div>
    `),
  },
  {
    notes: `Here is the important distinction. Akeso does not diagnose iron deficiency from a meal log. Instead, it can notice that someone repeatedly records meals with very few iron-rich foods. It can explain that pattern, suggest practical options such as spinach, eggs or salmon already in the fridge, and recommend professional advice if symptoms persist. Useful guidance without pretending to be a doctor.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">04 · PERSONALISED, NOT MEDICALISED</p>
        <h1>NOT A DIAGNOSIS.<br>A USEFUL PATTERN.</h1>
        <div class="row" style="gap:18pt; margin-top:18pt; flex:1;">
          <div class="card" style="width:236pt; height:260pt; padding:7pt; background:${C.green};"><img src="${asset('akeso-nutrition.jpg')}" style="width:220pt; height:244pt; object-fit:cover; object-position:top; border-radius:8pt;"></div>
          <div class="col" style="width:385pt; gap:9pt;">
            <div class="card row" style="padding:12pt; background:${C.white}; align-items:center; gap:12pt;"><div style="width:31pt; height:31pt; border-radius:50%; background:${C.coral}; display:flex; align-items:center; justify-content:center;"><p style="font-weight:900;">1</p></div><div><h3>Repeated food pattern</h3><p class="small muted">Very few iron-rich foods logged across several days.</p></div></div>
            <div class="card row" style="padding:12pt; background:${C.yellow}; align-items:center; gap:12pt;"><div style="width:31pt; height:31pt; border-radius:50%; background:${C.lime}; display:flex; align-items:center; justify-content:center;"><p style="font-weight:900;">2</p></div><div><h3>Explain, without diagnosing</h3><p class="small muted">“This pattern may be worth addressing.”</p></div></div>
            <div class="card row" style="padding:12pt; background:${C.blue}; align-items:center; gap:12pt;"><div style="width:31pt; height:31pt; border-radius:50%; background:${C.green}; display:flex; align-items:center; justify-content:center;"><p style="font-weight:900;">3</p></div><div><h3>One realistic next action</h3><p class="small muted">Spinach, eggs or salmon — using what is already nearby.</p></div></div>
            <p class="micro muted" style="margin-top:3pt;">Persistent dizziness or fatigue should be discussed with a qualified health professional.</p>
          </div>
        </div>
        ${foot(5)}
      </div>
    `),
  },
  {
    notes: `The hackathon asks us to demonstrate time saved. In our demo workflow, manually checking a calendar, ranking tasks, deciding what to eat and building a plan took around twelve minutes. Akeso produces the first useful recommendation after a short check-in. We will replace these sample values with the final measured trial before submission.`,
    html: doc(`
      <div class="slide" style="background:${C.yellow};">
        <p class="kicker">05 · MEASURABLE TIME SAVED</p>
        <h1>FROM SCATTERED DECISIONS<br>TO ONE GUIDED ROUTINE.</h1>
        <div class="row" style="gap:18pt; margin-top:16pt; align-items:stretch;">
          <div class="card col" style="width:305pt; height:165pt; padding:15pt 18pt; background:${C.white}; justify-content:space-between;">
            <div><p class="kicker">BEFORE · MANUAL</p><h2 style="font-size:49pt;">12:00</h2></div>
            <p class="small muted">Calendar + task triage + meal decision + time blocking</p>
          </div>
          <div class="card col" style="width:305pt; height:165pt; padding:15pt 18pt; background:${C.ink}; color:${C.cream}; justify-content:space-between; border:4pt solid ${C.lime};">
            <div><p class="kicker" style="color:${C.lime};">WITH AKESO</p><h2 style="font-size:49pt; color:${C.lime};">0:25</h2></div>
            <p class="small" style="color:#DDE1D8;">One check-in → energy insight → meal + routine suggestion</p>
          </div>
        </div>
        <div class="pill" style="background:${C.green}; width:365pt; margin-top:12pt;"><p style="font-size:13pt;">≈ 11 MINUTES SAVED PER DAY</p></div>
        <p class="micro muted" style="margin-top:5pt;">Sample demo values — replace with the final measured median before presenting.</p>
        ${foot(6)}
      </div>
    `),
  },
  {
    notes: `We designed Akeso to be explainable and safe. The app is built with Expo, an Express API and Supabase. Deterministic TypeScript services calculate the energy result and recommendations. AI explains validated outputs rather than inventing the score. Our hardest challenge was turning noisy lifestyle signals into something useful without making medical claims, so we separate reported energy, possible context and professional escalation.`,
    html: doc(`
      <div class="slide" style="background:${C.ink}; color:${C.cream};">
        <p class="kicker" style="color:${C.lime};">06 · TECHNICAL EXECUTION</p>
        <h1>BUILT TO EXPLAIN.<br>NOT TO PRETEND.</h1>
        <div class="row" style="gap:12pt; margin-top:20pt; align-items:center;">
          <div class="card" style="width:140pt; padding:16pt; background:${C.green}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">CLIENT</p><h3>Expo App</h3><p class="small" style="margin-top:7pt;">Fast daily interaction</p></div>
          <div style="width:24pt;"><p style="font-size:24pt; color:${C.lime}; text-align:center;">→</p></div>
          <div class="card" style="width:140pt; padding:16pt; background:${C.yellow}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">API</p><h3>Express</h3><p class="small" style="margin-top:7pt;">Validated contracts</p></div>
          <div style="width:24pt;"><p style="font-size:24pt; color:${C.lime}; text-align:center;">→</p></div>
          <div class="card" style="width:140pt; padding:16pt; background:${C.blue}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">DATA</p><h3>Supabase</h3><p class="small" style="margin-top:7pt;">Longitudinal patterns</p></div>
          <div style="width:24pt;"><p style="font-size:24pt; color:${C.lime}; text-align:center;">→</p></div>
          <div class="card" style="width:140pt; padding:16pt; background:${C.coral}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">GUIDANCE</p><h3>Validated AI</h3><p class="small" style="margin-top:7pt;">Explains, not scores</p></div>
        </div>
        <div class="row" style="gap:12pt; margin-top:18pt;">
          <div class="pill" style="background:${C.lime}; color:${C.ink};"><p>DETERMINISTIC ENGINE</p></div>
          <div class="pill" style="background:${C.white}; color:${C.ink};"><p>SCHEMA-VALIDATED OUTPUT</p></div>
          <div class="pill" style="background:${C.green}; color:${C.ink};"><p>NOT A MEDICAL DEVICE</p></div>
        </div>
        <div class="card" style="margin-top:17pt; padding:12pt 15pt; background:#30342E; border-color:#596057; box-shadow:none; color:${C.cream};"><p class="small"><b>Core challenge:</b> turning noisy lifestyle signals into useful guidance without overstating certainty.</p></div>
        <div class="footer"><p style="color:#AEB5AA;">AKESO · ICON × LYRA HACKATHON 2026</p><p style="color:#AEB5AA;">07</p></div>
      </div>
    `),
  },
  {
    notes: `Akeso's long-term vision is to understand energy over weeks, not just one day. The current product connects daily energy and nutrition signals. Next, we want a dedicated emotion coach, faster food logging through photos, wearable integrations, stronger longitudinal pattern detection, and guidance reviewed with nutrition professionals. Our goal is simple: help people understand their energy and feed it better.`,
    html: doc(`
      <div class="slide" style="background:${C.green};">
        <p class="kicker">07 · WHAT’S NEXT</p>
        <div class="row" style="flex:1; align-items:center; gap:34pt;">
          <div class="col" style="width:445pt;">
            <h1 style="font-size:48pt;">UNDERSTAND<br>YOUR ENERGY.<br>FEED IT BETTER.</h1>
            <p style="font-size:15pt; font-weight:700; margin-top:18pt; width:410pt;">A more accessible path to personalised energy and nutrition guidance.</p>
            <div class="row" style="gap:8pt; flex-wrap:wrap; margin-top:20pt;">
              <div class="pill" style="background:${C.coral};"><p>NEXT · EMOTION COACH</p></div>
              <div class="pill" style="background:${C.white};"><p>PHOTO FOOD LOGGING</p></div>
              <div class="pill" style="background:${C.yellow};"><p>WEEKLY PATTERNS</p></div>
              <div class="pill" style="background:${C.blue};"><p>WEARABLES</p></div>
              <div class="pill" style="background:${C.lime};"><p>EXPERT-REVIEWED GUIDANCE</p></div>
            </div>
            <p style="font-size:11pt; font-weight:800; margin-top:22pt;">github.com/EdwinjJ1/akeso</p>
          </div>
          <div style="width:190pt; height:245pt; background:${C.ink}; border-radius:30pt; border:1.5pt solid ${C.ink}; display:flex; align-items:flex-end; justify-content:center; overflow:hidden;">
            <img src="${asset('mascot-celebrate.png')}" style="width:210pt; height:210pt; object-fit:contain;">
          </div>
        </div>
        <div class="footer"><p style="color:${C.ink};">AKESO · LESS GRIND. BETTER TIMING.</p><p style="color:${C.ink};">08</p></div>
      </div>
    `),
  },
]

async function main() {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Akeso Team'
  pptx.company = 'ICON UNSW × Lyra Hackathon 2026'
  pptx.subject = 'Akeso personal energy and nutrition coach pitch'
  pptx.title = 'Akeso — Understand Your Energy. Feed It Better.'
  pptx.lang = 'en-AU'
  pptx.theme = {
    headFontFace: 'Impact',
    bodyFontFace: 'Arial',
    lang: 'en-AU',
  }

  for (let i = 0; i < slides.length; i += 1) {
    const html = path.join(work, `slide-${i + 1}.html`)
    fs.writeFileSync(html, slides[i].html)
    const { slide } = await html2pptx(html, pptx, { tmpDir: work })
    slide.addNotes(slides[i].notes)
  }

  await pptx.writeFile({ fileName: out, compression: true })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
