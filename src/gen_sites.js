// Builds sites.js: the curated site list with terrain masks computed from dem.bin.
const N=require('./engine.js');const fs=require('fs');
const buf=fs.readFileSync('dem.bin');const dem=N.demFromBuffer(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
function summit(lat,lon,radiusKm){ // highest map cell within radiusKm of a point
  const c=N.demPixel(dem,lat,lon),h=Math.ceil(radiusKm/dem.scaleKm);let best=-1e9,br=0,bk=0;
  for(let r=Math.round(c.row)-h;r<=Math.round(c.row)+h;r++)for(let k=Math.round(c.col)-h;k<=Math.round(c.col)+h;k++){const v=dem.data[r*dem.n+k];if(v>best){best=v;br=r;bk=k;}}
  const X=(bk-dem.n/2+0.5)*dem.scaleKm,Y=(br-dem.n/2+0.5)*dem.scaleKm,rr=Math.hypot(X,Y);
  return {lat:-90+2*Math.atan(rr/(2*N.R_MOON))*180/Math.PI,lon:N.wrap360(Math.atan2(X,-Y)*180/Math.PI)};
}
const mal=summit(-85.99,357.07,12);
const list=[
  {name:'Ridge next to Shackleton crater',lat:-89.45,lon:222.69},
  {name:'Malapert massif summit',lat:+mal.lat.toFixed(4),lon:+mal.lon.toFixed(4)},
  {name:'Mons Mouton, IM-2 area (approx.)',lat:-84.79,lon:29.20},
  {name:'West of Nobile crater (approx.)',lat:-85.42,lon:31.62},
  {name:'Shackleton crater floor (permanent shadow)',lat:-89.67,lon:129.78},
  {name:'Chandrayaan-3 landing site (approx., no terrain map)',lat:-69.373,lon:32.319},
  {name:'Apollo 11 (no terrain map)',lat:0.67408,lon:23.47297},
  {name:'Apollo 17 (approx., no terrain map)',lat:20.1908,lon:30.7717},
];
const t=N.parseHorizons(fs.readFileSync('horizons.txt','utf8'));
for(const s of list){
  if(s.lat>-78.5)continue;
  const m=N.computeMask(dem,{lat:s.lat,lon:s.lon,mastM:2});
  if(!m)continue;
  s.builtin={mask:m.mask.map(a=>+a.toFixed(2)),heightKm:+m.heightKm.toFixed(4),incomplete:m.incomplete,mastM:2};
  const site={lat:s.lat,lon:s.lon,heightKm:m.heightKm,mastM:2,mask:m.mask};
  const w=N.summarise(N.findWindows(t,site,t.t0,t.t1,'sun',0,20*60000)),e=N.summarise(N.findWindows(t,site,t.t0,t.t1,'earth',0,20*60000));
  console.log(s.name,s.lat,s.lon,'h',m.heightKm.toFixed(2),'incomplete',m.incomplete,'sun',(100*w.share).toFixed(0)+'%','earth',(100*e.share).toFixed(0)+'%');
}
list.push({name:'Custom coordinates',custom:true});
fs.writeFileSync('sites.js','window.SITES='+JSON.stringify(list)+';');
console.log('sites.js bytes',fs.statSync('sites.js').size);
