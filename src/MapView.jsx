import {useEffect,useRef} from 'react';import L from 'leaflet';import 'leaflet/dist/leaflet.css';
const dot=(c)=>L.divIcon({className:'',html:`<div style="width:14px;height:14px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 1px 4px #0006"></div>`,iconSize:[14,14]});
export default function MapView({routes=[],selected,journey,pickup,from,to,backup,others=[]}){
 const el=useRef(),map=useRef(),grp=useRef();
 useEffect(()=>{map.current=L.map(el.current,{zoomControl:true}).setView([13.04,80.22],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map.current);grp.current=L.layerGroup().addTo(map.current);return()=>map.current.remove()},[]);
 useEffect(()=>{const g=grp.current;g.clearLayers();const b=[];
  routes.forEach(r=>{const on=r.id===selected;L.polyline(r.pts,{color:on?'#0f8b8d':'#8aa1a8',weight:on?6:3,opacity:on?.95:.6,dashArray:on?null:'6 6'}).bindTooltip(`Route ${r.id}: ${r.km} km, ${r.min} min`).addTo(g);b.push(...r.pts)});
  others.forEach(p=>L.marker(p,{icon:dot('#7b8b91')}).addTo(g));
  if(journey){L.polyline(journey.pts,{color:backup?'#c2410c':'#f5a524',weight:5}).addTo(g);b.push(...journey.pts);L.marker(journey.pts[Math.floor(journey.pts.length/2)],{icon:dot('#f5a524')}).bindTooltip('Vehicle').addTo(g)}
  if(from)L.marker(from,{icon:dot('#0b3b40')}).bindTooltip('Origin').addTo(g);if(to)L.marker(to,{icon:dot('#b91c1c')}).bindTooltip('Destination').addTo(g);
  if(pickup){L.marker(pickup,{icon:dot('#16a34a')}).bindTooltip('AI pickup point').addTo(g);if(from)L.polyline([from,pickup],{color:'#16a34a',dashArray:'3 5'}).addTo(g)}
  if(b.length)map.current.fitBounds(b,{padding:[30,30]})},[routes,selected,journey,pickup,from,to,backup,others]);
 return <div ref={el} className="map" role="region" aria-label="Interactive map"/>}
