const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const pptxgen = require('pptxgenjs')
const html2pptx = require('./html2pptx.js')

const pitchRoot = __dirname
const work = path.join(__dirname, 'work')
const out = path.join(pitchRoot, 'Akeso-ICON-Lyra-Pitch-Revised.pptx')
fs.mkdirSync(work, { recursive: true })

const asset = (name) => pathToFileURL(path.join(pitchRoot, 'assets', name)).href
const rootAsset = (name) => pathToFileURL(path.join(pitchRoot, name)).href
const workAsset = (name) => pathToFileURL(path.join(work, name)).href

// html2pptx ignores object-fit and stretches images to their boxes, so
// pre-crop every image to its exact display aspect ratio with sharp.
const sharp = require('sharp')
async function cropToRatio(src, destName, boxW, boxH, anchor = 'top') {
  const img = sharp(src)
  const m = await img.metadata()
  const ratio = boxW / boxH
  let w = m.width
  let h = Math.round(m.width / ratio)
  let left = 0
  let top = 0
  if (h > m.height) {
    h = m.height
    w = Math.round(m.height * ratio)
    left = Math.round((m.width - w) / 2)
  } else if (anchor === 'center') {
    top = Math.round((m.height - h) / 2)
  }
  await img.extract({ left, top, width: w, height: h }).toFile(path.join(work, destName))
}

const inAssets = (name) => path.join(pitchRoot, 'assets', name)
async function prepareImages() {
  await cropToRatio(inAssets('meme-high-cortisol.jpg'), 'meme-high.jpg', 303, 170, 'center')
  await cropToRatio(inAssets('meme-low-cortisol.jpg'), 'meme-low.jpg', 303, 170, 'center')
}

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
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 36pt; line-height: 1.04; letter-spacing: 0.3pt; font-weight: 700; }
  h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 27pt; line-height: 1; letter-spacing: 0.2pt; font-weight: 700; }
  h3 { font-size: 15pt; line-height: 1.1; font-weight: 800; }
  p { font-size: 13pt; line-height: 1.22; }
  .slide { width: 720pt; height: 405pt; padding: 26pt 30pt 22pt; display: flex; flex-direction: column; position: relative; }
  .kicker { font-size: 8.5pt; font-weight: 800; letter-spacing: 1.4pt; color: ${C.muted}; text-transform: uppercase; margin-bottom: 8pt; }
  .footer { position: absolute; left: 30pt; right: 30pt; bottom: 8pt; display: flex; justify-content: space-between; }
  .footer p { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.8pt; color: ${C.muted}; }
  .card { border: 1.5pt solid ${C.border}; border-radius: 14pt; background: ${C.white}; }
  .pill { border: 1.2pt solid ${C.ink}; border-radius: 999pt; padding: 5pt 10pt; display: flex; align-items: center; justify-content: center; }
  .pill p { font-size: 9pt; font-weight: 800; white-space: nowrap; }
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

const foot = (n, dark = false, tagline = false) => {
  const color = dark ? '#AEB5AA' : C.muted
  const left = tagline ? 'AKESO · LESS GRIND. BETTER TIMING.' : 'AKESO · ICON × LYRA HACKATHON 2026'
  const num = n < 10 ? `0${n}` : `${n}`
  return `<div class="footer"><p style="color:${color};">${left}</p><p style="color:${color};">${num}</p></div>`
}

const slides = [
  {
    // 00 · Title
    notes: `Talk track: I believe most teams here have built an app, a website, or a tool to help people save time. Akeso does that too. But our bigger goal is to give people back time they already have, yet cannot use. A free hour is not useful if you have no energy, focus, or emotional capacity to act. Akeso is an explainable energy and nutrition coach that turns plans into action.\n\n[Sources]\n- Internal project overview: README.md\n- Product screenshots and mascot inherited from the team-provided source deck.`,
    html: doc(`
      <div class="slide" style="background:${C.green};">
        <p class="kicker" style="color:${C.ink}; opacity:0.65;">AKESO · ICON × LYRA 2026</p>
        <div class="row" style="flex:1; align-items:center; gap:34pt;">
          <div class="col" style="width:445pt;">
            <h1 style="font-size:46pt;">RECLAIM<br>YOUR USABLE<br>TIME.</h1>
            <p style="font-size:15.5pt; font-weight:700; margin-top:16pt; width:410pt;">An explainable energy + nutrition coach that turns plans into action.</p>
            <div class="row" style="gap:8pt; flex-wrap:wrap; margin-top:18pt;">
              <div class="pill" style="background:${C.coral};"><p>ENERGY</p></div>
              <div class="pill" style="background:${C.white};"><p>NUTRITION</p></div>
              <div class="pill" style="background:${C.yellow};"><p>PLANNING</p></div>
              <div class="pill" style="background:${C.blue};"><p>EXPLAINED</p></div>
              <div class="pill" style="background:${C.lime};"><p>BUILT FOR STUDENTS</p></div>
            </div>
            <p style="font-size:11pt; font-weight:800; margin-top:20pt;">github.com/EdwinjJ1/akeso</p>
          </div>
          <div style="width:190pt; height:245pt; background:${C.ink}; border-radius:30pt; border:1.5pt solid ${C.ink}; display:flex; align-items:flex-end; justify-content:center; overflow:hidden;">
            <img src="${asset('mascot-celebrate.png')}" style="width:210pt; height:210pt; object-fit:contain;">
          </div>
        </div>
        <div class="footer"><p style="color:${C.ink};">AKESO · LESS GRIND. BETTER TIMING.</p><p style="color:${C.ink};">00</p></div>
      </div>
    `),
  },
  {
    // 01 · Memes
    notes: `Talk track: These memes exaggerate two extremes: your body feels like an alarm, or suddenly everything feels easy. We are not claiming to measure cortisol. The serious question underneath the joke is this: why can the same person have a plan on both days, but only have the energy to execute it on one of them?\n\n[Sources]\n- Meme images inherited from the team-provided source deck; original public URLs were not recorded.\n- Medical boundary: README.md and docs/API_CONTRACT.md.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">THE PROBLEM, IN TWO MEMES</p>
        <h1>YOUR ENERGY IS TRYING<br>TO TELL YOU SOMETHING.</h1>
        <div class="row" style="gap:18pt; margin-top:14pt; align-items:stretch;">
          <div class="card" style="width:321pt; height:218pt; padding:8pt; background:${C.coral};">
            <img src="${workAsset('meme-high.jpg')}" style="width:303pt; height:170pt; object-fit:cover; border-radius:8pt;">
            <p style="font-size:10pt; font-weight:800; margin-top:7pt;">WHEN YOUR BODY FEELS LIKE AN ALARM</p>
          </div>
          <div class="card" style="width:321pt; height:218pt; padding:8pt; background:${C.green};">
            <img src="${workAsset('meme-low.jpg')}" style="width:303pt; height:170pt; object-fit:cover; border-radius:8pt;">
            <p style="font-size:10pt; font-weight:800; margin-top:7pt;">WHEN EVERYTHING FINALLY FEELS EASY</p>
          </div>
        </div>
        <p class="micro muted" style="margin-top:8pt;">The memes are the hook — Akeso does not measure or diagnose cortisol.</p>
        ${foot(1)}
      </div>
    `),
  },
  {
    // 02 · Execution gap
    notes: `Talk track: Most people do not have a planning problem. They already know what they want to do. The hard part is execution. Imagine a student with five hours blocked out for work. Those five hours exist on the calendar. But after five hours of sleep, poor nutrition, dehydration, or a stressful morning, how many of those hours are genuinely usable? We cannot add hours to the clock. We can work on the gap between time available and capacity to act.\n\n[Sources]\n- Illustrative scenario; no measured productivity outcome is claimed.\n- Product framing: README.md and docs/superpowers/specs/2026-07-22-demo-video-script-design.md.`,
    html: doc(`
      <div class="slide" style="background:${C.yellow};">
        <p class="kicker">THE EXECUTION GAP</p>
        <h1>TIME AVAILABLE<br>ISN’T ALWAYS TIME USABLE.</h1>
        <div class="row" style="gap:18pt; margin-top:14pt; align-items:stretch;">
          <div class="card col" style="width:305pt; height:160pt; padding:15pt 18pt; background:${C.white}; justify-content:space-between;">
            <div><p class="kicker">PLANNED</p><h2 style="font-size:46pt;">5:00</h2></div>
            <p class="small muted">The plan exists. The hours are on the calendar.</p>
          </div>
          <div class="card col" style="width:305pt; height:160pt; padding:15pt 18pt; background:${C.ink}; color:${C.cream}; justify-content:space-between; border:4pt solid ${C.lime};">
            <div><p class="kicker" style="color:${C.lime};">READY TO ACT</p><h2 style="font-size:46pt; color:${C.lime};">?</h2></div>
            <p class="small" style="color:#DDE1D8;">Sleep + food + hydration + stress + mood shape what is usable.</p>
          </div>
        </div>
        <div class="pill" style="background:${C.green}; width:365pt; margin-top:12pt;"><p style="font-size:13pt;">AKESO WORKS ON THIS GAP</p></div>
        <p class="micro muted" style="margin-top:5pt;">Turn invisible blockers into one explainable next action.</p>
        ${foot(2)}
      </div>
    `),
  },
  {
    // 03 · Tired doesn't mean lazy
    notes: `Talk track: That is why tired does not mean lazy. Low energy is the visible outcome, but the signals around it are scattered. Food, sleep, hydration, stress, and mood can all shape the day someone experiences. Most productivity tools only see the task, so they treat every hour as identical. Akeso starts with the person who has to perform the task.\n\n[Sources]\n- Product framing: README.md.\n- Current and planned signal boundaries: docs/API_CONTRACT.md and docs/superpowers/specs/2026-07-22-demo-video-script-design.md.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">01 · THE REAL PROBLEM</p>
        <div class="row" style="justify-content:space-between; align-items:flex-start;">
          <div class="col" style="width:430pt;">
            <h1>TIRED<br>DOESN’T MEAN<br>LAZY.</h1>
            <p style="font-size:15.5pt; font-weight:700; line-height:1.25; margin-top:14pt; width:400pt;">People feel the outcome — low energy — but the connected signals behind it stay scattered.</p>
          </div>
          <div style="width:182pt; height:182pt; background:${C.yellow}; border-radius:50%; border:1.5pt solid ${C.ink}; display:flex; align-items:center; justify-content:center;">
            <img src="${asset('mascot-steady.png')}" style="width:156pt; height:156pt; object-fit:contain;">
          </div>
        </div>
        <div class="row" style="gap:12pt; margin-top:16pt;">
          <div class="card" style="width:206pt; padding:13pt; background:${C.white};"><p class="kicker" style="margin-bottom:4pt;">ONE SYSTEM</p><h3>Food · Sleep · Water</h3><p class="small muted" style="margin-top:6pt;">Plus stress and mood context.</p></div>
          <div class="card" style="width:206pt; padding:13pt; background:${C.blue};"><p class="kicker" style="margin-bottom:4pt;">OUTCOME</p><h3>“Why am I so low?”</h3><p class="small muted" style="margin-top:6pt;">The pattern is hard to see.</p></div>
          <div class="card" style="width:206pt; padding:13pt; background:${C.coral};"><p class="kicker" style="margin-bottom:4pt;">CURRENT TOOLS</p><h3>Tasks, not the person</h3><p class="small muted" style="margin-top:6pt;">Every hour looks identical.</p></div>
        </div>
        ${foot(3)}
      </div>
    `),
  },
  {
    // 04 · Solution
    notes: `Talk track: Our solution is a personal energy and nutrition coach. In the MVP, Akeso connects a short daily check-in with an explainable energy picture, an energy-aware plan, and food guidance grounded in what the user actually has. It does not ask people to push harder. It helps them choose work, meals, and recovery that fit the day they actually have.\n\n[Sources]\n- Current product flow: README.md.\n- Energy, plan, and nutrition contracts: docs/API_CONTRACT.md.`,
    html: doc(`
      <div class="slide" style="background:${C.ink}; color:${C.cream};">
        <p class="kicker" style="color:${C.lime};">02 · OUR SOLUTION</p>
        <div class="row" style="gap:28pt; flex:1; align-items:center; justify-content:space-between; padding-right:24pt;">
          <div class="col" style="width:405pt;">
            <h1 style="font-size:31pt;">A PERSONAL<br>ENERGY + NUTRITION<br>COACH.</h1>
            <p style="font-size:15.5pt; line-height:1.25; margin-top:16pt; color:#DDE1D8;">Understand what may be shaping your energy — then turn that insight into food and routine choices you can actually follow.</p>
            <div class="row" style="gap:8pt; margin-top:18pt; flex-wrap:wrap;">
              <div class="pill" style="background:${C.lime}; color:${C.ink};"><p>NOW · CONNECTED SIGNALS</p></div>
              <div class="pill" style="background:${C.yellow}; color:${C.ink};"><p>NOW · NUTRITION GUIDANCE</p></div>
              <div class="pill" style="background:${C.blue}; color:${C.ink}; margin-top:7pt;"><p>NEXT · EMOTION COACH</p></div>
            </div>
          </div>
          <div class="card" style="width:146pt; height:298pt; padding:8pt; background:${C.green}; border:4pt solid ${C.lime};">
            <img src="${asset('akeso-today.jpg')}" style="width:130pt; height:281pt; border-radius:8pt;">
          </div>
        </div>
        ${foot(4, true)}
      </div>
    `),
  },
  {
    // 05 · How it works
    notes: `Talk track: The experience has three steps. First, the user checks in with a few signals. Second, they calibrate the result. This is not a mysterious black-box score: the user’s reported energy anchors the deterministic score. If the result does not reflect how they feel, they update the check-in and Akeso recalculates it. Third, Akeso turns that state into a realistic next action—such as moving demanding work to a stronger window, or suggesting a meal from ingredients already available.\n\n[Sources]\n- Scoring definition and user-reported energy mapping: docs/API_CONTRACT.md.\n- Rolling check-in recalculation flow: docs/superpowers/specs/2026-07-21-rolling-checkin-design.md.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">03 · HOW IT WORKS</p>
        <h1>20 SECONDS IN.<br>A CLEARER DAY OUT.</h1>
        <div class="row" style="gap:16pt; margin-top:10pt; align-items:flex-start;">
          <div class="col" style="width:205pt; align-items:center;">
            <div class="card" style="width:92pt; height:190pt; padding:5pt; background:${C.yellow};"><img src="${asset('akeso-checkin.jpg')}" style="width:82pt; height:178pt; border-radius:7pt;"></div>
            <div class="pill" style="background:${C.yellow}; margin-top:7pt;"><p>1 · CHECK IN</p></div>
            <p class="small muted" style="text-align:center; margin-top:5pt;">Daily signals, one place</p>
          </div>
          <div class="col" style="width:205pt; align-items:center;">
            <div class="card" style="width:92pt; height:190pt; padding:5pt; background:${C.green};"><img src="${asset('akeso-today.jpg')}" style="width:82pt; height:178pt; border-radius:7pt;"></div>
            <div class="pill" style="background:${C.green}; margin-top:7pt;"><p>2 · ADJUST</p></div>
            <p class="small muted" style="text-align:center; margin-top:5pt;">Your report anchors the score</p>
          </div>
          <div class="col" style="width:205pt; align-items:center;">
            <div class="card" style="width:92pt; height:190pt; padding:5pt; background:${C.blue};"><img src="${asset('akeso-nutrition.jpg')}" style="width:82pt; height:178pt; border-radius:7pt;"></div>
            <div class="pill" style="background:${C.blue}; margin-top:7pt;"><p>3 · TAKE ACTION</p></div>
            <p class="small muted" style="text-align:center; margin-top:5pt;">Meals + routines for today</p>
          </div>
        </div>
        ${foot(5)}
      </div>
    `),
  },
  {
    // 06 · Not a diagnosis
    notes: `Talk track: Personalised does not mean medicalised. Akeso does not diagnose iron deficiency from a meal log. It can identify a repeated pattern, explain it cautiously, suggest one realistic food option, and recommend professional advice when symptoms persist. The goal is useful guidance without pretending to be a doctor.\n\n[Sources]\n- Safety and dietary-guidance rules: docs/API_CONTRACT.md.\n- Product boundary: README.md.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">04 · PERSONALISED, NOT MEDICALISED</p>
        <h1>NOT A DIAGNOSIS.<br>USEFUL SIGNAL.</h1>
        <div class="row" style="gap:18pt; margin-top:14pt;">
          <div class="card" style="width:122pt; height:246pt; padding:7pt; background:${C.green};"><img src="${asset('akeso-nutrition.jpg')}" style="width:106pt; height:230pt; border-radius:8pt;"></div>
          <div class="col" style="width:490pt; gap:9pt;">
            <div class="card row" style="padding:12pt; background:${C.white}; align-items:center; gap:12pt;"><div style="width:31pt; height:31pt; border-radius:50%; background:${C.coral}; display:flex; align-items:center; justify-content:center; flex:0 0 31pt;"><p style="font-weight:900;">1</p></div><div><h3>Repeated food pattern</h3><p class="small muted">Very few iron-rich foods logged across several days.</p></div></div>
            <div class="card row" style="padding:12pt; background:${C.yellow}; align-items:center; gap:12pt;"><div style="width:31pt; height:31pt; border-radius:50%; background:${C.lime}; display:flex; align-items:center; justify-content:center; flex:0 0 31pt;"><p style="font-weight:900;">2</p></div><div><h3>Explain, without diagnosing</h3><p class="small muted">“This pattern may be worth addressing.”</p></div></div>
            <div class="card row" style="padding:12pt; background:${C.blue}; align-items:center; gap:12pt;"><div style="width:31pt; height:31pt; border-radius:50%; background:${C.green}; display:flex; align-items:center; justify-content:center; flex:0 0 31pt;"><p style="font-weight:900;">3</p></div><div><h3>One realistic next action</h3><p class="small muted">Spinach, eggs or salmon — using what is already nearby.</p></div></div>
            <p class="micro muted" style="margin-top:3pt;">Persistent dizziness or fatigue should be discussed with a qualified health professional.</p>
          </div>
        </div>
        ${foot(6)}
      </div>
    `),
  },
  {
    // 07 · Time saved
    notes: `Talk track: Akeso gives time back in two ways. First, it removes daily decision friction. In our measured demo workflow, checking the calendar, ranking tasks, deciding what to eat, and building a plan took twelve minutes. Akeso reached the first useful recommendation in twenty-five seconds: eleven minutes and thirty-five seconds saved. That is one rehearsed workflow, not a population study, so wider user testing is our next validation step. Second, better timing helps people make more of the hours they already have.\n\n[Sources]\n- Measured team demo workflow: docs/superpowers/specs/2026-07-22-demo-video-script-design.md.`,
    html: doc(`
      <div class="slide" style="background:${C.yellow};">
        <p class="kicker">05 · MEASURABLE TIME SAVED</p>
        <h1>FROM SCATTERED DECISIONS<br>TO ONE GUIDED ROUTINE.</h1>
        <div class="row" style="gap:18pt; margin-top:13pt; align-items:stretch;">
          <div class="card col" style="width:305pt; height:158pt; padding:14pt 18pt; background:${C.white}; justify-content:space-between;">
            <div><p class="kicker">BEFORE · MANUAL</p><h2 style="font-size:44pt;">12:00</h2></div>
            <p class="small muted">Calendar + task triage + meal decision + time blocking</p>
          </div>
          <div class="card col" style="width:305pt; height:158pt; padding:14pt 18pt; background:${C.ink}; color:${C.cream}; justify-content:space-between; border:4pt solid ${C.lime};">
            <div><p class="kicker" style="color:${C.lime};">WITH AKESO</p><h2 style="font-size:44pt; color:${C.lime};">0:25</h2></div>
            <p class="small" style="color:#DDE1D8;">One check-in → energy insight → meal + routine suggestion</p>
          </div>
        </div>
        <div class="pill" style="background:${C.green}; width:365pt; margin-top:11pt;"><p style="font-size:13pt;">11 MIN 35 SEC SAVED PER DAY</p></div>
        <p class="micro muted" style="margin-top:5pt;">Measured demo workflow · validate with a wider user trial.</p>
        ${foot(7)}
      </div>
    `),
  },
  {
    // 08 · Technical execution
    notes: `Talk track: Under the hood, the Expo app talks to an Express API backed by Supabase. Deterministic TypeScript services calculate the authoritative energy result and plan. AI can explain schema-validated guidance, but it does not invent the score. That separation is important: the same input produces a consistent result, and uncertainty is communicated instead of hidden.\n\n[Sources]\n- Architecture overview: README.md.\n- API and scoring contracts: docs/API_CONTRACT.md.\n- Demo architecture narration: docs/superpowers/specs/2026-07-22-demo-video-script-design.md.`,
    html: doc(`
      <div class="slide" style="background:${C.ink}; color:${C.cream};">
        <p class="kicker" style="color:${C.lime};">06 · TECHNICAL EXECUTION</p>
        <h1>BUILT TO EXPLAIN.<br>NOT TO PRETEND.</h1>
        <div class="row" style="gap:12pt; margin-top:16pt; align-items:center;">
          <div class="card" style="width:140pt; padding:15pt; background:${C.green}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">CLIENT</p><h3>Expo App</h3><p class="small" style="margin-top:6pt;">Fast daily interaction</p></div>
          <div style="width:24pt;"><p style="font-size:24pt; color:${C.lime}; text-align:center;">→</p></div>
          <div class="card" style="width:140pt; padding:15pt; background:${C.yellow}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">API</p><h3>Express</h3><p class="small" style="margin-top:6pt;">Validated contracts</p></div>
          <div style="width:24pt;"><p style="font-size:24pt; color:${C.lime}; text-align:center;">→</p></div>
          <div class="card" style="width:140pt; padding:15pt; background:${C.blue}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">DATA</p><h3>Supabase</h3><p class="small" style="margin-top:6pt;">Longitudinal patterns</p></div>
          <div style="width:24pt;"><p style="font-size:24pt; color:${C.lime}; text-align:center;">→</p></div>
          <div class="card" style="width:140pt; padding:15pt; background:${C.coral}; color:${C.ink};"><p class="kicker" style="color:${C.ink};">GUIDANCE</p><h3>Validated AI</h3><p class="small" style="margin-top:6pt;">Explains, not scores</p></div>
        </div>
        <div class="row" style="gap:12pt; margin-top:16pt;">
          <div class="pill" style="background:${C.lime}; color:${C.ink};"><p>DETERMINISTIC ENGINE</p></div>
          <div class="pill" style="background:${C.white}; color:${C.ink};"><p>SCHEMA-VALIDATED OUTPUT</p></div>
          <div class="pill" style="background:${C.green}; color:${C.ink};"><p>NOT A MEDICAL DEVICE</p></div>
        </div>
        <div class="card" style="margin-top:15pt; padding:11pt 15pt; background:#30342E; border-color:#596057; color:${C.cream};"><p class="small"><b>Core challenge:</b> turning noisy lifestyle signals into useful guidance without overstating certainty.</p></div>
        ${foot(8, true)}
      </div>
    `),
  },
  {
    // 09 · Team
    notes: `Talk track: Akeso is built by four of us. Dailin Jia and Bob Lee cover full-stack development — Dailin also owns the UI design, and Bob leads the architecture and the algorithm implementation. Nicole Wang designed the energy algorithm and works across the backend. Xin He drives marketing and also contributes to the backend. Four people, one shared goal: making energy something you can understand and act on.\n\n[Sources]\n- Roles as listed on the team introduction card provided by the team.`,
    html: doc(`
      <div class="slide">
        <p class="kicker">07 · THE TEAM</p>
        <div class="row" style="align-items:flex-end; justify-content:space-between;">
          <h1>FOUR BUILDERS.<br>ONE ENERGY SYSTEM.</h1>
          <p class="small muted" style="width:190pt; text-align:right; padding-bottom:4pt;">Full-stack · algorithms · architecture · marketing</p>
        </div>
        <div class="row" style="flex:1; align-items:flex-start; justify-content:center; margin-top:10pt;">
          <div class="card" style="padding:6pt; background:${C.white};">
            <img src="${rootAsset('team-introduction-pixel-art-v5-distinct-faces.png')}" style="width:420pt; height:236pt; object-fit:cover; border-radius:9pt;">
          </div>
        </div>
        ${foot(9)}
      </div>
    `),
  },
  {
    // 10 · Closing
    notes: `Talk track: Today, Akeso connects daily energy, planning, and nutrition. Next, we want to deepen the picture with an emotion coach, faster food logging, wearables, weekly patterns, and expert-reviewed guidance. Most tools save a few minutes. Akeso aims to do something deeper: help people reclaim the hours they are currently unable to use. We do not ask people to grind harder. We help them understand their energy and use it at the right time. Akeso: less grind, better timing.\n\n[Sources]\n- Current product and roadmap framing: README.md and the team-provided source deck.`,
    html: doc(`
      <div class="slide" style="background:${C.green};">
        <p class="kicker">08 · WHAT’S NEXT</p>
        <div class="row" style="flex:1; align-items:center; gap:34pt;">
          <div class="col" style="width:445pt;">
            <h1 style="font-size:44pt;">UNDERSTAND<br>YOUR ENERGY.<br>FEED IT BETTER.</h1>
            <p style="font-size:15pt; font-weight:700; margin-top:16pt; width:410pt;">A more accessible path to personalised energy and nutrition guidance.</p>
            <div class="row" style="gap:8pt; flex-wrap:wrap; margin-top:18pt;">
              <div class="pill" style="background:${C.coral};"><p>NEXT&nbsp;·&nbsp;EMOTION&nbsp;COACH</p></div>
              <div class="pill" style="background:${C.white};"><p>PHOTO&nbsp;FOOD&nbsp;LOGGING</p></div>
              <div class="pill" style="background:${C.yellow};"><p style="min-width:92pt; text-align:center;">WEEKLY&nbsp;PATTERNS</p></div>
              <div class="pill" style="background:${C.blue};"><p>WEARABLES</p></div>
              <div class="pill" style="background:${C.lime};"><p>EXPERT-REVIEWED&nbsp;GUIDANCE</p></div>
            </div>
            <p style="font-size:11pt; font-weight:800; margin-top:20pt;">github.com/EdwinjJ1/akeso</p>
          </div>
          <div style="width:190pt; height:245pt; background:${C.ink}; border-radius:30pt; border:1.5pt solid ${C.ink}; display:flex; align-items:flex-end; justify-content:center; overflow:hidden;">
            <img src="${asset('mascot-celebrate.png')}" style="width:210pt; height:210pt; object-fit:contain;">
          </div>
        </div>
        <div class="footer"><p style="color:${C.ink};">AKESO · LESS GRIND. BETTER TIMING.</p><p style="color:${C.ink};">10</p></div>
      </div>
    `),
  },
]

async function main() {
  await prepareImages()
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Akeso Team'
  pptx.company = 'ICON UNSW × Lyra Hackathon 2026'
  pptx.subject = 'Akeso personal energy and nutrition coach pitch'
  pptx.title = 'Akeso — Understand Your Energy. Feed It Better.'
  pptx.lang = 'en-AU'
  pptx.theme = { headFontFace: 'Georgia', bodyFontFace: 'Arial', lang: 'en-AU' }

  for (let i = 0; i < slides.length; i += 1) {
    const html = path.join(work, `slide-${i + 1}.html`)
    fs.writeFileSync(html, slides[i].html)
    const { slide } = await html2pptx(html, pptx, { tmpDir: work })
    slide.addNotes(slides[i].notes)
  }

  await pptx.writeFile({ fileName: out, compression: true })
  console.log('written:', out)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
