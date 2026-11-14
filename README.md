# CCC Series Resources (cccarchive.com)

Archive of Christ Community Church message series resource pages: reading plans, discussion guides, booklets, books, and videos.

- **Edit content** in Pages CMS (app.pagescms.org). Landing page copy is `content/site.json`; each series is one file in `content/series/`.
- **Add a series:** Pages CMS > 2. Series pages > Add an entry. The landing page groups series by year automatically.
- **Design** lives in `build.mjs` (page templates) and `src/assets/` (CSS and JS). Never edit `dist/`; Netlify rebuilds it on every push to `main`.
- **Files:** PDFs live in `s/` so old Squarespace links (`/s/name.pdf`) keep working. Images live in `images/`.
- **Redirects** for old Squarespace URLs are in `netlify.toml`.

Build locally: `node build.mjs` (no dependencies), then serve `dist/`.
