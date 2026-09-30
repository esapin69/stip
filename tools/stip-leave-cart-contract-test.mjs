import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const client=read('leave-cart.js'),css=read('leave-cart.css'),
  index=read('index.html'),loader=read('stip-loader.js'),
  sw=read('stip-sw.js'),home=read('home-shell.js'),
  month=read('day-workflow.js'),manager=read('responsable-day-workflow.js'),
  server=read('supabase/functions/stip-change/index.ts');
function check(label,condition){
 assert.ok(condition,label);
 console.log('OK '+label);
}
check('legacy GHE congés form retired, other requests preserved',!fs.existsSync('day-workflow-leave.js')&&!loader.includes('"day-workflow-leave.js"')&&loader.includes('"day-workflow.js"'));
check('single shared server endpoint',server.includes("if(action==='leave_cart_submit')")&&server.includes('created_from:\'stip_ghe_leave_cart\''));
check('GHE origin is allowed',server.includes("'https://ghe.esapin.com'"));
check('new JS and CSS are on GHE main',index.includes('leave-cart.js?')&&index.includes('leave-cart.css?'));
check('same coherent build',(()=>{const v=index.match(/stip-ui-build" content="([^"]+)/)?.[1];return v&&v===loader.match(/V = "([^"]+)/)?.[1]&&v===sw.match(/STIP_SW_BUILD="([^"]+)/)?.[1]&&v===index.match(/stip-loader\.js\?v=([^"]+)/)?.[1]&&v===index.match(/\/stip-sw\.js\?v=([^"]+)/)?.[1]})());
check('same basket is used from both shift UIs and calendar',home.includes('data-shift-leave-action')&&home.includes('STIPLeaveCart.toggle(')&&month.includes('data-dw-leave')&&month.includes('STIPLeaveCart.toggle('));
check('manager can see the selected exact dates',manager.includes('Jours réellement demandés')&&manager.includes('x.context.days.map('));
check('calendar selected dates have visible state',client.includes('is-lc-selected')&&css.includes('.is-lc-selected'));
check('unfinished draft persists and remains visible',client.includes('localStorage.setItem(key,state)')&&client.includes('state?.open!==false')&&css.includes('left:50%')&&css.includes('z-index:1550'));
check('no automatic planning change',server.includes('automatic_apply_allowed:false')&&server.includes('approved_pending_manual'));

// Dependency-free browser API smoke test: a fake DOM is sufficient for opening, keeping,
// changing and submitting the exact date basket without touching real user data.
class Node {
 constructor(tag='div'){this.tagName=tag;this.id='';this.hidden=false;this.isConnected=false;this.innerHTML='';this.dataset={};this.events={};
  this.classList={toggle:()=>{},add:()=>{},remove:()=>{}}}
 setAttribute(key,value){this[key]=value}
 addEventListener(key,fn){this.events[key]=fn}
}
const byId=new Map(),persist=new Map(),localPersist=new Map(),sent=[];
const document={
 readyState:'loading',body:{append(n){n.isConnected=true;if(n.id)byId.set(n.id,n)}},
 createElement:tag=>new Node(tag),
 getElementById:id=>byId.get(id)||null,
 querySelector:s=>byId.get(s.replace(/^#/,'') )||null,
 querySelectorAll:()=>[],
 addEventListener:()=>{}
};
const window={
 STIPSession:{agent:{id:'fixture-agent'},permissions:{day_leave:true}},
 STIPRouter:{get:()=>'home'},
 addEventListener:()=>{},dispatchEvent:()=>{},confirm:()=>true
};
const sessionStorage={getItem:k=>persist.get(k)||null,setItem:(k,v)=>persist.set(k,v),removeItem:k=>persist.delete(k)};
const localStorage={
 getItem:k=>k==='stip_session_v1'?'fixture-session':(localPersist.get(k)||null),
 setItem:(k,v)=>localPersist.set(k,v),
 removeItem:k=>localPersist.delete(k)
};
const fakeFetch=async (_url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({item:{id:'fixture-request'}})}};
vm.runInNewContext(client,{window,document,sessionStorage,localStorage,fetch:fakeFetch,
 Intl,Date,JSON,Math,Number,Set,String,Array,CustomEvent:class {},setTimeout:()=>1,clearTimeout:()=>{}},{timeout:1500});
const cart=window.STIPLeaveCart;
check('cart exposes one shared API',!!cart?.add&&!!cart?.toggle&&!!cart?.isSelecting);
const a='2099-10-12',z='2099-10-15';
cart.add(a,'M');cart.add(z,'J4');
check('two nonadjacent dates are kept in one cart',cart.has(a)&&cart.has(z)&&cart.isSelecting()&&localPersist.size===1);
cart.open();
const root=byId.get('stipLeaveCart');
check('expanded cart displays exact dates and three leave types',root.innerHTML.includes('2099')&&root.innerHTML.includes('RTT')&&root.innerHTML.includes('AUTRE'));
root.events.change({target:{closest:()=>({dataset:{lcKind:a},value:'RTT'})}});
root.events.click({target:{closest:()=>({hasAttribute:key=>key==='data-lc-send'})}});
await new Promise(resolve=>setImmediate(resolve));
check('submit sends one atomic batch preserving exact dates/types',sent.length===1&&sent[0].action==='leave_cart_submit'&&
 sent[0].days.length===2&&sent[0].days[0].date===a&&sent[0].days[0].kind==='RTT'&&sent[0].days[1].date===z);
check('successful submission removes the floating cart',!cart.isSelecting()&&root.hidden&&localPersist.size===0);
console.log('All GHE leave-cart contract checks passed.');
