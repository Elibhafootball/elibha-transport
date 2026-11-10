import {JourneyEngine} from './journey-engine.js?v=20261110-8';
let stations=[],engine=null,base=300,windowStart=300,history=[],lastResults=[],searchSerial=0;const selected={from:null,to:null};
const $=id=>document.getElementById(id),norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const fmt=t=>String(Math.floor(t/60)%24).padStart(2,'0')+':'+String(t%60).padStart(2,'0')+(t>=1440?' +'+Math.floor(t/1440)+'d':'');
const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function setup(which){
 const input=$(which),list=$(which+'-list'),toggle=$(which+'-toggle');
 let active=-1,hits=[];
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');active=-1}
 function choose(item){input.value=item.name;selected[which]=item;close()}
 function show(forceAll=false){
   const q=norm(input.value.trim());
   selected[which]=null;active=-1;list.replaceChildren();
   hits=forceAll||!q?stations:stations.filter(s=>norm(s.name).startsWith(q));
   if(q&&!forceAll)hits.sort((a,b)=>Number(norm(b.name).startsWith(q))-Number(norm(a.name).startsWith(q))||a.name.localeCompare(b.name));
   const visible=forceAll||!q?hits:hits.slice(0,35);
   for(const item of visible){const b=element('button',null,item.name);b.type='button';b.setAttribute('role','option');const small=element('small',null,item.code);b.appendChild(small);b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>choose(item));list.appendChild(b)}
   list.hidden=!visible.length;input.setAttribute('aria-expanded',String(!!visible.length));
 }
 input.addEventListener('input',()=>show(false));
 input.addEventListener('focus',()=>show(!input.value.trim()));
 toggle.addEventListener('click',()=>{if(!list.hidden){close()}else{input.focus();show(true)}});
 input.addEventListener('keydown',e=>{
   if(e.key==='Escape'){close();return}
   const buttons=[...list.querySelectorAll('button')];
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
     e.preventDefault();if(list.hidden)show(true);
     const items=[...list.querySelectorAll('button')];
     active=(active+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
     items.forEach((b,i)=>b.classList.toggle('active',i===active));items[active]?.scrollIntoView({block:'nearest'});
   }
   if(e.key==='Enter'&&!list.hidden){e.preventDefault();(buttons[active>=0?active:0]||list.querySelector('button'))?.click()}
 });
 document.addEventListener('click',e=>{if(!input.parentElement.contains(e.target))close()});
}
function nav(){const div=element('div','nav');for(const [label,delta] of [['← Earlier',-1],['Later →',1]]){const b=element('button',null,label);b.disabled=delta<0&&history.length===0;b.addEventListener('click',()=>{if(delta<0){windowStart=history.pop()??base}else{history.push(windowStart);windowStart=lastResults.length?Math.max(windowStart+1,lastResults[lastResults.length-1].depart+1):windowStart+180}render()});div.appendChild(b)}return div}
function showStops(step){const details=element('details');const summary=element('summary',null,'Show all stops and times');details.appendChild(summary);const ul=element('ul','stops');const dayOffset=Math.floor((step.depart-step.service.stops[step.fromIndex][1])/1440)*1440;for(const [code,time] of step.service.stops.slice(step.fromIndex,step.toIndex+1)){const li=element('li');li.appendChild(element('strong',null,fmt(time+dayOffset)));li.appendChild(element('span',null,engine.names.get(code)||code));ul.appendChild(li)}details.appendChild(ul);return details}
const modeIcon={train:'🚆',metro:'🚇',ferry:'⛴️',flight:'✈️'};
const modeLabel={train:'Train',metro:'Underground',ferry:'Ferry',flight:'Flight'};
function place(code){return engine.names.get(code)||code}
function resultCard(r){
 const d=element('details','journey'),summary=element('summary','journey-summary');
 const rides=r.steps.filter(x=>x.type==='ride');
 const top=element('div','journey-top'),route=element('div','route-heading');
 const origin=element('div','endpoint');origin.appendChild(element('strong','times',fmt(r.depart)));origin.appendChild(element('span','station-name',place(r.steps[0].from)));
 const arrow=element('span','route-arrow','→');
 const destination=element('div','endpoint');destination.appendChild(element('strong','times',fmt(r.arrive)));destination.appendChild(element('span','station-name',place(r.steps[r.steps.length-1].to)));
 route.append(origin,arrow,destination);top.append(route,element('span','tag',r.rides===1?'Direct':(r.rides-1)+' change'+(r.rides===2?'':'s')));
 summary.appendChild(top);
 const detail=element('div','journey-overview');
 detail.appendChild(element('span','duration',Math.floor((r.arrive-r.depart)/60)+'h '+String((r.arrive-r.depart)%60).padStart(2,'0')+'m'));
 const itinerary=element('div','itinerary');
 for(let i=0;i<rides.length;i++){
   const leg=rides[i],mode=element('span','mode-chip mode-'+leg.service.mode,modeIcon[leg.service.mode]||'•');
   mode.title=modeLabel[leg.service.mode]||leg.service.mode;
   mode.setAttribute('aria-label',mode.title);itinerary.appendChild(mode);
   if(i<rides.length-1){
     const transfer=element('span','change-place',place(leg.to));
     itinerary.appendChild(transfer);
     itinerary.appendChild(element('span','change-arrow','›'));
   }
 }
 detail.appendChild(itinerary);summary.appendChild(detail);d.appendChild(summary);
 const body=element('div','journey-body');
 for(const step of r.steps){
   const leg=element('div','leg');
   if(step.type==='walk'){
     leg.appendChild(element('div','walk-leg','🚶 '+fmt(step.depart)+'–'+fmt(step.arrive)+' · Walk from '+place(step.from)+' to '+place(step.to)));
   }else{
     const heading=element('div','leg-heading');
     heading.appendChild(element('span','leg-mode',modeIcon[step.service.mode]||'•'));
     heading.appendChild(element('strong',null,fmt(step.depart)+' '+place(step.from)+' → '+fmt(step.arrive)+' '+place(step.to)));
     leg.appendChild(heading);
     leg.appendChild(element('div','subtle',modeLabel[step.service.mode]+' '+step.service.code+' · '+step.service.name));
     leg.appendChild(showStops(step));
   }
   body.appendChild(leg);
 }
 d.appendChild(body);return d;
}
async function render(){const serial=++searchSerial;const out=$('results');out.replaceChildren();if(!engine||!selected.from||!selected.to)return;
 $('status').textContent='Searching timetables…';await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));if(serial!==searchSerial)return;const start=windowStart;const results=engine.journeys(selected.from.code,selected.to.code,start,$('flights').checked,10);if(serial!==searchSerial)return;lastResults=results;
 const head=element('div','results-head');head.appendChild(element('h2',null,'Journeys from '+fmt(start)));head.appendChild(element('span','subtle',results.length+' results'));out.appendChild(head);out.appendChild(nav());
 if(!results.length)out.appendChild(element('p',null,'No journeys found in this time window. Try Later, or include flights.'));
 for(const r of results)out.appendChild(resultCard(r));out.appendChild(nav());$('status').textContent='Timetable search ready · '+( $('flights').checked?'Flights included':'Flights excluded');
}
async function init(){try{const [a,b,c]=await Promise.all(['./data/stations.json','./data/timetable.json','./data/config.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw Error(u+' could not be loaded');return r.json()})));stations=a;engine=new JourneyEngine(b,a,c);$('count').textContent=a.length+' locations · '+b.services.length+' scheduled services · '+b.transfers.length+' interchange connections';setup('from');setup('to');$('status').textContent='Ready to search the full Elibhan timetable.'}catch(e){$('status').textContent='Unable to load timetable: '+e.message;console.error(e)}}
$('reverse').addEventListener('click',()=>{
 const oldFrom=selected.from,oldTo=selected.to;
 selected.from=oldTo;selected.to=oldFrom;
 const fromValue=$('from').value,toValue=$('to').value;
 $('from').value=toValue;$('to').value=fromValue;
 $('from-list').hidden=true;$('to-list').hidden=true;
 $('from').setAttribute('aria-expanded','false');$('to').setAttribute('aria-expanded','false');
 if(selected.from&&selected.to&&selected.from.code!==selected.to.code){
   base=minutes($('time').value||'05:00');windowStart=base;history=[];render();
 }else{$('results').replaceChildren();$('status').textContent='Journey direction reversed. Select both stations to search.'}
});
$('search').addEventListener('click',()=>{if(!selected.from||!selected.to){$('status').textContent='Select both stations from the suggestions.';return}if(selected.from.code===selected.to.code){$('status').textContent='Choose two different locations.';return}base=minutes($('time').value||'05:00');windowStart=base;history=[];render()});init();
