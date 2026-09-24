'use strict';
const $ = id => document.getElementById(id);
let data, starredOnly=false;
let profiles=[];
const personKey=name=>(name||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").trim();
function sourcePeople(url){return profiles.filter(p=>p.source_urls.includes(url));}
function personFor(name,url){return sourcePeople(url).find(p=>[p.name,...(p.aliases||[])].some(n=>personKey(n)===personKey(name)));}
function profileUrl(person){return person.website||person.linkedin||person.profile;}
function authorByline(item){
  const line=el('span','','byline');line.title=item.source;
  if(!item.author){line.textContent=item.source;return line;}
  const exact=personFor(item.author,item.source_url);
  const names=exact?[item.author]:item.author.split(', ');
  names.forEach((name,index)=>{if(index)line.append(document.createTextNode(', '));const person=personFor(name,item.source_url);line.append(person?link(name,profileUrl(person)):document.createTextNode(name));});
  return line;
}
const starKey='reading-stars-v1';
let stars=new Map();
try {
  const saved=JSON.parse(localStorage.getItem(starKey)||'[]');
  if(Array.isArray(saved)) stars=new Map(saved.filter(i=>i && typeof i.url==='string' && /^https?:\/\//.test(i.url) && typeof i.title==='string').map(i=>[i.url,{...i,source:typeof i.source==='string'?i.source:'',categories:Array.isArray(i.categories)?i.categories:[]}]));
} catch {}
function toggleStar(item) {
  if(stars.has(item.url))stars.delete(item.url);else stars.set(item.url,{url:item.url,title:item.title,author:item.author||null,source_url:item.source_url||null,source:item.source,categories:item.categories||[],published_at:item.published_at,kind:'article',starred_at:new Date().toISOString()});
  try {localStorage.setItem(starKey,JSON.stringify([...stars.values()]));$('star-notice').hidden=true;}
  catch {$('star-notice').textContent='Your browser could not save stars. They will last for this visit only.';$('star-notice').hidden=false;}
  render();
  const button=[...document.querySelectorAll('.star')].find(b=>b.dataset.url===item.url);
  (button||$('starred')).focus({preventScroll:true});
}
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
  const daily=starredOnly?[...stars.values()].map(i=>({...i,topic:topicFor(i)})).sort((a,b)=>(b.starred_at||'').localeCompare(a.starred_at||'')):data.items.filter(i=>i.kind==='article' && dayOf(i.published_at)===day);
  $('starred').setAttribute('aria-pressed',String(starredOnly));
  $('starred').textContent=starredOnly?'★ Starred':'☆ Starred';
  $('date-controls').hidden=starredOnly;
  $('star-help').hidden=!starredOnly;
  const shown=daily.filter(i=>(i.title+' '+(i.author||'')+' '+i.source+' '+i.topic).toLowerCase().includes(search));
  $('items').replaceChildren();
  $('empty').hidden=shown.length>0;
  $('empty').textContent=daily.length?'No matching articles.':starredOnly?'Star an article to keep it here.':'No dated articles collected for this day yet. Try an earlier date.';
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
      const row=el('li');const article=link(item.title,item.url);article.title=item.source;
      const selected=stars.has(item.url),star=el('button',selected?'★':'☆','star');star.type='button';star.dataset.url=item.url;star.setAttribute('aria-pressed',String(selected));star.setAttribute('aria-label',`${selected?'Unstar':'Star'}: ${item.title}`);star.addEventListener('click',()=>toggleStar(item));
      const copy=el('div','','article-copy');copy.append(article);
      copy.append(authorByline(item));
      row.append(star,copy);list.append(row);
    });
  }
  packTopics();
}
function packTopics() {
  const grid=$('items'),sections=[...grid.querySelectorAll('.topic-section')];
  if(!sections.length)return;
  const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  sections.sort((a,b)=>Number(a.id.slice(6))-Number(b.id.slice(6)));
  grid.replaceChildren(...sections);
  if(columns===1)return;
  const measured=sections.map(section=>({section,height:section.getBoundingClientRect().height+8})).sort((a,b)=>b.height-a.height);
  const stacks=Array.from({length:columns},()=>({node:el('div','','topic-column'),height:0}));
  for(const {section,height} of measured){const stack=stacks.reduce((best,s)=>s.height<best.height?s:best);stack.node.append(section);stack.height+=height;}
  grid.replaceChildren(...stacks.map(s=>s.node));
}
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(packTopics,100);});
document.fonts.ready.then(packTopics);
function moveDay(amount) {
  const date=new Date($('day').value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);
  $('day').value=date.toISOString().slice(0,10);render();
}
const followingGroups=['AI & infrastructure','Startups & venture','Security','Finance & markets','China & geopolitics','Building & engineering','People & essays','General reading','Newsletters','Other'];
function sourceGroup(source) {
  const categories=source.categories||[];
  return categories.map(c=>sourceTopics[c]).find(Boolean)||(categories.includes('Solo blogs')?'People & essays':categories.includes('General')?'General reading':categories.includes('Newsletters')?'Newsletters':'Other');
}
function renderFollowing() {
  const query=$('following-search').value.toLowerCase().trim();
  const shown=data.sources.filter(s=>(s.name+' '+s.url+' '+sourceGroup(s)+' '+sourcePeople(s.url).map(p=>p.name+' '+(p.aliases||[]).join(' ')).join(' ')).toLowerCase().includes(query));
  $('following-count').textContent=`${shown.length} of ${data.sources.length} sources`;
  $('following-grid').replaceChildren();$('following-empty').hidden=shown.length>0;
  for(const group of followingGroups) {
    const sources=shown.filter(s=>sourceGroup(s)===group).sort((a,b)=>a.name.localeCompare(b.name));
    if(!sources.length)continue;
    const section=el('section','','following-group'),heading=el('h3',group+' · '+sources.length),list=el('ul');
    section.append(heading,list);
    sources.forEach(source=>{const row=el('li');row.append(link(source.name,source.url));const status=source.status==='feed'?'Article feed':source.status==='page_watch'?'Page watch':'Check failed';row.append(el('span',status,'following-status'));
      sourcePeople(source.url).forEach(person=>{const info=el('div','','person-links');info.append(link(person.name,profileUrl(person)));if(person.linkedin&&profileUrl(person)!==person.linkedin){info.append(document.createTextNode(' · '),link('LinkedIn',person.linkedin));}row.append(info);});list.append(row);});
    $('following-grid').append(section);
  }
}
Promise.all([
  fetch('data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}),
  fetch('people.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>({profiles:[]}))
]).then(([result,people])=>{
  profiles=people.profiles||[];
  data=result;data.items.forEach(item=>{item.topic=topicFor(item);if(stars.has(item.url)){const saved=stars.get(item.url);if(item.author)saved.author=item.author;saved.source_url=item.source_url;}});
  try {localStorage.setItem(starKey,JSON.stringify([...stars.values()]));} catch {}
  $('day').value=today;$('day').max=today;
  $('status').textContent='Updated '+new Date(data.updated_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const failed=data.sources.filter(s=>s.status==='error');
  $('source-status').textContent=(failed.length?`${failed.length} sources could not be checked; they will retry daily. `:'')+'Dates use Pacific time. Undated articles and general page changes are excluded from the daily view.';
  $('following').disabled=false;
  $('following').addEventListener('click',()=>{renderFollowing();$('following-dialog').showModal();});
  $('following-close').addEventListener('click',()=>$('following-dialog').close());
  $('following-search').addEventListener('input',renderFollowing);
  render();$('starred').addEventListener('click',()=>{starredOnly=!starredOnly;render();});$('search').addEventListener('input',render);$('day').addEventListener('change',()=>{if(!$('day').value || $('day').value>today)$('day').value=today;render();});
  $('previous-day').addEventListener('click',()=>moveDay(-1));$('next-day').addEventListener('click',()=>moveDay(1));$('today').addEventListener('click',()=>{$('day').value=today;render();});
}).catch(()=>{$('status').textContent='Could not load articles. Please reload.';});
