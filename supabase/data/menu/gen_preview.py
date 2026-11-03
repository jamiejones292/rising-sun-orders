import base64, html, os, re, sys
from menu_data import MENU, MIXERS

e = html.escape
def money(p):
    return f"£{p // 100}.{p % 100:02d}"
def slug(s):
    return "c-" + re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

flags_total = sum(len(x["flags"]) for c in MENU for x in c["drinks"])
drinks_total = sum(len(c["drinks"]) for c in MENU)

chips = "".join(f'<a class="chip" href="#{slug(c["name"])}">{e(c["name"])}</a>' for c in MENU)

sections = []
for c in MENU:
    cards = []
    for x in c["drinks"]:
        groups = x["groups"] if x["groups"] is not None else c["groups"]
        alcohol = c["alcohol"] if x["alcohol"] is None else x["alcohol"]
        no_ice = c["no_ice"] if x["no_ice"] is None else x["no_ice"]
        meta = []
        if x["abv"] is not None:
            meta.append(f"{x['abv']:g}% ABV")
        if x["welsh"]:
            meta.append('<span class="tag">Welsh</span>')
        sizes = "".join(f'<li><span>{e(l)}</span><b>{money(p)}</b></li>' for l, p in x["sizes"])
        extras = []
        if "Add a mixer" in groups:
            extras.append("Add a mixer")
        if "How would you like it?" in groups:
            extras.append("Neat / with ice / splash of water")
        if no_ice:
            extras.append("“No ice” option")
        allergens = "".join(f'<span class="al">{e(a)}</span>' for a in x["allergens"])
        flag_html = "".join(f"<li>{e(f)}</li>" for f in x["flags"])
        cards.append(f"""
      <article class="drink{' flagged' if x['flags'] else ''}">
        <div class="drink-head">
          <h3>{e(x['name'])}</h3>
          <ul class="sizes">{sizes}</ul>
        </div>
        {f'<p class="meta">{" · ".join(meta)}</p>' if meta else ''}
        <p class="desc">{e(x['desc'])}</p>
        {f'<p class="extras">{" · ".join(e(t) for t in extras)}</p>' if extras else ''}
        {f'<div class="als">{allergens}</div>' if allergens else ''}
        {f'<ul class="flags" aria-label="To check">{flag_html}</ul>' if flag_html else ''}
      </article>""")
    note = f'<p class="cat-note">{e(c["note"])}</p>' if c["note"] else ""
    nflag = sum(1 for x in c["drinks"] if x["flags"])
    sections.append(f"""
    <section class="cat" id="{slug(c['name'])}">
      <header class="cat-head">
        <h2>{e(c['name'])}</h2>
        <span class="count">{len(c['drinks'])} drinks{f' · <span class="miss">{nflag} to check</span>' if nflag else ''}</span>
      </header>
      {note}
      <div class="drinks">{''.join(cards)}</div>
    </section>""")

# Real screenshots of drinksorder.app running on a test copy with this menu.
SHOTS = [("1-menu", "The menu"), ("2-whisky", "Whisky"), ("3-vodka-sheet", "A spirit, with mixers"),
         ("4-house-wine", "House wine"), ("5-wine-sheet", "A specialist wine"), ("6-soft", "Soft drinks")]
shot_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots")
gallery = "".join(
    f'<figure class="shot"><img alt="{e(cap)} on drinksorder.app" src="data:image/jpeg;base64,'
    + base64.b64encode(open(os.path.join(shot_dir, f + ".jpg"), "rb").read()).decode()
    + f'"><figcaption>{e(cap)}</figcaption></figure>'
    for f, cap in SHOTS if os.path.exists(os.path.join(shot_dir, f + ".jpg")))

mixer_rows = "".join(
    f'<tr><td>{e(l)}</td><td class="num">{"free" if p == 0 else "+" + money(p)}</td><td>{e(f) if f else "–"}</td></tr>'
    for l, p, f in MIXERS)

page = f"""<title>Rising Sun Menu Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=Cormorant+Garamond:wght@500;600;700&family=Figtree:wght@400;500;600;700&display=swap">
<style>
/* Layout: the customer menu's narrow ivory column, with the owner's checks marked in gold beside each drink. */
:root {{
  --bg: #F3EADB; --paper: #FBF4EA; --ink: #1B241F; --muted: #5F6A61; --line: #E2D4BC;
  --forest: #132A1F; --gold: #9C7840; --gold-ink: #7A5C2C; --flag-bg: #FBEFD6; --flag-line: #D9B46A;
  --alert: #A23B2A;
  --display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --caps: "Cinzel", Georgia, serif;
  --ui: "Figtree", system-ui, -apple-system, "Segoe UI", sans-serif;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #0D1A13; --paper: #14251C; --ink: #EFE6D6; --muted: #AEB5A8; --line: #2C3F33;
  --forest: #EFE6D6; --gold: #C9A469; --gold-ink: #D8B57A; --flag-bg: #2E2614; --flag-line: #8C6B32; --alert: #F08C78;
  color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #0D1A13; --paper: #14251C; --ink: #EFE6D6; --muted: #AEB5A8; --line: #2C3F33;
  --forest: #EFE6D6; --gold: #C9A469; --gold-ink: #D8B57A; --flag-bg: #2E2614; --flag-line: #8C6B32; --alert: #F08C78;
  color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--ink); font: 15px/1.5 var(--ui);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }}
.wrap {{ max-width: 760px; margin: 0 auto; }}
.banner {{ padding-block: 28px 18px; display: grid; gap: 8px; }}
.eyebrow {{ font: 600 0.72rem/1 var(--caps); letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold-ink); }}
h1 {{ font: 600 2.6rem/1.05 var(--display); margin: 0; color: var(--forest); text-wrap: balance; }}
.lede {{ margin: 0; color: var(--muted); max-width: 62ch; }}
.facts {{ display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 4px 0 0; padding: 0; list-style: none; font-weight: 600; color: var(--forest); }}
.facts .miss {{ color: var(--gold-ink); }}
.notice {{ background: var(--paper); border: 1px solid var(--line); border-radius: 6px; padding: 14px 16px; display: grid; gap: 8px; }}
.notice h2 {{ font: 600 1.4rem/1.2 var(--display); margin: 0; color: var(--forest); }}
.notice p {{ margin: 0; color: var(--muted); }}
.chips {{ position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); display: flex; gap: 6px;
  overflow-x: auto; padding-block: 12px; scrollbar-width: none; border-bottom: 1px solid var(--line); margin-top: 18px; }}
body::before {{ content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }}
.chip {{ flex: none; text-decoration: none; color: var(--forest); border: 1px solid var(--line); background: var(--paper);
  border-radius: 999px; padding: 6px 12px; font-weight: 600; font-size: 0.86rem; }}
.chip:focus-visible, a:focus-visible {{ outline: 2px solid var(--gold); outline-offset: 2px; }}
.cat {{ padding-top: 26px; scroll-margin-top: 64px; }}
.cat-head {{ display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px;
  border-bottom: 1.5px solid var(--gold); padding-bottom: 6px; }}
.cat-head h2 {{ font: 600 1.9rem/1.1 var(--display); margin: 0; color: var(--forest); }}
.count {{ font-size: 0.85rem; color: var(--muted); font-variant-numeric: tabular-nums; }}
.cat-note {{ margin: 8px 0 0; font: 600 0.72rem/1.4 var(--caps); letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold-ink); }}
.drinks {{ display: grid; gap: 0; }}
.drink {{ padding-block: 14px; border-bottom: 1px solid var(--line); display: grid; gap: 4px; min-width: 0; }}
.drink.flagged {{ border-left: 3px solid var(--flag-line); padding-left: 12px; }}
.drink-head {{ display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 16px; align-items: baseline; }}
.drink h3 {{ margin: 0; font: 600 1.05rem/1.3 var(--ui); color: var(--forest); min-width: 0; }}
.sizes {{ list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; font-variant-numeric: tabular-nums; }}
.sizes li {{ display: flex; gap: 6px; font-size: 0.92rem; color: var(--muted); }}
.sizes b {{ color: var(--ink); }}
.meta, .extras {{ margin: 0; font-size: 0.85rem; color: var(--muted); }}
.extras {{ color: var(--gold-ink); }}
.desc {{ margin: 0; max-width: 65ch; }}
.tag {{ background: var(--forest); color: var(--paper); font-size: 0.72rem; font-weight: 700; padding: 1px 6px; border-radius: 3px; }}
.miss {{ color: var(--gold-ink); font-weight: 600; }}
.als {{ display: flex; flex-wrap: wrap; gap: 4px; }}
.al {{ font-size: 0.75rem; border: 1px solid var(--line); border-radius: 3px; padding: 1px 6px; color: var(--muted); }}
.flags {{ margin: 4px 0 0; padding: 8px 10px 8px 26px; background: var(--flag-bg); border-radius: 4px; font-size: 0.86rem; display: grid; gap: 3px; }}
.flags li::marker {{ color: var(--gold-ink); }}
table {{ border-collapse: collapse; width: 100%; font-size: 0.92rem; }}
.table-wrap {{ overflow-x: auto; }}
th, td {{ text-align: left; padding: 7px 10px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }}
th {{ font: 600 0.7rem/1.2 var(--caps); letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold-ink); }}
td.num {{ font-variant-numeric: tabular-nums; white-space: nowrap; }}
.steps {{ margin: 0; padding-left: 20px; display: grid; gap: 4px; }}
.real {{ display: grid; gap: 8px; margin-bottom: 16px; }}
.real h2 {{ font: 600 1.6rem/1.2 var(--display); margin: 0; color: var(--forest); }}
.real p {{ margin: 0; color: var(--muted); }}
.gallery {{ display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x mandatory; }}
.shot {{ flex: none; width: 210px; margin: 0; display: grid; gap: 6px; scroll-snap-align: start; }}
.shot img {{ width: 100%; max-width: 100%; border-radius: 14px; border: 1px solid var(--line); display: block; }}
.shot figcaption {{ font-size: 0.85rem; color: var(--muted); text-align: center; }}
@media (max-width: 520px) {{ h1 {{ font-size: 2.1rem; }} }}
</style>

<div class="wrap">
  <header class="banner">
    <span class="eyebrow">The Rising Sun Inn · Abersychan</span>
    <h1>New drinks menu: preview</h1>
    <p class="lede">This is what goes on drinksorder.app when you say go. Nothing has changed on the live menu yet.</p>
    <ul class="facts">
      <li>{len(MENU)} categories</li><li>{drinks_total} drinks</li>{f'<li class="miss">{flags_total} things to check</li>' if flags_total else '<li>All checked</li>'}
    </ul>
  </header>

  <section aria-labelledby="real-h" class="real">
    <h2 id="real-h">How it looks on drinksorder.app</h2>
    <p>Screenshots of the real customer app on a phone, running on a test copy with this menu. Same layout as now; only the drinks change.</p>
    <div class="gallery">{gallery}</div>
  </section>

  <section class="notice" aria-labelledby="mixers-h">
    <h2 id="mixers-h">Mixers for spirits</h2>
    <p>Every spirit and liqueur gets this “Add a mixer” list, and each mixer goes out of stock with its drink.
      Draught mixers are 60p, as you said. The can and bottle prices are still my suggestions: tell me if you want them different.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Mixer</th><th>Added to spirit</th><th>Follows the stock of</th></tr></thead>
      <tbody>{mixer_rows}</tbody>
    </table></div>
  </section>

  <section class="notice" aria-labelledby="also-h" style="margin-top: 12px">
    <h2 id="also-h">Also changing</h2>
    <ul class="steps">
      <li>All current drinks come off the menu (kept in past orders and sales). That includes the Cranberry juice mixer.</li>
      <li>Spirits are split into Whisky, Gin, Vodka, Rum &amp; Tequila, Liqueurs, and Brandy, Port &amp; Sherry, so customers can find them.</li>
      <li>Specialist wines are split into White, Rosé, Red, and Prosecco &amp; Champagne, by the bottle, with origin and vegan or vegetarian in the description.</li>
      <li>Allergens are my suggestions from the type of drink: gluten for beers, sulphites for ciders and wines, milk for milkshakes and Disaronno Velvet. Please check them against the labels.</li>
    </ul>
  </section>

  <nav class="chips" aria-label="Categories">{chips}</nav>
  {''.join(sections)}
</div>
"""
open(sys.argv[1], "w").write(page)
print("ok", len(page))
