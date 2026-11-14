// Builds the CCC Series Resources site into dist/.
// Edit content in content/*.json (Pages CMS) and design in src/. Never edit dist/ by hand.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const SITE_URL = 'https://cccarchive.com';
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const site = read('content/site.json');
const seriesDir = path.join(ROOT, 'content/series');
const series = fs.readdirSync(seriesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => read(`content/series/${f}`))
  .filter((s) => !s.hidden)
  .sort((a, b) => String(b.sort_date).localeCompare(String(a.sort_date)));

// ---------- text helpers ----------
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;
const noDash = (s) => String(s).replace(/\s*—\s*/g, ', ');

// Ties the last two words together so no line ends with a single orphan word.
const tie = (html) => html.replace(/(\S) ([^\s<>]{1,14})(\s*)$/u, '$1 $2$3');

// Inline formatting for plain text fields: **bold**, *italic*, [text](url)
function md(s = '') {
  let h = esc(noDash(s));
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${ext(u)}>${t}</a>`);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return tie(h);
}
// Rich text from the CMS editor: keep HTML, tie orphans inside block elements, open outside links in a new tab.
function rich(h = '') {
  h = noDash(h);
  h = h.replace(/(\S) ([^\s<>]{1,14})(\s*)(<\/(?:p|li|h[1-6])>)/g, '$1 $2$3$4');
  h = h.replace(/<a href="(https?:[^"]+)"(?![^>]*target)/g, '<a href="$1" target="_blank" rel="noopener"');
  return h;
}
const ext = (u = '') => (/^https?:/.test(u) && !u.startsWith(SITE_URL) ? ' target="_blank" rel="noopener"' : '');
const slugify = (s) => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- media helpers ----------
function videoInfo(url = '') {
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) {
    const list = (url.match(/[?&]list=([\w-]+)/) || [])[1];
    return { type: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0${list ? '' : ''}`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  }
  m = url.match(/youtube\.com\/(?:embed\/videoseries\?list=|playlist\?list=)([\w-]+)/);
  if (m) return { type: 'youtube-list', embed: `https://www.youtube-nocookie.com/embed/videoseries?list=${m[1]}` };
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { type: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}?dnt=1` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'file', src: url };
  return null;
}
function fileType(u = '') {
  if (/dropbox\.com\/sh\//.test(u)) return 'Folder';
  const m = u.split('?')[0].match(/\.(pdf|jpe?g|png|zip|docx?|pptx?|mp3)$/i);
  if (m) return m[1].toUpperCase().replace('JPEG', 'JPG');
  if (/dropbox\.com\/s\//.test(u)) return 'PDF';
  return 'Link';
}
const img = (src, alt = '', cls = '', lazy = true) =>
  src ? `<img src="${attr(src)}" alt="${attr(alt)}"${cls ? ` class="${cls}"` : ''}${lazy ? ' loading="lazy" decoding="async"' : ''}>` : '';

// ---------- blocks ----------
function itemLink(it, inner, cls) {
  return it.url ? `<a class="${cls}" href="${attr(it.url)}"${ext(it.url)}>${inner}</a>` : `<div class="${cls}">${inner}</div>`;
}
const B = {
  Text: (b) => {
    const body = rich(b.text || '');
    if (b.collapsed_title) return `<details class="acc"><summary>${md(b.collapsed_title)}</summary><div class="prose">${body}</div></details>`;
    return `<div class="prose">${body}</div>`;
  },
  Buttons: (b) => `<div class="btns">${(b.items || []).filter((i) => i.url).map((i, n) =>
    `<a class="btn${n ? ' btn--ghost' : ''}" href="${attr(i.url)}"${ext(i.url)}>${md(i.label)}</a>`).join('')}</div>`,
  Downloads: (b) => `<ul class="dl">${(b.items || []).filter((i) => i.url).map((i) => {
    const t = fileType(i.url);
    return `<li><a href="${attr(i.url)}"${ext(i.url) || (t !== 'Link' ? ' target="_blank" rel="noopener"' : '')}><span class="dl__type" aria-hidden="true">${t}</span><span class="dl__label">${md(i.label)}</span></a></li>`;
  }).join('')}</ul>`,
  Image: (b) => {
    const pic = img(b.image, b.alt || b.caption || '');
    const inner = b.url ? `<a href="${attr(b.url)}"${ext(b.url) || ' target="_blank" rel="noopener"'}>${pic}</a>` : pic;
    return `<figure class="fig fig--${slugify(b.size || 'Wide')}">${inner}${b.caption ? `<figcaption>${md(b.caption)}</figcaption>` : ''}</figure>`;
  },
  Video: (b) => {
    const v = videoInfo(b.url);
    if (!v) return '';
    const media = v.type === 'file'
      ? `<video controls preload="none" playsinline${b.poster ? ` poster="${attr(b.poster)}"` : ''}><source src="${attr(v.src)}" type="video/mp4"></video>`
      : `<iframe src="${attr(v.embed)}" title="${attr(b.caption || 'Video')}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
    return `<figure class="video">${media}${b.caption ? `<figcaption>${md(b.caption)}</figcaption>` : ''}</figure>`;
  },
  Books: (b) => `<ul class="books">${(b.items || []).map((i) => `<li>${itemLink(i,
    `<span class="books__cover">${img(i.image, i.title ? `${i.title} cover` : 'Book cover')}</span>${i.title ? `<span class="books__title">${md(i.title)}</span>` : ''}${i.text ? `<span class="books__by">${md(i.text)}</span>` : ''}`, 'books__item')}</li>`).join('')}</ul>`,
  Videos: (b) => `<ul class="vids">${(b.items || []).map((i) => {
    const v = videoInfo(i.url);
    const thumb = i.image || v?.thumb || '';
    const inner = `<span class="vids__thumb">${img(thumb, '')}<span class="vids__play" aria-hidden="true"></span></span><span class="vids__title">${md(i.title || 'Watch video')}</span>${i.text ? `<span class="vids__by">${md(i.text)}</span>` : ''}`;
    if (v && v.embed) return `<li><a class="vids__item" href="${attr(i.url)}" data-embed="${attr(v.embed + (v.type === 'youtube' ? '&autoplay=1' : v.type === 'vimeo' ? '&autoplay=1' : ''))}" data-title="${attr(i.title || '')}">${inner}</a></li>`;
    return `<li>${itemLink(i, inner, 'vids__item')}</li>`;
  }).join('')}</ul>`,
  Tiles: (b) => `<ul class="tiles">${(b.items || []).map((i) => `<li>${itemLink(i,
    `${img(i.image, '')}<span class="tiles__title">${md(i.title || i.label || 'Open link')}</span>${i.text ? `<span class="tiles__by">${md(i.text)}</span>` : ''}`, 'tiles__item')}</li>`).join('')}</ul>`,
  Cards: (b) => `<ul class="cards">${(b.items || []).map((i) => `<li class="card">${i.image ? `<div class="card__img">${i.url ? `<a href="${attr(i.url)}"${ext(i.url)} tabindex="-1" aria-hidden="true">${img(i.image, '')}</a>` : img(i.image, '')}</div>` : ''}<div class="card__body">${i.title ? `<h3>${md(i.title)}</h3>` : ''}${i.text ? `<p>${md(i.text)}</p>` : ''}${i.url ? `<a class="btn btn--small" href="${attr(i.url)}"${ext(i.url) || (fileType(i.url) !== 'Link' ? ' target="_blank" rel="noopener"' : '')}>${md(i.label || 'Open')}</a>` : ''}</div></li>`).join('')}</ul>`,
  Embed: (b) => `<div class="embeds embeds--${Math.min((b.items || []).length, 2)}">${(b.items || []).filter((i) => i.url).map((i) => {
    const v = videoInfo(i.url);
    const h = Number(i.height) || 0;
    const style = h ? ` style="height:${h}px"` : '';
    const cls = h ? 'embed' : 'embed embed--16x9';
    return `<div class="${cls}"><iframe src="${attr(v?.embed || i.url)}" title="Embedded content"${style} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }).join('')}</div>`,
  Code: (b) => `<div class="code-embed">${b.code || ''}</div>`,
};
const block = (b) => (B[b.kind] ? B[b.kind](b) : '');

// ---------- derived stats ----------
function stats(s) {
  const c = { downloads: 0, books: 0, videos: 0 };
  for (const sec of s.sections || []) for (const b of sec.blocks || []) {
    const n = (b.items || []).length;
    if (b.kind === 'Downloads') c.downloads += n;
    if (b.kind === 'Books') c.books += n;
    if (b.kind === 'Videos') c.videos += n;
  }
  const hasGuides = (s.sections || []).some((x) => x.anchor === 'discussion-guides');
  const out = [];
  if (hasGuides) out.push('Discussion guides');
  if (c.downloads) out.push(`${c.downloads} download${c.downloads > 1 ? 's' : ''}`);
  if (c.books) out.push(`${c.books} book${c.books > 1 ? 's' : ''}`);
  if (c.videos) out.push(`${c.videos} video${c.videos > 1 ? 's' : ''}`);
  return { ...c, list: out };
}
const yearOf = (s) => String(s.sort_date || '').slice(0, 4);
const searchText = (s) => [s.title, s.dates, s.scripture, s.summary,
  ...(s.sections || []).flatMap((x) => [x.heading, ...(x.blocks || []).flatMap((b) => (b.items || []).map((i) => `${i.title || ''} ${i.text || ''} ${i.label || ''}`))])]
  .join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();

// ---------- layout ----------
const logo = `<span class="logo" role="img" aria-label="Christ Community Church"></span>`;
function page({ title, description, canonical, image, body, bodyClass = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${SITE_URL}${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${SITE_URL}${canonical}">
${image ? `<meta property="og:image" content="${SITE_URL}${attr(image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/images/brand/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://use.typekit.net" crossorigin>
<link rel="stylesheet" href="https://use.typekit.net/ohw6ayv.css">
<link rel="stylesheet" href="https://use.typekit.net/dyw0udq.css">
<link rel="stylesheet" href="/assets/styles.css?v=${BUILD}">
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="top__in">
    <a class="top__brand" href="/" aria-label="Series resources home">${logo}<span class="top__name">${esc(site.site_title)}</span></a>
    <a class="top__out" href="${attr(site.main_site_url)}">${esc(site.main_site_label)}</a>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot__in">
    <div class="foot__brand">${logo}<p>${md(site.footer_text)}</p></div>
    <div class="foot__col"><p>${md(site.service_times)}<br>${md(site.address)}<br><a href="tel:${attr(site.phone.replace(/\D/g, ''))}">${esc(site.phone)}</a></p></div>
    <ul class="foot__col foot__links">${(site.footer_links || []).map((l) => `<li><a href="${attr(l.url)}">${md(l.label)}</a></li>`).join('')}</ul>
    <ul class="foot__col foot__links">${(site.social || []).map((l) => `<li><a href="${attr(l.url)}" target="_blank" rel="noopener">${md(l.label)}</a></li>`).join('')}</ul>
  </div>
  <p class="foot__legal">© ${new Date().getFullYear()} Christ Community Church, Omaha, NE</p>
</footer>
<dialog class="lightbox" aria-label="Video player"><div class="lightbox__frame"></div><button class="lightbox__close" type="button">Close</button></dialog>
<script src="/assets/app.js?v=${BUILD}" defer></script>
</body>
</html>`;
}
const BUILD = Date.now().toString(36);

// ---------- landing page ----------
function landing() {
  const years = [...new Set(series.map(yearOf))];
  const total = series.reduce((n, s) => n + stats(s).downloads, 0);
  const groups = years.map((y) => `
  <section class="year" data-year="${y}">
    <h2 class="year__num">${y}</h2>
    <ul class="shelf">
      ${series.filter((s) => yearOf(s) === y).map((s) => {
        const st = stats(s);
        return `<li class="shelf__item" data-search="${attr(searchText(s))}">
        <a href="/${s.slug}/">
          <span class="shelf__art">${img(s.card_image, '', '', true)}</span>
          <span class="shelf__title">${md(s.title)}</span>
          <span class="shelf__dates">${md(s.dates)}</span>
          <span class="shelf__sum">${md(s.summary)}</span>
          ${st.list.length ? `<span class="shelf__has">${st.list.map(esc).join(', ')}</span>` : ''}
        </a>
      </li>`;
      }).join('')}
    </ul>
  </section>`).join('');
  const body = `
<section class="intro">
  <div class="intro__in">
    <h1>${md(site.heading)}</h1>
    <p class="intro__lead">${md(site.intro)}</p>
    <p class="intro__count">${series.length} series and ${total} downloadable guides, ${years[years.length - 1]} to ${years[0]}.</p>
    <label class="search"><span class="sr">Search series</span><input type="search" id="q" placeholder="${attr(site.search_placeholder)}" autocomplete="off"></label>
  </div>
</section>
<div class="library" id="library">${groups}
  <p class="empty" hidden>No series match that search. Try a book of the Bible, an author, or a topic like prayer or money.</p>
</div>`;
  return page({ title: `${site.site_title} | Christ Community Church`, description: site.intro, canonical: '/', image: series[0]?.card_image, body, bodyClass: 'home' });
}

// ---------- series page ----------
function heroHtml(s) {
  const h = s.hero || {};
  const color = slugify(h.background_color || 'Navy');
  const bg = h.background ? ` style="--hero-bg:url('${attr(h.background)}')"` : '';
  let center = '';
  if (h.title_image) center = `<h1 class="hero__mark">${img(h.title_image, s.title, '', false)}</h1>`;
  else if (h.image) center = `<h1 class="hero__art">${img(h.image, s.title, '', false)}</h1>`;
  else center = `<h1 class="hero__title">${md(s.title)}</h1>`;
  if (h.show_title && (h.title_image || h.image)) center += `<p class="hero__title hero__title--sub">${md(s.title)}</p>`;
  if (h.show_title && !h.title_image && !h.image) center = `<h1 class="hero__title">${md(s.title)}</h1>`;
  return `<section class="hero hero--${color}${h.background ? ' hero--bg' : ''}${h.image && !h.title_image ? ' hero--art' : ''}"${bg}>
  <div class="hero__in">
    ${center}
    ${h.tagline ? `<p class="hero__tag">${md(h.tagline)}</p>` : ''}
    ${(h.buttons || []).length ? `<div class="btns btns--hero">${h.buttons.map((b, n) => `<a class="btn${n ? ' btn--ghost' : ''}" href="${attr(b.url)}"${ext(b.url)}>${md(b.label)}</a>`).join('')}</div>` : ''}
  </div>
</section>`;
}
function seriesPage(s, i) {
  const secs = (s.sections || []).map((x) => ({ ...x, id: x.anchor || slugify(x.heading) }));
  const prev = series[i + 1], next = series[i - 1];
  const meta = [s.dates, s.scripture].filter(Boolean);
  const body = `
${heroHtml(s)}
<div class="meta"><div class="meta__in">
  <a class="meta__back" href="/">All series</a>
  <p class="meta__line"><strong>${md(s.title)}</strong>${meta.map((m) => `<span>${md(m)}</span>`).join('')}</p>
</div></div>
<div class="sheet">
  <nav class="toc" aria-label="On this page">
    <p class="toc__label">On this page</p>
    <ol>${secs.map((x) => `<li><a href="#${x.id}">${md(x.heading)}</a></li>`).join('')}</ol>
  </nav>
  <div class="flow">
    <p class="flow__sum">${md(s.summary)}</p>
    ${secs.map((x) => `
    <section class="sec sec--${slugify(x.style || 'Light')}" id="${x.id}">
      ${x.eyebrow ? `<p class="sec__kicker">${md(x.eyebrow)}</p>` : ''}
      <h2>${md(x.heading)}</h2>
      ${x.intro ? `<p class="sec__intro">${md(x.intro)}</p>` : ''}
      ${(x.blocks || []).map(block).join('\n')}
    </section>`).join('')}
  </div>
</div>
<nav class="pager" aria-label="More series">
  ${prev ? `<a class="pager__link" href="/${prev.slug}/">${img(prev.card_image, '')}<span><small>Earlier series</small>${md(prev.title)}</span></a>` : '<span></span>'}
  ${next ? `<a class="pager__link pager__link--next" href="/${next.slug}/"><span><small>Later series</small>${md(next.title)}</span>${img(next.card_image, '')}</a>` : '<span></span>'}
</nav>`;
  return page({ title: `${s.title} | ${site.site_title} | Christ Community Church`, description: s.seo_description || s.summary, canonical: `/${s.slug}/`, image: s.card_image, body, bodyClass: 'series' });
}

// ---------- write ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const d of ['images', 's', 'video']) if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });
fs.cpSync(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), landing());
series.forEach((s, i) => {
  fs.mkdirSync(path.join(DIST, s.slug), { recursive: true });
  fs.writeFileSync(path.join(DIST, s.slug, 'index.html'), seriesPage(s, i));
});
fs.writeFileSync(path.join(DIST, '404.html'), page({ title: 'Page not found | Christ Community Church', description: 'Page not found', canonical: '/404', body: `<section class="intro"><div class="intro__in"><h1>Page not found</h1><p class="intro__lead">That page moved or no longer exists. <a href="/">Browse all series resources</a> or visit <a href="https://www.cccomaha.org">cccomaha.org</a>.</p></div></section>` }));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${SITE_URL}/</loc></url>\n${series.map((s) => `<url><loc>${SITE_URL}/${s.slug}/</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`Built ${series.length} series pages + landing into dist/`);
