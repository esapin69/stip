from pathlib import Path
p=Path('places.html')
s=p.read_text()
old="""function summarySegments(level){return String(level?.summary||'').split(/\\s*·\\s*/).map(x=>x.trim()).filter(Boolean)}
function virtualSummaryItems(level){return [...virtualById.values()].filter(x=>x.parent_id===level.id).sort(sortPlaces)}
function rebuildVirtualSummaryPlaces(){virtualById=new Map();for(const level of places.filter(x=>x.place_type==='level')){if(realDestinationsForLevel(level).length)continue;const parts=summarySegments(level);if(!parts.length)continue;const top=topContainer(level);parts.forEach((label,i)=>{const v={id:`__summary__${level.id}__${i}`,place_type:'service',display_name:label,official_name:null,parent_id:level.id,building_code:top?.building_code||'',level:level.level||'',summary:'',details:'',sort_order:i+1,__virtual_summary:true};virtualById.set(v.id,v)})}}
function destinationsForLevel(level){const real=realDestinationsForLevel(level);return real.length?real:virtualSummaryItems(level)}"""
new="""function summarySegments(level){return String(level?.summary||'').split(/\\s*·\\s*/).map(x=>x.trim()).filter(Boolean)}
function virtualSummaryItems(level){return [...virtualById.values()].filter(x=>x.parent_id===level.id).sort(sortPlaces)}
function summarySegmentCovered(label,real){const n=norm(label),parts=n.split(' ').filter(x=>x.length>1);if(!n)return true;return real.some(p=>{const names=[cleanTitle(p),p.display_name,p.official_name,p.summary,p.details].filter(Boolean),text=norm(names.join(' '));if(!text)return false;if(text.includes(n))return true;for(const name of names){const nn=norm(name);if(nn&&(n.includes(nn)||nn.includes(n)))return true}if(!parts.length)return false;const words=text.split(' ').filter(Boolean),hits=parts.filter(w=>words.some(x=>x===w||x.startsWith(w)||w.startsWith(x))).length;return hits>=Math.max(1,Math.ceil(parts.length*.6))})}
function rebuildVirtualSummaryPlaces(){virtualById=new Map();for(const level of places.filter(x=>x.place_type==='level')){const real=realDestinationsForLevel(level),parts=summarySegments(level);if(!parts.length)continue;const top=topContainer(level);parts.filter(label=>!summarySegmentCovered(label,real)).forEach((label,i)=>{const v={id:`__summary__${level.id}__${i}`,place_type:'service',display_name:label,official_name:null,parent_id:level.id,building_code:top?.building_code||'',level:level.level||'',summary:'',details:'',sort_order:1000+i,__virtual_summary:true};virtualById.set(v.id,v)})}}
function destinationsForLevel(level){return [...realDestinationsForLevel(level),...virtualSummaryItems(level)].sort(sortPlaces)}"""
assert old in s
s=s.replace(old,new,1)
old2="const items=real.length?real:virtualSummaryItems(level);return `<section class=\"floor-block\""
new2="const items=[...real,...virtualSummaryItems(level)].sort(sortPlaces);return `<section class=\"floor-block\""
assert old2 in s
s=s.replace(old2,new2,1)
p.write_text(s)
