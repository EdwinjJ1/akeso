/* Akeso showcase — interactions.
   Edit CONFIG below when the demo video / APK build are ready. */

const CONFIG = {
  /** YouTube video id, e.g. 'dQw4w9WgXcQ'. Takes priority over videoMp4. */
  videoYouTubeId: '',
  /** Path to a local mp4, e.g. 'assets/demo.mp4' (drop the file into assets/). */
  videoMp4: 'assets/akeso-demo.mp4',
  /** Poster frame shown before playback starts. */
  videoPoster: 'assets/akeso-demo-poster.jpg',
  /** Direct APK / EAS build link. Falls back to the GitHub releases page. */
  apkUrl: '',
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- Nav border on scroll ---------- */

function initNav() {
  const nav = document.querySelector('.nav')
  if (!nav) return
  const update = () => nav.classList.toggle('is-scrolled', window.scrollY > 12)
  update()
  window.addEventListener('scroll', update, { passive: true })
}

/* ---------- Demo video slot ---------- */

function initVideo() {
  const slot = document.getElementById('video-slot')
  if (!slot) return

  if (CONFIG.videoYouTubeId) {
    const iframe = document.createElement('iframe')
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(CONFIG.videoYouTubeId)}`
    iframe.title = 'Akeso demo video'
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
    iframe.allowFullscreen = true
    slot.classList.add('has-video')
    slot.replaceChildren(iframe)
    return
  }

  if (CONFIG.videoMp4) {
    const video = document.createElement('video')
    video.src = CONFIG.videoMp4
    if (CONFIG.videoPoster) video.poster = CONFIG.videoPoster
    video.controls = true
    video.playsInline = true
    video.preload = 'metadata'
    slot.classList.add('has-video')
    slot.replaceChildren(video)
  }
}

/* ---------- Demo spotlight ---------- */

function initDemoSpotlight() {
  const stage = document.getElementById('demo-stage')
  if (!stage || reducedMotion) return

  stage.addEventListener('pointermove', (event) => {
    const rect = stage.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    stage.style.setProperty('--spot-x', `${x.toFixed(1)}%`)
    stage.style.setProperty('--spot-y', `${y.toFixed(1)}%`)
  })

  stage.addEventListener('pointerleave', () => {
    stage.style.setProperty('--spot-x', '70%')
    stage.style.setProperty('--spot-y', '30%')
  })
}

/* ---------- APK button ---------- */

function initApkButton() {
  const btn = document.getElementById('apk-btn')
  if (!btn || !CONFIG.apkUrl) return
  btn.href = CONFIG.apkUrl
}

/* ---------- Reveal on scroll ---------- */

function initReveal() {
  const targets = document.querySelectorAll('.reveal')
  if (reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-in'))
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      })
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  )
  targets.forEach((el) => observer.observe(el))
}

/* ---------- Screens gallery ---------- */

function initGallery() {
  const gallery = document.getElementById('gallery')
  const prev = document.getElementById('gallery-prev')
  const next = document.getElementById('gallery-next')
  if (!gallery || !prev || !next) return

  const shots = [...gallery.querySelectorAll('.shot')]
  if (shots.length === 0) return
  /* Track the target index ourselves and let scrollIntoView compute the
     snap position: the cards snap to center, so index * cardWidth is not a
     valid snap point and plain scrollTo/scrollBy gets pulled back. */
  let index = 0
  const goTo = (i) => {
    index = Math.max(0, Math.min(shots.length - 1, i))
    shots[index].scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }
  gallery.addEventListener(
    'scrollend',
    () => {
      const mid = gallery.scrollLeft + gallery.clientWidth / 2
      index = shots.findIndex(
        (shot) => shot.offsetLeft + shot.offsetWidth / 2 >= mid - shot.offsetWidth / 2,
      )
      if (index < 0) index = shots.length - 1
    },
    { passive: true },
  )
  prev.addEventListener('click', () => goTo(index - 1))
  next.addEventListener('click', () => goTo(index + 1))
}

/* ---------- Adapts: same student, different day ---------- */

const DAYS = {
  high: {
    band: 'High energy',
    score: 72,
    line: 'Two hard tasks fit inside the 9–11:30 peak.',
    mascot: 'assets/mascot-high.png',
    plan: [
      { tag: 'Deep work', text: 'COMP2521 assignment lands in the peak' },
      { tag: 'Admin', text: 'Emails ride the 2–4pm dip' },
      { tag: 'Meal', text: 'Salmon bowl before the afternoon reset' },
    ],
  },
  low: {
    band: 'Low energy',
    score: 38,
    line: 'One priority is protected. Recovery gets real space.',
    mascot: 'assets/mascot-low.png',
    plan: [
      { tag: 'One priority', text: 'Assignment outline only — nothing heroic' },
      { tag: 'Light admin', text: 'Ten minutes of email, then stop' },
      { tag: 'Recovery', text: 'An early night is on the schedule' },
    ],
  },
}

function animateScore(el, from, to) {
  if (reducedMotion) {
    el.textContent = String(to)
    return
  }
  const duration = 500
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    el.textContent = String(Math.round(from + (to - from) * eased))
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function renderDay(key) {
  const day = DAYS[key]
  const card = document.getElementById('adapt-card')
  const bandEl = document.getElementById('adapt-band')
  const scoreEl = document.getElementById('adapt-score')
  const lineEl = document.getElementById('adapt-line')
  const planEl = document.getElementById('adapt-plan')
  const mascotEl = document.getElementById('adapt-mascot')
  if (!card || !bandEl || !scoreEl || !lineEl || !planEl || !mascotEl) return

  const from = Number(scoreEl.textContent) || 0
  card.dataset.band = key
  bandEl.textContent = day.band
  lineEl.textContent = day.line
  mascotEl.src = day.mascot
  planEl.replaceChildren(
    ...day.plan.map((item) => {
      const li = document.createElement('li')
      const tag = document.createElement('span')
      tag.className = 'plan-tag'
      tag.textContent = item.tag
      li.append(tag, document.createTextNode(' ' + item.text))
      return li
    }),
  )
  animateScore(scoreEl, from, day.score)
}

function initAdapt() {
  const card = document.getElementById('adapt-card')
  const tabs = [
    { button: document.getElementById('tab-high'), key: 'high' },
    { button: document.getElementById('tab-low'), key: 'low' },
  ]
  if (!card || tabs.some((t) => !t.button)) return

  tabs.forEach(({ button, key }) => {
    button.addEventListener('click', () => {
      if (card.dataset.band === key) return
      tabs.forEach((t) => {
        t.button.classList.toggle('is-active', t.key === key)
        t.button.setAttribute('aria-selected', String(t.key === key))
      })
      if (reducedMotion) {
        renderDay(key)
        return
      }
      card.classList.add('is-switching')
      window.setTimeout(() => {
        renderDay(key)
        card.classList.remove('is-switching')
      }, 220)
    })
  })
}

initNav()
initVideo()
initDemoSpotlight()
initApkButton()
initReveal()
initGallery()
initAdapt()
