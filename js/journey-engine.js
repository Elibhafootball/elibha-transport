// Elibha timetable journey planner. Times are minutes since a timetable day starts.
export class JourneyEngine {
  constructor(data, stations, config) {
    this.services=data.services;this.stations=stations;this.config=config;
    this.names=new Map(stations.map(s=>[s.code,s.name]));
    this.byStation=new Map();this.walk=new Map();this.departures=new Map();
    for(const [a,b,t] of data.transfers){if(!this.walk.has(a))this.walk.set(a,[]);this.walk.get(a).push({to:b,time:t})}
    for(const service of this.services){
      for(let i=0;i<service.stops.length-1;i++){
        const [from,depart]=service.stops[i];
        if(!this.byStation.has(from))this.byStation.set(from,[]);
        for(let j=i+1;j<service.stops.length;j++){
          const [to,arrive]=service.stops[j];
          this.byStation.get(from).push({service,from,to,depart,arrive,fromIndex:i,toIndex:j});
        }
      }
    }
    for(const [code,edges] of this.byStation) {
      edges.sort((a,b)=>a.depart-b.depart);
      this.departures.set(code,[...new Set(edges.map(e=>e.depart%1440))].sort((a,b)=>a-b));
    }
  }
  airport(code){return (this.names.get(code)||'').includes('International Airport')}
  walkTime(from,to,minutes,lastMode) {
    // Rail-to-flight / flight-to-rail airport interchange allowances are all-inclusive.
    if(this.airport(to)&&lastMode==='train')return 60;
    if(this.airport(from)&&lastMode==='flight')return 30;
    return Math.max(2,minutes);
  }
  connectionTime(lastMode,nextMode,changed) {
    if(!changed)return 0;
    if(nextMode==='flight'&&lastMode==='train')return 60;
    if(lastMode==='flight'&&nextMode==='train')return 30;
    return 2;
  }
  // Earliest-arrival, bounded-transfer time-dependent label search.
  route(from,to,earliest,includeFlights,maxLegs=8){
    const labels=new Map(),queue=[];let seq=0;
    const add=l=>{const key=l.at+'|'+l.mode+'|'+l.legs+'|'+(l.walked?'w':'n');const old=labels.get(key);if(old&&old.time<=l.time)return;labels.set(key,l);queue.push({...l,key,seq:seq++})};
    add({at:from,time:earliest,mode:'start',legs:0,walked:false,path:[],first:null});
    let best=null,iterations=0;
    while(queue.length&&iterations++<25000){
      queue.sort((a,b)=>b.time-a.time);const current=queue.pop();
      if(labels.get(current.key)?.time!==current.time)continue;
      if(best&&current.time>=best.time)continue;
      if(current.at===to&&current.path.length){best=current;continue}
      if(current.time-earliest>1800)continue;
      for(const w of this.walk.get(current.at)||[]){
        const mins=this.walkTime(current.at,w.to,w.time,current.mode);
        add({...current,at:w.to,time:current.time+mins,walked:true,path:[...current.path,{type:'walk',from:current.at,to:w.to,depart:current.time,arrive:current.time+mins}]});
      }
      if(current.legs>=maxLegs)continue;
      const edges=this.byStation.get(current.at)||[];
      for(const edge of edges){
        if(edge.service.mode==='flight'&&!includeFlights)continue;
        // Repeat the daily timetable across the relevant day boundaries.
        const buffer=current.mode==='start'?0:current.walked?0:this.connectionTime(current.mode,edge.service.mode,true);
        const ready=current.time+buffer;
        const offset=Math.ceil((ready-edge.depart)/1440);
        const depart=edge.depart+offset*1440;
        if(depart<ready||depart-current.time>240||depart-earliest>900)continue;
        const arrive=edge.arrive+offset*1440;
        if(best&&arrive>=best.time)continue;
        const step={type:'ride',service:edge.service,from:edge.from,to:edge.to,depart,arrive,fromIndex:edge.fromIndex,toIndex:edge.toIndex};
        add({at:edge.to,time:arrive,mode:edge.service.mode,legs:current.legs+1,walked:false,path:[...current.path,step],first:current.first??depart});
      }
    }
    return best?{depart:best.first??earliest,arrive:best.time,steps:best.path,rides:best.legs}:null;
  }
  journeys(from,to,start,includeFlights=false,limit=10){
    const seeds=new Set([start]);const frontier=[{code:from,time:0}];const seen=new Set([from]);
    // Include origins reachable via an initial station-to-terminal transfer.
    while(frontier.length){const cur=frontier.shift();for(const w of this.walk.get(cur.code)||[]){if(seen.has(w.to))continue;seen.add(w.to);frontier.push({code:w.to,time:cur.time+Math.max(2,w.time)})}}
    for(const code of seen)for(const d of this.departures.get(code)||[])for(let day=0;day<=2;day++){const at=d+day*1440;if(at>=start&&at<start+900)seeds.add(at)}
    const ordered=[...seeds].sort((a,b)=>a-b);const results=[],keys=new Set();
    // Group near-identical results by the actual boarded services and arrival.
    for(const seed of ordered.slice(0,55)){
      const r=this.route(from,to,seed,includeFlights);
      if(!r)continue;
      const signature=r.steps.filter(s=>s.type==='ride').map(s=>s.service.id).join('|');
      if(keys.has(signature))continue;
      keys.add(signature);results.push(r);
      if(results.length>=limit*2)break;
    }
    // Also preserve direct rides, even when a connecting route is faster.
    for(const s of this.services){
      if(s.mode==='flight'&&!includeFlights)continue;
      const a=s.stops.findIndex(x=>x[0]===from),b=s.stops.findIndex((x,i)=>i>a&&x[0]===to);
      if(a<0||b<0)continue;
      for(let day=0;day<=2;day++){const dep=s.stops[a][1]+1440*day;if(dep<start||dep>start+900)continue;const sig=s.id;if(keys.has(sig))continue;keys.add(sig);results.push({depart:dep,arrive:s.stops[b][1]+1440*day,rides:1,steps:[{type:'ride',service:s,from,to,depart:dep,arrive:s.stops[b][1]+1440*day,fromIndex:a,toIndex:b}]})}
    }
    results.sort((a,b)=>a.depart-b.depart||a.arrive-b.arrive);
    // Hide strictly inferior itineraries that depart at the same time and arrive later
    // with more changes, but retain direct services as passenger choices.
    const chosen=[];
    for(const r of results){const rides=r.steps.filter(x=>x.type==='ride');if(!rides.length)continue;
      if(chosen.some(x=>x.depart===r.depart&&x.arrive<=r.arrive&&x.rides<=r.rides))continue;
      chosen.push(r);
    }
    return chosen.slice(0,limit);
  }
}
