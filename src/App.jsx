import {useState,useEffect,useMemo} from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import MapView from './MapView.jsx';
import {ZONES,ZN,CIRCLES,friends,journeys as baseJ,NOW,users,drivers,communities,routes as rts,history as baseH} from './data.js';
import {makeRoutes,match,formPool,reassign,predict,analytics,fmtT,LOCKS,PRI,W0,driverOf} from './engine.js';
const KEY='poolgrid-v1';
const F0={from:'Anna Nagar',to:'Guindy',via:'',leave:60,budget:60,mode:'friends',circle:'College',sel:['u1','u2'],routeId:'B',lock:'exact',priority:'balanced'};
const S0={form:F0,reservation:null,cancelled:[],notes:[],extra:[],extraDemand:[],pools:0,history:[],traffic:1,tab:'plan',res:null};
const load=()=>{try{return{...S0,...JSON.parse(localStorage.getItem(KEY))}}catch{return S0}};
const pct=x=>Math.round(x*100)+'%';
const NAMES={route:'Route overlap',time:'Time',capacity:'Capacity',budget:'Budget',trust:'Trust signals',pickup:'Pickup convenience'};
function Score({m,q}){const w=PRI[q.priority]||W0;return <div><div className="big" aria-live="polite">{pct(m.score)} AI match</div>{Object.keys(NAMES).map(k=><div key={k} style={{margin:'5px 0'}}><div className="row" style={{justifyContent:'space-between'}}><span>{NAMES[k]} <small>(weight {pct(w[k])})</small></span><b>{pct(m.parts[k])}</b></div><div className="bar"><i style={{width:pct(m.parts[k])}}/></div></div>)}<h2>Why this match?</h2><ul>{m.reasons.map(r=><li key={r}>{r}</li>)}</ul></div>}
export default function App(){
 const [s,setS]=useState(load),[busy,setBusy]=useState(''),[sel,setSel]=useState(0);
 const set=p=>setS(o=>({...o,...(typeof p==='function'?p(o):p)}));
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify({...s,res:null}))},[s]);
 const f=s.form,setF=p=>set({form:{...f,...p},res:null});
 const js=useMemo(()=>[...baseJ,...s.extra],[s.extra]);
 const group=f.mode==='friends'||f.mode==='selected'?1+f.sel.length:1;
 const routes=useMemo(()=>makeRoutes(ZONES[f.from],ZONES[f.to],f.via?ZONES[f.via]:null,s.traffic),[f.from,f.to,f.via,s.traffic]);
 const route=routes.find(r=>r.id===f.routeId)||routes[0];
 const q={...f,group,route,target:NOW+f.leave,traffic:s.traffic,circle:f.mode==='community'?f.circle:'any'};
 const notify=(t)=>set(o=>({notes:[{t,at:Date.now()},...o.notes].slice(0,30),toast:t}));
 useEffect(()=>{if(s.toast){const i=setTimeout(()=>set({toast:null}),3500);return()=>clearTimeout(i)}},[s.toast]);
 const pred=predict(q,js,s.cancelled),an=analytics(js,s),go=t=>set({tab:t});
 const search=()=>{if(f.from===f.to)return notify('Invalid route: origin and destination are the same.');
  const msgs=['Analyzing nearby mobility...','Checking future journeys...','Comparing routes...','Calculating compatibility...','Optimizing pickup...','Forming pool...'];let i=0;setBusy(msgs[0]);const t=setInterval(()=>setBusy(msgs[++i%6]),260);
  setTimeout(()=>{clearInterval(t);setBusy('');setSel(0);set({res:match(q,js,s.cancelled),tab:'matches'})},1000)};
 const members=f.sel.map(id=>friends.find(x=>x.id===id)?.name);
 const confirm=m=>{if(s.reservation&&['confirmed','in-progress'].includes(s.reservation.status))return notify('You already have an active reservation. Complete or cancel it first.');
  set({reservation:{status:'confirmed',m,q:{...q,route:{id:route.id}},members,pool:formPool(m,q,members),id:'R'+Date.now()%100000},tab:'trip'});notify('Your seat has been confirmed.')};
 const cancelDriver=()=>{const r=s.reservation;if(!r||!['confirmed','in-progress'].includes(r.status))return notify('Reserve a seat first, then simulate a driver cancellation.');
  const c=[...s.cancelled,r.m.d.id];notify('Driver cancelled. AI searching alternative mobility...');
  const alt=reassign({...q,route,group:r.q.group,mode:r.q.mode,circle:r.q.circle,target:r.m.j.dep},js,c);
  if(!alt)return set({cancelled:c,reservation:{...r,status:'no-backup'}}),notify('No backup pool found. Widen your route lock or time.');
  set({cancelled:c,reservation:{...r,m:alt,pool:formPool(alt,q,r.members),status:'confirmed',reassigned:true,prev:r.m.d.name}});notify('AI found an alternative. Your reservation has been preserved.')};
 const life=st=>{const r=s.reservation;if(!r)return;if(st==='done'){set({reservation:{...r,status:'completed'},history:[{id:r.id,from:r.q.from,to:r.q.to,km:r.m.j.km,saved:Math.round(r.m.price*.6)},...s.history]});notify('Journey completed and added to history.')}else{set({reservation:{...r,status:'in-progress'}});notify('Your driver is 5 minutes away. Journey started.')}};
 const sim=k=>{const r=s.reservation;({
  driver:cancelDriver,
  passenger:()=>{if(!r)return notify('No reservation to cancel.');set({reservation:{...r,status:'cancelled'}});notify('Passenger cancelled. Seats released to the pool.')},
  traffic:()=>{set({traffic:+(s.traffic*1.25).toFixed(2),res:null});notify(`Traffic up. Routes and prices recalculated (x${(s.traffic*1.25).toFixed(2)}).`)},
  driverNew:()=>{const k2=[.22,.08][s.extra.length%2],a=ZONES[f.from],b=ZONES[f.to],pts=makeRoutes(a,b,null)[k2>.1?1:0].pts;set({extra:[...s.extra,{id:'jx'+s.extra.length,driverId:drivers[s.extra.length%80].id,from:f.from,to:f.to,k:k2,pts,km:route.km,dep:q.target,seats:4,price:Math.round(route.km*3.4),min:route.min}],res:null});notify('New driver joined this corridor.')},
  demand:()=>{set({extraDemand:[...s.extraDemand,{from:f.from,to:f.to,seats:2,status:'confirmed'}]});notify('New reservation added to demand.')},
  disrupt:()=>{const n=routes.find(x=>x.id!==f.routeId);setF({routeId:n.id});notify(`Route ${f.routeId} disrupted. Switched to Route ${n.id}.`)},
  pool:()=>{set({pools:s.pools+1});notify('Pool formed from waiting riders.')}})[k]()};
 const tabs=[['plan','Plan'],['matches','Matches'],['trip','Trip'],['friends','Circles'],['driver','Driver'],['intel','Intelligence']];
 const r=s.reservation,list=s.res?.list||[],cur=list[sel];
 return <div className="app">
  {s.toast&&<div className="toast" role="status"><div>{s.toast}</div></div>}
  <h1>PoolGrid <small style={{color:'var(--mut)',fontWeight:400}}>Community mobility. Prototype with demo data.</small></h1>
  <p style={{margin:'0 0 6px',color:'var(--mut)'}}>You choose when, where, how and with whom. AI coordinates seats that already exist.</p>
  {s.tab==='plan'&&<div className="two"><div>
   <div className="card glass"><h2>Where are you going?</h2><div className="grid">
    <label>From<select value={f.from} onChange={e=>setF({from:e.target.value})}>{ZN.map(z=><option key={z}>{z}</option>)}</select></label>
    <label>To<select value={f.to} onChange={e=>setF({to:e.target.value})}>{ZN.map(z=><option key={z}>{z}</option>)}</select></label>
    <label>Stop on the way<select value={f.via} onChange={e=>setF({via:e.target.value})}><option value="">None</option>{ZN.filter(z=>z!==f.from&&z!==f.to).map(z=><option key={z}>{z}</option>)}</select></label>
    <label>When<select value={f.leave} onChange={e=>setF({leave:+e.target.value})}><option value={0}>Now</option><option value={30}>In 30 min</option><option value={60}>In 1 hour</option><option value={120}>In 2 hours</option></select></label>
    <label>Budget per person (Rs)<input type="number" min="10" value={f.budget} onChange={e=>setF({budget:+e.target.value||10})}/></label>
    <label>Travel with<select value={f.mode} onChange={e=>setF({mode:e.target.value})}><option value="anyone">Anyone verified</option><option value="community">Trusted community</option><option value="friends">Friends</option><option value="selected">Selected people</option></select></label>
    <label>Priority<select value={f.priority} onChange={e=>setF({priority:e.target.value})}><option value="balanced">Balanced</option><option value="safety">Safety preference</option><option value="price">Price</option><option value="speed">Speed</option></select></label>
    <label>Route lock<select value={f.lock} onChange={e=>setF({lock:e.target.value})}>{Object.entries(LOCKS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
   </div>
   {f.mode==='community'&&<p><label>Match only within<select value={f.circle} onChange={e=>setF({circle:e.target.value})}>{CIRCLES.map(c=><option key={c}>{c}</option>)}</select></label></p>}
   {(f.mode==='friends'||f.mode==='selected')&&<div><h2>Choose friends ({f.sel.length} selected)</h2><div className="row">{friends.map(x=><button key={x.id} className={f.sel.includes(x.id)?'sel alt':'alt'} aria-pressed={f.sel.includes(x.id)} onClick={()=>setF({sel:f.sel.includes(x.id)?f.sel.filter(i=>i!==x.id):[...f.sel,x.id].slice(0,3)})}>{x.name}</button>)}</div>{!f.sel.length&&<p className="err card">No friends selected. Choose at least one, or switch to Anyone verified.</p>}</div>}
   </div>
   <div className="card"><h2>Choose a route</h2><div className="row">{routes.map(x=><button key={x.id} className={x.id===f.routeId?'sel alt':'alt'} onClick={()=>setF({routeId:x.id})}>Route {x.id}<br/>{x.km} km, {x.min} min, Rs {x.fare}</button>)}</div></div>
   <div className="card"><b>Future availability {pred.window}</b><p>{pred.drivers} compatible drivers, {pred.seats} predicted seats, {pred.pools} potential pools for {group}.</p>{!pred.drivers&&<p className="err card">No future capacity in this window. Try a different time.</p>}</div>
   <button className="amb" style={{width:'100%'}} disabled={!!busy} onClick={search}>{busy||'Reserve my seat'}</button>
  </div><MapView routes={routes} selected={f.routeId} from={ZONES[f.from]} to={ZONES[f.to]}/></div>}
  {s.tab==='matches'&&<div>
   {!s.res&&<div className="card">Nothing searched yet. <button onClick={()=>go('plan')}>Plan a trip</button></div>}
   {s.res&&!list.length&&<div className="card err"><h2>No matching rides</h2><p>Filtered out: {Object.entries(s.res.rej).map(([k,v])=>`${v} by ${k}`).join(', ')}. Loosen route lock, raise budget, or shift time.</p><button onClick={()=>go('plan')}>Change plan</button></div>}
   {cur&&<div className="two"><div>
    <div className="row">{list.slice(0,3).map((m,i)=><button key={m.j.id} className={i===sel?'sel alt':'alt'} onClick={()=>setSel(i)}>{fmtT(m.j.dep)}<br/>Rs {m.price}, {pct(m.score)}</button>)}</div>
    <div className="card"><Score m={cur} q={q}/><p>Driver <b>{cur.d.name}</b> ({cur.d.rating} rating, {cur.d.trips} trips) in a {cur.d.vehicle.model}, {cur.j.seats} seats free. <span className="pill">Verified trust signals</span></p><p>Group: You{members.length?', '+members.join(', '):''} ({group}). Cost per person Rs {cur.price}. Pickup {cur.pk.walk} m from you.</p><button className="amb" onClick={()=>confirm(cur)}>Confirm reservation</button></div>
   </div><MapView routes={[route]} selected={route.id} journey={cur.j} pickup={cur.pk.point} from={ZONES[f.from]} to={ZONES[f.to]}/></div>}
  </div>}
  {s.tab==='trip'&&(!r?<div className="card err"><h2>No reservation</h2><p>Reserve a seat to see your trip here.</p><button onClick={()=>go('plan')}>Plan a trip</button></div>:
   <div className="two"><div><div className="card"><div className="row"><span className="pill">{r.status.toUpperCase()}</span><b>{r.q.from} to {r.q.to}</b></div>
    {r.status==='no-backup'&&<p className="err card">Driver cancelled and no backup pool matched. Search again with a wider route lock.</p>}
    {r.reassigned&&<p className="card">Original driver {r.prev} became unavailable. Alternative pool found and your reservation is preserved.</p>}
    <p>Driver {r.m.d.name}, {r.m.d.vehicle.model}. Departs {fmtT(r.m.j.dep)}. Rs {r.m.price} each. Pool: {r.pool.members.join(', ')} with {r.pool.seatsLeft} seat(s) left.</p>
    <p>Pickup point {r.m.pk.walk} m walk. Route {r.q.route.id}, lock {LOCKS[r.q.lock].label}.</p><Score m={r.m} q={r.q}/>
    <div className="row"><button disabled={r.status!=='confirmed'} onClick={()=>life('start')}>Start journey</button><button disabled={r.status!=='in-progress'} onClick={()=>life('done')}>Complete journey</button><button className="alt" onClick={()=>sim('driver')}>Simulate driver cancellation</button></div></div></div>
    <MapView routes={[route]} selected={route.id} journey={r.m.j} pickup={r.m.pk.point} backup={r.reassigned} from={ZONES[r.q.from]} to={ZONES[r.q.to]}/></div>)}
  {s.tab==='friends'&&<div className="card"><h2>Trusted circles</h2><p>Circle membership changes who can be matched. Pick Trusted community on Plan.</p><div className="grid">{CIRCLES.map(c=><div className="card" key={c}><b>{c}</b><p>{communities.filter(x=>x.type===c).length} communities, {users.filter(u=>u.circles.includes(c)).length} members, {drivers.filter(d=>d.circles.includes(c)).length} drivers</p><button className="alt" onClick={()=>{setF({mode:'community',circle:c});go('plan')}}>Match only in {c}</button></div>)}</div>
   <h2>Friends</h2><div className="row">{friends.map(x=><span className="pill" key={x.id}>{x.name}</span>)}</div></div>}
  {s.tab==='driver'&&<div className="card"><h2>Driver: today's journeys</h2>{(()=>{const d=drivers[0],mine=js.filter(j=>j.driverId===d.id);return <><p>{d.name}, {d.rating} rating, {d.trips} trips. Identity, driver and vehicle checks are shown as trust signals, not safety guarantees.</p>{mine.slice(0,4).map(j=><div key={j.id} className="card">{j.from} to {j.to}, {fmtT(j.dep)}, {j.seats} seats, {j.km} km</div>)}<p>Passengers on your journeys: {r&&r.m.d.id===d.id?r.pool.members.join(', '):'none yet'}</p></>})()}
   <button className="amb" onClick={()=>sim('driverNew')}>Create journey on {f.from} to {f.to} at {fmtT(q.target)}</button></div>}
  {s.tab==='intel'&&<div>
   <div className="grid">{[['Active journeys',an.active],['Available seats',an.avail],['Reserved seats',an.reserved],['Active pools',an.pools],['Potential pools',an.potential],['Reservations',220+s.extraDemand.length]].map(([a,b])=><div className="card" key={a}><div className="big">{b}</div>{a}</div>)}</div>
   <div className="two"><div className="card"><h2>Empty seats by zone</h2><div style={{height:220}}><ResponsiveContainer><BarChart data={an.seatsByZone}><XAxis dataKey="k" tick={{fontSize:9}} interval={0} angle={-30} height={50}/><YAxis/><Tooltip/><Bar dataKey="v" fill="#0f8b8d"/></BarChart></ResponsiveContainer></div></div>
   <div className="card"><h2>Demand by corridor</h2><div style={{height:220}}><ResponsiveContainer><BarChart data={an.demand}><XAxis dataKey="k" tick={{fontSize:9}} interval={0} angle={-30} height={70}/><YAxis/><Tooltip/><Bar dataKey="v" fill="#f5a524"/></BarChart></ResponsiveContainer></div><p>{an.demand.slice(0,3).map(d=>d.k).join('; ')}: high demand</p></div></div>
   <div className="card"><h2>Mobility impact (prototype estimate)</h2><p>{an.impact.pooled} pooled trips, {an.impact.sharedKm} shared km, {an.impact.consolidated} vehicle trips potentially consolidated, about Rs {an.impact.saved} saved, about {an.impact.co2} kg CO2 avoided. Demo data only.</p></div>
   <div className="card"><h2>Demo simulation</h2><div className="row">{[['driver','Driver cancellation'],['passenger','Passenger cancellation'],['traffic','Traffic increase'],['driverNew','New driver'],['demand','New reservation'],['disrupt','Route disruption'],['pool','Pool formation']].map(([k,l])=><button key={k} className="alt" onClick={()=>sim(k)}>Simulate {l}</button>)}</div>
   <button style={{marginTop:8}} className="alt" onClick={()=>{localStorage.removeItem(KEY);setS(S0)}}>Reset demo</button></div>
   <div className="card"><h2>Notifications</h2>{s.notes.length?s.notes.map(n=><div key={n.at}>{n.t}</div>):'No notifications yet.'}</div></div>}
  <nav aria-label="Main">{tabs.map(([k,l])=><button key={k} className={s.tab===k?'on':''} aria-current={s.tab===k} onClick={()=>go(k)}>{l}</button>)}</nav>
 </div>}
