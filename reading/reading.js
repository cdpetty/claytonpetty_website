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
const topicRules = [
  ['Security', /\b(cyber\w*|secur\w*|malware|phishing|ransomware|vulnerabil\w*|hacker\w*|hacking|ciso|authentication|prompt injection)\b/i],
  ['AI & infrastructure', /\b(ai|agi|llms?|agents?|agentic|artificial intelligence|machine learning|deep learning|neural|models?|inference|gpu\w*|compute|data ?centers?|mcp|robot\w*|openai|anthropic|deepseek|claude|gemini)\b/i],
  ['China & geopolitics', /\b(china|chinese|taiwan|beijing|xi|prc|geopolit\w*|tariff\w*|military|war|drones?|iran|russia)\b/i],
  ['Startups & venture', /\b(startups?|founders?|venture|fundraising|funding|seed|series [a-f]|vc|vcs|lps?|entrepreneur\w*|go.to.market|saas|product.market|pricing|churn)\b/i],
  ['Finance & markets', /\b(financ\w*|fintech|invest\w*|stocks?|bonds?|bank\w*|crypto\w*|bitcoin|econom\w*|markets?|valuation|capital|ipo|revenue|liquidity)\b/i],
  ['Building & engineering', /\b(code|coding|software|programming|developer\w*|engineering|rust|python|javascript|typescript|database\w*|api|apis|debug\w*|compiler\w*|zig|design|interface|open.source)\b/i],
  ['Science & progress', /\b(science|scientific|research|biology|biological|health|medical|drug\w*|disease\w*|energy|climate|batter\w*|physics|brain|genetic\w*)\b/i],
];
const topicOrder = ['AI & infrastructure', 'Startups & venture', 'Security', 'Finance & markets', 'China & geopolitics', 'Building & engineering', 'Science & progress', 'Essays & ideas', 'Site updates'];
const sourceTopics = {AI:'AI & infrastructure',Cyber:'Security',China:'China & geopolitics',Finance:'Finance & markets',VC:'Startups & venture',Builders:'Building & engineering'};
function topicFor(item) {
  if (item.kind === 'page_change') return 'Site updates';
  const match = topicRules.find(([,rule])=>rule.test(item.title));
  if (match) return match[0];
  return (item.categories || []).map(c=>sourceTopics[c]).find(Boolean) || 'Essays & ideas';
}
const topicPages = new Map();
const pageSize = 3;
function render() {
  const search = $('search').value.toLowerCase(), category = $('category').value, view = $('view').value;
  const shown = data.items.filter(i => (!category || i.topic === category) && (i.title + ' ' + i.source).toLowerCase().includes(search) && (view !== 'unread' || !prefs[i.url]?.read) && (view !== 'saved' || prefs[i.url]?.saved));
  $('count').textContent = shown.length ? `${shown.length} items` : 'No items match this view.';
  $('items').replaceChildren();
  $('topic-nav').replaceChildren();
  for (const topic of topicOrder) {
    const articles = shown.filter(i=>i.topic===topic);
    if (!articles.length) continue;
    const id = 'topic-' + topicOrder.indexOf(topic);
    const jump = el('a', `${topic} (${articles.length})`); jump.href = '#' + id; $('topic-nav').append(jump);
    const section = el('section', '', 'topic-section'); section.id = id;
    const heading = el('h2', topic); heading.id = id + '-title';
    heading.append(el('span', ` ${articles.length}`, 'topic-count'));
    section.setAttribute('aria-labelledby', heading.id); section.append(heading);
    const list = el('ol'); section.append(list); $('items').append(section);
    const pageCount = Math.ceil(articles.length / pageSize);
    const page = Math.min(topicPages.get(topic) || 0, pageCount - 1);
    topicPages.set(topic,page);
    const visible = articles.slice(page * pageSize, (page + 1) * pageSize);
    visible.forEach((item, index) => {
    const row = el('li', '', 'article'), content = el('div'); row.append(el('span', String(page * pageSize + index + 1).padStart(2,'0'), 'rank'), content);
    const title = el('h3'); title.append(link(item.title,item.url)); content.append(title);
    content.append(el('p', `${item.source} · ${item.published_at ? formatDate(item.published_at) : 'First seen ' + formatDate(item.first_seen_at)}${item.kind==='page_change' ? ' · Page change' : ''}`, 'meta'));
    content.append(el('p', item.why, 'why'));
    for (const [key, off, on] of [['read','Mark read','Read ✓'],['saved','Save','Saved ✓']]) {
      const button = el('button', prefs[item.url]?.[key] ? on : off); button.type='button'; button.setAttribute('aria-pressed',String(!!prefs[item.url]?.[key])); button.setAttribute('aria-label',`${button.textContent}: ${item.title}`); button.addEventListener('click',()=>toggle(item,key)); content.append(button, document.createTextNode(' '));
    }
    list.append(row);
    });
    if (pageCount > 1) {
      const pagination = el('nav', '', 'topic-pagination'); pagination.setAttribute('aria-label', `${topic} pages`);
      const previous = el('button','← Previous'), next = el('button','Next →');
      previous.type=next.type='button'; previous.disabled=page===0; next.disabled=page===pageCount-1;
      previous.setAttribute('aria-label', `Previous articles in ${topic}`); next.setAttribute('aria-label', `Next articles in ${topic}`);
      const turnPage = delta => {topicPages.set(topic,page+delta);render();const buttons=document.getElementById(id).querySelectorAll('.topic-pagination button');const preferred=buttons[delta>0?1:0];(preferred.disabled ? buttons[delta>0?0:1] : preferred).focus({preventScroll:true});};
      previous.addEventListener('click',()=>turnPage(-1));next.addEventListener('click',()=>turnPage(1));
      pagination.append(previous,el('span',`${page*pageSize+1}–${Math.min((page+1)*pageSize,articles.length)} of ${articles.length}`,'page-label'),next);
      section.append(pagination);
    }
  }
}
fetch('data.json', {cache:'no-cache'}).then(r=>{if(!r.ok) throw Error();return r.json();}).then(result=>{
  data = result;
  data.items.forEach(item=>{item.topic=topicFor(item);});
  $('status').textContent = `Last checked ${new Date(data.updated_at).toLocaleString()} · ${data.sources.length} sources`;
  const failed=data.sources.filter(s=>s.status==='error').length, stale=Date.now()-new Date(data.updated_at).getTime()>36*3600000;
  if(failed || stale){$('notice').hidden=false;$('notice').textContent=(stale?'The latest update is more than 36 hours old. ':'')+(failed?`${failed} sources could not be checked. See source status below.`:'');}
  topicOrder.filter(topic=>data.items.some(i=>i.topic===topic)).forEach(c=>{const option=el('option',c);option.value=c;$('category').append(option);});
  $('sources-title').textContent=`Followed sources (${data.sources.length})`;
  data.sources.forEach(source=>{const row=el('li');row.append(link(source.name,source.url),el('span',` — ${source.status==='feed'?'Article feed':source.status==='page_watch'?'Page watch':'Check failed'} · ${source.categories.join(', ')}`, 'meta'));$('sources').append(row);});
  render(); for(const id of ['search','category','view']) $(id).addEventListener('input',()=>{topicPages.clear();render();});
}).catch(()=>{$('status').textContent='The reading list could not load. Please try again shortly.';});
