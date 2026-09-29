export const hav=(a,b)=>{const r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)**2;return 12742000*Math.asin(Math.sqrt(x))};
export const bez=(a,b,k,n=24)=>{const m=[(a[0]+b[0])/2-(b[1]-a[1])*k,(a[1]+b[1])/2+(b[0]-a[0])*k];return Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;return[u*u*a[0]+2*u*t*m[0]+t*t*b[0],u*u*a[1]+2*u*t*m[1]+t*t*b[1]]})};
export const plen=p=>p.slice(1).reduce((s,q,i)=>s+hav(p[i],q),0);
export const near=(pt,poly)=>poly.reduce((b,q,i)=>{const d=hav(pt,q);return d<b.d?{d,i}:b},{d:1e12,i:0});
