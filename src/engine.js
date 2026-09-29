// Deterministic local AI engine: match, route, prediction, pool, trust, pickup, reassignment.
import {hav,bez,plen,near} from './geo.js';
import {ZONES,drivers,reservations} from './data.js';
const cl=x=>Math.max(0,Math.min(1,x));
export const W0={route:.3,time:.2,capacity:.15,budget:.1,trust:.15,pickup:.1};
export const PRI={balanced:W0,safety:{route:.25,time:.15,capacity:.15,budget:.05,trust:.3,pickup:.1},price:{route:.25,time:.15,capacity:.15,budget:.25,trust:.1,pickup:.1},speed:{route:.35,time:.3,capacity:.1,budget:.05,trust:.1,pickup:.1}};
export const LOCKS={exact:{label:'Exact route',tol:350},'500':{label:'Up to 500 m',tol:500},'1000':{label:'Up to 1 km',tol:1000},ai:{label:'AI optimized',tol:2500}};
export const fmtT=m=>new Date(m*60000).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
export function makeRoutes(a,b,via,traffic=1){const sp=[26,34,22];return [.08,.22,-.2].map((k,i)=>{const pts=via?[...bez(a,via,k,12),...bez(via,b,k,12).slice(1)]:bez(a,b,k),km=plen(pts)/1000;return{id:'ABC'[i],k,pts,km:+km.toFixed(1),min:Math.round((km/sp[i]*60+(via?6:0))*traffic),fare:Math.round(km*3.6)}})}
export const driverOf=id=>drivers.find(d=>d.id===id);
export function trust(d,circle){const s=[['Identity verified',d.idv],['Driver verified',d.drv],['Vehicle verified',d.veh]];const v=.2*d.idv+.15*d.drv+.15*d.veh+.2*Math.min(d.trips/300,1)+.15*cl(1-d.cancel*8)+.15*d.rating/5;const inC=circle&&circle!=='any'&&d.circles.includes(circle);return{score:cl(v+(inC?.1:0)),signals:s.filter(x=>x[1]).map(x=>x[0]),inCircle:inC}}
export function pickup(origin,j){const n=near(origin,j.pts),walk=Math.round(n.d);return{point:j.pts[n.i],walk,label:walk<400?'Short walk':'Moderate walk'}}
export function match(q,js,exclude=[]){
 const from=ZONES[q.from],to=ZONES[q.to],route=q.route,tol=LOCKS[q.lock].tol,w=PRI[q.priority]||W0,target=q.target,rej={time:0,capacity:0,route:0,trust:0,budget:0},out=[];
 for(const j of js){if(exclude.includes(j.driverId))continue;const dt=Math.abs(j.dep-target);if(dt>30){rej.time++;continue}
  if(j.seats<q.group){rej.capacity++;continue}const d=driverOf(j.driverId),t=trust(d,q.circle);
  if(q.mode==='community'&&!t.inCircle||d.rating<3.5||(q.mode==='friends'||q.mode==='selected')&&t.score<.7){rej.trust++;continue}
  const pk=pickup(from,j),dd=hav(to,j.pts[j.pts.length-1]);
  const samp=route.pts.filter((_,i)=>i%2===0),ov=samp.reduce((s,p)=>s+cl(1-near(p,j.pts).d/(tol*2.5)),0)/samp.length;
  if(pk.walk>1500||dd>3000||(q.lock==='exact'&&ov<.55)){rej.route++;continue}
  const jp=j.price*(q.traffic||1),parts={route:ov,time:cl(1-dt/30),capacity:cl(.6+.4*(j.seats-q.group)/3),budget:jp<=q.budget?1:cl(1-(jp-q.budget)/q.budget),trust:t.score,pickup:cl(1-pk.walk/1000)};
  if(parts.budget<.2){rej.budget++;continue}
  const score=Object.keys(w).reduce((s,k)=>s+w[k]*parts[k],0);
  out.push({j,d,parts,score,t,pk,price:Math.round(jp),dd:Math.round(dd),reasons:[`${Math.round(ov*100)}% of your ${route.id} route overlaps this journey`,`Leaves ${fmtT(j.dep)}, ${Math.round(dt)} min from your target`,`${j.seats} seats free for a group of ${q.group}`,`Rs ${Math.round(jp)} per person vs Rs ${q.budget} budget`,`Trust signals: ${t.signals.join(', ')||'none'}${t.inCircle?`, member of ${q.circle}`:''}`,`AI pickup ${pk.walk} m from you, driver detour 0 m`]})}
 out.sort((a,b)=>b.score-a.score);return{list:out,rej}}
export const formPool=(m,q,members)=>({driver:m.d,vehicle:m.d.vehicle,members:['You',...members],seatsLeft:m.j.seats-q.group,perPerson:m.price});
export const reassign=(q,js,cancelled)=>match(q,js,cancelled).list[0]||null;
export function predict(q,js,exclude=[]){const from=ZONES[q.from],to=ZONES[q.to];const c=js.filter(j=>!exclude.includes(j.driverId)&&Math.abs(j.dep-q.target)<=20&&hav(from,j.pts[0])<3500&&hav(to,j.pts[j.pts.length-1])<3500);const seats=c.reduce((s,j)=>s+j.seats,0);return{drivers:c.length,seats,pools:Math.floor(seats/Math.max(q.group,1)),window:`${fmtT(q.target-20)}-${fmtT(q.target+20)}`}}
export function analytics(js,st){const act=js.filter(j=>!st.cancelled.includes(j.driverId)),by={},dem={};act.forEach(j=>by[j.from]=(by[j.from]||0)+j.seats);
 const res=[...reservations,...st.extraDemand];res.forEach(r=>{const k=`${r.from} > ${r.to}`;dem[k]=(dem[k]||0)+r.seats});
 const rs=st.reservation&&['confirmed','in-progress'].includes(st.reservation.status)?st.reservation.q.group:0;
 const totalSeats=act.reduce((s,j)=>s+j.seats,0),pools=Math.floor(res.filter(r=>r.status==='confirmed').length/3)+st.pools+(rs?1:0);
 const demand=Object.entries(dem).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v],i)=>({k,v,lvl:i<3?'High':i<6?'Medium':'Low'}));
 const pax=res.filter(r=>r.status==='confirmed').reduce((s,r)=>s+r.seats,0)+rs,km=12;
 return{active:act.length,totalSeats,avail:totalSeats-rs,reserved:rs,pools,seatsByZone:Object.entries(by).map(([k,v])=>({k,v:v-(st.reservation&&rs&&k===st.reservation.q.from?rs:0)})).sort((a,b)=>b.v-a.v),demand,potential:Math.floor((totalSeats-rs)/3),impact:{pooled:pools,sharedKm:Math.round(pools*km*2.4),consolidated:Math.max(0,pax-pools),saved:Math.round(pax*km*3.6*.35),co2:+(Math.max(0,pax-pools)*km*.12).toFixed(1)}}}
