'use strict';
const $ = id => document.getElementById(id);
let data;
function el(tag, text, cls) { const node=document.createElement(tag); if(text) node.textContent=text; if(cls) node.className=cls; return node; }
function link(text,url) { const node=el('a',text); try { const u=new URL(url); if(['https:','http:'].includes(u.protocol)) node.href=u.href; } catch {} node.target='_blank'; node.rel='noopener noreferrer'; return node; }
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
function dayOf(value) {
  if(!value) return null;
  const date=new Date(value);if(Number.isNaN(date.getTime()))return null;
  return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Los_Angeles'}).format(date);
}
const today=dayOf(new Date().toISOString());
function render() {
  const search=$('search').value.toLowerCase().trim(),day=$('day').value;
  const daily=data.items.filter(i=>i.kind==='article' && dayOf(i.published_at)===day);
  const shown=daily.filter(i=>(i.title+' '+i.source+' '+i.topic).toLowerCase().includes(search));
  $('items').replaceChildren();
  $('empty').hidden=shown.length>0;
  $('empty').textContent=daily.length?'No matching articles.':'No dated articles collected for this day yet. Try an earlier date.';
  $('daily-count').textContent=`${shown.length} article${shown.length===1?'':'s'}`;
  $('next-day').disabled=day>=today;
  for(const topic of topicOrder) {
    const articles=shown.filter(i=>i.topic===topic);
    if(!articles.length) continue;
    const id='topic-'+topicOrder.indexOf(topic);
    const section=el('section','','topic-section');section.id=id;
    const heading=el('h2',topic);heading.id=id+'-title';section.setAttribute('aria-labelledby',heading.id);section.append(heading);
    const list=el('ul');section.append(list);$('items').append(section);
    articles.forEach(item=>{
      const row=el('li');const article=link(item.title,item.url);article.title=item.source;row.append(article);list.append(row);
    });
  }
}
function moveDay(amount) {
  const date=new Date($('day').value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);
  $('day').value=date.toISOString().slice(0,10);render();
}
fetch('data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(result=>{
  data=result;data.items.forEach(item=>{item.topic=topicFor(item);});
  $('day').value=today;$('day').max=today;
  $('status').textContent='Updated '+new Date(data.updated_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const failed=data.sources.filter(s=>s.status==='error');
  $('source-status').textContent=(failed.length?`${failed.length} sources could not be checked; they will retry daily. `:'')+'Dates use Pacific time. Undated articles and general page changes are excluded from the daily view.';
  data.sources.forEach(s=>{const row=el('li');row.append(link(s.name,s.url));if(s.status==='error')row.append(document.createTextNode(' — check failed'));$('sources').append(row);});
  render();$('search').addEventListener('input',render);$('day').addEventListener('change',()=>{if(!$('day').value || $('day').value>today)$('day').value=today;render();});
  $('previous-day').addEventListener('click',()=>moveDay(-1));$('next-day').addEventListener('click',()=>moveDay(1));$('today').addEventListener('click',()=>{$('day').value=today;render();});
}).catch(()=>{$('status').textContent='Could not load articles. Please reload.';});
