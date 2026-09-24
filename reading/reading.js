'use strict';
const $ = id => document.getElementById(id);
let data, prefs = {};
try { prefs = JSON.parse(localStorage.getItem('reading-preferences-v1')) || {}; } catch {}
function el(tag, text, cls) { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; }
function safeLink(url) { try { const u = new URL(url); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
function link(text, url) { const node = el('a', text); node.href = safeLink(url) || '#'; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'}) : 'Date unavailable'; }
function toggle(item, key) {
  prefs[item.url] ||= {}; prefs[item.url][key] = !prefs[item.url][key];
  try { localStorage.setItem('reading-preferences-v1', JSON.stringify(prefs)); } catch { $('notice').hidden=false; $('notice').textContent='Your browser could not save reading preferences. They will last for this visit only.'; }
  render();
}
function render() {
  const search = $('search').value.toLowerCase(), category = $('category').value, view = $('view').value;
  const shown = data.items.filter(i => (!category || i.categories.includes(category)) && (i.title + ' ' + i.source).toLowerCase().includes(search) && (view !== 'unread' || !prefs[i.url]?.read) && (view !== 'saved' || prefs[i.url]?.saved));
  $('count').textContent = shown.length ? `${shown.length} items` : 'No items match this view.';
  $('items').replaceChildren();
  shown.forEach((item, index) => {
    const row = el('li', '', 'article'), content = el('div'); row.append(el('span', String(index+1).padStart(2,'0'), 'rank'), content);
    const title = el('h3'); title.append(link(item.title,item.url)); content.append(title);
    content.append(el('p', `${item.source} · ${item.published_at ? formatDate(item.published_at) : 'First seen ' + formatDate(item.first_seen_at)}${item.kind==='page_change' ? ' · Page change' : ''}`, 'meta'));
    content.append(el('p', item.why, 'why'));
    for (const [key, off, on] of [['read','Mark read','Read ✓'],['saved','Save','Saved ✓']]) {
      const button = el('button', prefs[item.url]?.[key] ? on : off); button.type='button'; button.setAttribute('aria-pressed',String(!!prefs[item.url]?.[key])); button.setAttribute('aria-label',`${button.textContent}: ${item.title}`); button.addEventListener('click',()=>toggle(item,key)); content.append(button, document.createTextNode(' '));
    }
    $('items').append(row);
  });
}
fetch('data.json', {cache:'no-cache'}).then(r=>{if(!r.ok) throw Error();return r.json();}).then(result=>{
  data = result;
  $('status').textContent = `Last checked ${new Date(data.updated_at).toLocaleString()} · ${data.sources.length} sources`;
  const failed=data.sources.filter(s=>s.status==='error').length, stale=Date.now()-new Date(data.updated_at).getTime()>36*3600000;
  if(failed || stale){$('notice').hidden=false;$('notice').textContent=(stale?'The latest update is more than 36 hours old. ':'')+(failed?`${failed} sources could not be checked. See source status below.`:'');}
  [...new Set(data.sources.flatMap(s=>s.categories))].sort().forEach(c=>{const option=el('option',c);option.value=c;$('category').append(option);});
  $('sources-title').textContent=`Followed sources (${data.sources.length})`;
  data.sources.forEach(source=>{const row=el('li');row.append(link(source.name,source.url),el('span',` — ${source.status==='feed'?'Article feed':source.status==='page_watch'?'Page watch':'Check failed'} · ${source.categories.join(', ')}`, 'meta'));$('sources').append(row);});
  render(); for(const id of ['search','category','view']) $(id).addEventListener('input',render);
}).catch(()=>{$('status').textContent='The reading list could not load. Please try again shortly.';});
