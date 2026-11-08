import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import logoUrl from '../assets/manihub-logo-transparent.png';
import './style.css';

type Store = { id:string; owner_id:string; store_name:string; description:string; category:string; province:string; town:string; logo_url:string|null; banner_url:string|null; seller_type?:string };
type Product = { id:string; product_name:string; description:string; category:string; price_zar:number; stock_quantity:number; media_urls:string[]; store_id:string; manihub_stores?:{store_name:string;town:string;province:string;logo_url:string|null}|{store_name:string;town:string;province:string;logo_url:string|null}[]|null };
type Listing = { id:string; title:string; description:string; price:number; category:string; seller_name:string; province:string; town:string|null; photo_url:string|null };
type Mode = 'signin'|'signup'|'reset';
type View = 'home'|'explore'|'my-store'|'messages';
const app=document.querySelector<HTMLDivElement>('#app')!;
const toastRoot=document.querySelector<HTMLDivElement>('#toast-root')!;
let session:Session|null=null;
let user:User|null=null;
let profile:{display_name:string;account_type:'individual'|'business'}|null=null;
let stores:Store[]=[];
let products:Product[]=[];
let listings:Listing[]=[];
let mode:Mode='signin';
let view:View='home';
let category='All';
let searchTerm='';
let busy=false;
let activeStore:Store|null=null;

const categories=['All','Electronics','Clothing','Home & Living','Food & Groceries','Beauty','Automotive','Services','Property','Other'];
const provinces=['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'];
const money=(value:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(Number(value)||0);
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const notify=(message:string,kind:'success'|'error'='success')=>{toastRoot.innerHTML='<div class="toast '+kind+'">'+esc(message)+'</div>';window.setTimeout(()=>toastRoot.innerHTML='',3600);};
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'MH';
const logo=(className='brand-logo')=>'<img class="'+className+'" src="'+logoUrl+'" alt="ManiHub logo">';

function authMarkup():string{
  const title=mode==='signup'?'Create your account':mode==='reset'?'Reset your password':'Welcome back';
  const intro=mode==='signup'?'Join South Africa’s community marketplace.':'Sign in to your ManiHub account';
  return '<main class="auth-screen"><div class="auth-brand">'+logo('auth-logo')+'<div class="tagline">BUY. SELL. GROW. TOGETHER.</div></div><section class="auth-card"><div class="eyebrow">SOUTH AFRICA COMMUNITY MARKETPLACE</div><h1>'+title+'</h1><p class="auth-intro">'+intro+'</p><div id="auth-message" class="inline-message" hidden></div><form id="auth-form">'+
    (mode==='signup'?'<label>Your name<input name="display_name" autocomplete="name" placeholder="Full name" required minlength="2"></label>':'')+
    (mode!=='reset'?'<label>Email address or cellphone number<input name="identifier" autocomplete="username" placeholder="you@example.com or 082 123 4567" required></label>':'<label>Email address<input name="identifier" type="email" autocomplete="email" placeholder="you@example.com" required></label>')+
    (mode!=='reset'?'<label>Password<div class="password-field"><input name="password" type="password" autocomplete="'+(mode==='signup'?'new-password':'current-password')+'" placeholder="Enter your password" required minlength="8"><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">Show</button></div></label>':'')+
    (mode==='signup'?'<label>Account type<select name="account_type"><option value="individual">Individual</option><option value="business">Registered business</option></select></label>':'')+
    (mode==='signin'?'<div class="auth-links"><button type="button" class="text-button" data-action="reset-mode">Forgot password?</button></div>':'')+
    '<button class="primary-button full-button" type="submit" '+(busy?'disabled':'')+'>'+(busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':'Sign in')+'</button></form><div class="auth-divider"><span>or</span></div><p class="auth-switch">'+(mode==='signin'?'Don’t have an account? <button class="text-button" data-action="signup-mode">Create an account</button>':mode==='signup'?'Already have an account? <button class="text-button" data-action="signin-mode">Sign in</button>':'Remembered your password? <button class="text-button" data-action="signin-mode">Back to sign in</button>')+'</p></section><p class="auth-footer">One Hub. Everything you need. · South Africa</p></main>';
}

function shellMarkup():string{
  const nav=(id:View,label:string,icon:string)=>'<button class="nav-link '+(view===id?'active':'')+'" data-view="'+id+'"><span class="nav-icon">'+icon+'</span>'+label+'</button>';
  return '<div class="site-shell"><header class="site-header"><button class="brand-button" data-view="home">'+logo('header-logo')+'<span class="brand-word">Mani<span>Hub</span><small>BUY. SELL. GROW. TOGETHER.</small></span></button><div class="header-search"><span>⌕</span><input id="global-search" value="'+esc(searchTerm)+'" placeholder="Search products, stores and services"><button data-action="search">Search</button></div><div class="header-actions"><button class="icon-button" data-view="messages" aria-label="Messages">✉</button><button class="account-button" data-action="account">'+esc(profile?.display_name||user?.email||'My account')+' ▾</button></div></header><nav class="main-nav">'+nav('home','Home','⌂')+nav('explore','Explore','⌕')+nav('my-store','My business','▦')+nav('messages','Messages','✉')+'<button class="nav-link mobile-account" data-action="signout">Sign out</button></nav><main id="page-content">'+pageMarkup()+'</main><footer class="site-footer"><strong>ManiHub</strong><span>One Hub. Everything you need. · South Africa</span><span>Buy. Sell. Grow. Together.</span></footer></div>';
}

function productCard(item:Product|Listing):string{
  const isStoreProduct='product_name' in item;
  const title=isStoreProduct?item.product_name:item.title;
  const price=isStoreProduct?item.price_zar:item.price;
  const image=isStoreProduct?(item.media_urls?.[0]||''):(item.photo_url||'');
  const storeInfo=isStoreProduct?(Array.isArray(item.manihub_stores)?item.manihub_stores[0]:item.manihub_stores):null;
  const seller=isStoreProduct?(storeInfo?.store_name||'ManiHub seller'):(item.seller_name||'Community seller');
  const place=isStoreProduct?[storeInfo?.town,storeInfo?.province].filter(Boolean).join(', '):[item.town,item.province].filter(Boolean).join(', ');
  return '<article class="product-card">'+(image?'<img class="product-image" src="'+esc(image)+'" alt="'+esc(title)+'" loading="lazy">':'<div class="product-placeholder"><span>MH</span></div>')+'<div class="product-info"><span class="product-category">'+esc(item.category||'Marketplace')+'</span><h3>'+esc(title)+'</h3><strong class="product-price">'+money(Number(price))+'</strong><p>'+esc(seller)+'</p><small>'+esc(place||'South Africa')+'</small></div></article>';
}

function storeCard(store:Store):string{
  return '<button class="store-card" data-store="'+esc(store.id)+'">'+(store.logo_url?'<img src="'+esc(store.logo_url)+'" alt="">':'<span class="store-avatar">'+esc(initials(store.store_name))+'</span>')+'<span class="store-card-copy"><strong>'+esc(store.store_name)+'</strong><small>'+esc(store.category)+' · '+esc([store.town,store.province].filter(Boolean).join(', '))+'</small></span><span class="store-arrow">›</span></button>';
}

function homeMarkup():string{
  const all=[...products,...listings].filter(item=>category==='All'||item.category?.toLowerCase()===category.toLowerCase()).filter(item=>!searchTerm||(('product_name' in item?item.product_name:item.title)+' '+item.category+' '+('product_name' in item?(item.manihub_stores?.store_name||''):(item.seller_name||''))).toLowerCase().includes(searchTerm.toLowerCase()));
  return '<section class="welcome-strip"><div><span class="eyebrow light">SOUTH AFRICA’S COMMUNITY MARKETPLACE</span><h1>One hub. <em>Everything you need.</em></h1><p>Discover local businesses, shop from your community and grow together.</p><button class="hero-button" data-view="explore">Explore marketplace <span>→</span></button></div><div class="hero-art"><div class="hero-orbit"></div><div class="hero-letter">M</div><div class="hero-pill">LOCAL • CONNECTED • TOGETHER</div></div></section><section class="category-section"><div class="section-heading"><div><span class="eyebrow">FIND WHAT YOU NEED</span><h2>Shop by department</h2></div></div><div class="category-row">'+categories.map(c=>'<button class="category-chip '+(category===c?'selected':'')+'" data-category="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div></section><section class="content-section"><div class="section-heading"><div><span class="eyebrow">DISCOVER</span><h2>What’s happening on ManiHub</h2><p>Products and services shared by South African sellers.</p></div><button class="subtle-button" data-view="explore">Explore all →</button></div><div class="product-grid">'+(all.length?all.slice(0,8).map(productCard).join(''):'<div class="empty-state"><div class="empty-icon">⌕</div><h3>Be the first to discover something</h3><p>New products and listings will appear here as sellers join ManiHub.</p></div>')+'</div></section><section class="content-section stores-section"><div class="section-heading"><div><span class="eyebrow">SHOP LOCAL</span><h2>Stores and businesses</h2><p>Meet the businesses growing in your community.</p></div><button class="subtle-button" data-view="explore">View all →</button></div><div class="store-grid">'+(stores.length?stores.slice(0,6).map(storeCard).join(''):'<div class="empty-state compact"><p>Business storefronts will appear here when sellers open their ManiHub stores.</p></div>')+'</div></section>';
}

function exploreMarkup():string{
  const all=[...products,...listings];
  return '<section class="page-heading"><span class="eyebrow">MANIHUB DISCOVERY</span><h1>Explore the marketplace</h1><p>Find products, services and local businesses across South Africa.</p><div class="explore-search"><input id="explore-search" value="'+esc(searchTerm)+'" placeholder="What are you looking for?"><button class="primary-button" data-action="search">Search</button></div></section><div class="category-row explore-categories">'+categories.map(c=>'<button class="category-chip '+(category===c?'selected':'')+'" data-category="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div><section class="content-section"><div class="section-heading"><h2>Marketplace listings</h2><span class="result-count">'+all.length+' results loaded</span></div><div class="product-grid">'+(all.length?all.filter(item=>(category==='All'||item.category?.toLowerCase()===category.toLowerCase())&&(!searchTerm||(('product_name' in item?item.product_name:item.title)+' '+item.category).toLowerCase().includes(searchTerm.toLowerCase()))).map(productCard).join(''):'<div class="empty-state"><h3>No listings yet</h3><p>When sellers publish products, they will be shown here.</p></div>')+'</div></section><section class="content-section"><div class="section-heading"><h2>Stores and businesses</h2></div><div class="store-grid">'+(stores.length?stores.map(storeCard).join(''):'<div class="empty-state compact"><p>No public stores yet. Sellers can create the first store.</p></div>')+'</div></section>';
}

function myStoreMarkup():string{
  const store=activeStore||stores.find(s=>s.owner_id===user?.id)||null;
  activeStore=store;
  if(!store)return '<section class="page-heading"><span class="eyebrow">SELL ON MANIHUB</span><h1>Open your ManiHub store</h1><p>Create your storefront and start introducing your business to South Africa.</p></section><section class="form-panel"><form id="store-form" class="stack-form"><label>Business or store name<input name="store_name" required minlength="2" maxlength="90" placeholder="e.g. Sihle Fashion"></label><label>Category<select name="category">'+categories.filter(x=>x!=='All').map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label><label>Province<select name="province" required><option value="">Choose province</option>'+provinces.map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label><label>Town or city<input name="town" placeholder="Town or city"></label><label>Short description<textarea name="description" maxlength="1200" rows="3" placeholder="Tell customers about your store"></textarea></label><button class="primary-button" type="submit">Create my store</button></form></section>';
  const mine=products.filter(p=>p.store_id===store.id);
  return '<section class="page-heading"><span class="eyebrow">SELLER WORKSPACE</span><h1>'+esc(store.store_name)+'</h1><p>'+esc(store.description||'Your ManiHub storefront')+' · '+esc([store.town,store.province].filter(Boolean).join(', '))+'</p></section><section class="seller-actions"><button class="primary-button" data-action="new-product">＋ Add a product</button><button class="subtle-button" data-action="change-store">Manage store</button></section><section id="product-editor" class="form-panel" hidden><form id="product-form" class="stack-form"><h2>Add a product</h2><label>Product name<input name="product_name" required minlength="2" maxlength="140"></label><label>Category<select name="category">'+categories.filter(x=>x!=='All').map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label><label>Price (ZAR)<input name="price_zar" type="number" min="0" step="0.01" required></label><label>Available stock<input name="stock_quantity" type="number" min="0" step="1" value="1" required></label><label>Description<textarea name="description" rows="3" maxlength="4000"></textarea></label><label>Product image URL (optional)<input name="image_url" type="url" placeholder="https://…"></label><div class="form-actions"><button class="primary-button" type="submit">Publish product</button><button class="subtle-button" type="button" data-action="cancel-product">Cancel</button></div></form></section><section class="content-section"><div class="section-heading"><h2>Your products</h2><span class="result-count">'+mine.length+' products</span></div><div class="product-grid">'+(mine.length?mine.map(productCard).join(''):'<div class="empty-state compact"><p>Your published products will appear here.</p></div>')+'</div></section>';
}

function pageMarkup():string{
  if(view==='explore')return exploreMarkup();
  if(view==='my-store')return myStoreMarkup();
  if(view==='messages')return '<section class="page-heading"><span class="eyebrow">STAY CONNECTED</span><h1>Messages</h1><p>ManiHub buyer and seller messaging is part of the shared marketplace build. We will connect this screen to your private conversations next.</p><div class="notice-card">Your messages are private and will only be visible to conversation participants.</div></section>';
  return homeMarkup();
}

function render():void{
  app.innerHTML=user?shellMarkup():authMarkup();
  if(user)bindShellInputs();
  else bindAuthForm();
}
function bindAuthForm():void{
  const form=document.querySelector<HTMLFormElement>('#auth-form');
  form?.addEventListener('submit',handleAuthSubmit);
}
function bindShellInputs():void{
  document.querySelector<HTMLInputElement>('#global-search')?.addEventListener('input',e=>{searchTerm=(e.target as HTMLInputElement).value;});
  document.querySelector<HTMLInputElement>('#explore-search')?.addEventListener('input',e=>{searchTerm=(e.target as HTMLInputElement).value;});
}

async function ensureProfile(current:User):Promise<void>{
  const {data,error}=await supabase.from('profiles').select('display_name,account_type').eq('id',current.id).maybeSingle();
  if(error)throw error;
  if(data){profile=data as typeof profile;return;}
  const meta=current.user_metadata||{};
  const displayName=String(meta.display_name||current.email||current.phone||'ManiHub member');
  const accountType=meta.account_type==='business'?'business':'individual';
  const {data:created,error:createError}=await supabase.from('profiles').upsert({id:current.id,display_name:displayName,account_type:accountType},{onConflict:'id'}).select('display_name,account_type').single();
  if(createError)throw createError;
  profile=created as typeof profile;
}

async function loadMarketplace():Promise<void>{
  const [storeResult,productResult,listingResult]=await Promise.all([
    supabase.from('manihub_stores').select('id,owner_id,store_name,description,category,province,town,logo_url,banner_url,seller_type').eq('status','active').order('created_at',{ascending:false}).limit(30),
    supabase.from('manihub_store_products').select('id,product_name,description,category,price_zar,stock_quantity,media_urls,store_id,manihub_stores(store_name,town,province,logo_url)').eq('status','active').order('created_at',{ascending:false}).limit(40),
    supabase.from('listings').select('id,title,description,price,category,seller_name,province,town,photo_url').eq('status','active').order('created_at',{ascending:false}).limit(40)
  ]);
  stores=storeResult.error?[]:(storeResult.data as Store[]||[]);
  products=productResult.error?[]:(productResult.data as Product[]||[]);
  listings=listingResult.error?[]:(listingResult.data as Listing[]||[]);
  if(storeResult.error)console.warn('Store catalogue could not load',storeResult.error.message);
  if(productResult.error)console.warn('Store products could not load',productResult.error.message);
  if(listingResult.error)console.warn('Community listings could not load',listingResult.error.message);
}

async function handleAuthSubmit(event:SubmitEvent):Promise<void>{
  event.preventDefault();
  if(busy)return;
  const form=event.currentTarget as HTMLFormElement;
  const data=new FormData(form);
  const identifier=String(data.get('identifier')||'').trim();
  const password=String(data.get('password')||'');
  busy=true;render();
  try{
    if(mode==='reset'){
      if(!identifier.includes('@'))throw new Error('Password reset currently requires the email address on your account.');
      const {error}=await supabase.auth.resetPasswordForEmail(identifier,{redirectTo:window.location.origin});
      if(error)throw error;
      mode='signin';busy=false;render();showAuthMessage('If an account exists for that email, a password reset link has been sent.');return;
    }
    if(mode==='signup'){
      const displayName=String(data.get('display_name')||'').trim();
      const accountType=String(data.get('account_type')||'individual');
      const credentials=identifier.includes('@')?{email:identifier,password}:{phone:identifier,password};
      const {data:result,error}=await supabase.auth.signUp({...credentials,options:{data:{display_name:displayName,account_type:accountType}}});
      if(error)throw error;
      if(result.session&&result.user){
        session=result.session;user=result.user;await ensureProfile(result.user);await loadMarketplace();view='home';busy=false;render();notify('Welcome to ManiHub, '+displayName+'!');return;
      }
      mode='signin';busy=false;render();showAuthMessage('Your account request was received. Check your email or phone for the verification code/link before signing in.');return;
    }
    const credentials=identifier.includes('@')?{email:identifier,password}:{phone:identifier,password};
    const {data:result,error}=await supabase.auth.signInWithPassword(credentials);
    if(error)throw error;
    session=result.session;user=result.user;await ensureProfile(result.user);await loadMarketplace();view='home';busy=false;render();notify('You are signed in.');
  }catch(error){
    busy=false;render();notify(error instanceof Error?error.message:'We could not complete that request. Please try again.','error');
  }
}
function showAuthMessage(message:string):void{
  const box=document.querySelector<HTMLDivElement>('#auth-message');
  if(box){box.textContent=message;box.hidden=false;}
}

async function startSession(nextSession:Session|null):Promise<void>{
  session=nextSession;user=nextSession?.user||null;
  if(!user){profile=null;stores=[];products=[];listings=[];render();return;}
  try{await ensureProfile(user);await loadMarketplace();render();}
  catch(error){console.error('ManiHub account setup failed',error);render();notify('Your account is connected, but profile data could not load. Please contact support.','error');}
}

app.addEventListener('click',async event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action],[data-view],[data-category],[data-store]');
  if(!target)return;
  const action=target.dataset.action;
  if(target.dataset.view){view=target.dataset.view as View;render();window.scrollTo({top:0,behavior:'smooth'});return;}
  if(target.dataset.category){category=target.dataset.category;render();return;}
  if(target.dataset.store){activeStore=stores.find(s=>s.id===target.dataset.store)||null;view='explore';notify(activeStore?.store_name||'Store selected');return;}
  if(action==='signup-mode'){mode='signup';render();}
  if(action==='signin-mode'){mode='signin';render();}
  if(action==='reset-mode'){mode='reset';render();}
  if(action==='toggle-password'){const input=document.querySelector<HTMLInputElement>('#auth-form input[name="password"]');if(input){input.type=input.type==='password'?'text':'password';target.textContent=input.type==='password'?'Show':'Hide';}}
  if(action==='search'){const input=document.querySelector<HTMLInputElement>('#explore-search')||document.querySelector<HTMLInputElement>('#global-search');if(input)searchTerm=input.value;view='explore';render();}
  if(action==='signout'){await supabase.auth.signOut();session=null;user=null;profile=null;render();}
  if(action==='account'){notify('Signed in as '+(user?.email||user?.phone||'ManiHub member'));}
  if(action==='new-product'){const editor=document.querySelector<HTMLElement>('#product-editor');if(editor)editor.hidden=false;}
  if(action==='cancel-product'){const editor=document.querySelector<HTMLElement>('#product-editor');if(editor)editor.hidden=true;}
  if(action==='change-store'){activeStore=null;view='my-store';render();}
});
app.addEventListener('submit',async event=>{
  const form=event.target as HTMLFormElement;
  if(form.id==='store-form'){
    event.preventDefault();if(!user)return;
    const data=new FormData(form);
    const payload={owner_id:user.id,store_name:String(data.get('store_name')||'').trim(),description:String(data.get('description')||''),category:String(data.get('category')||'General'),province:String(data.get('province')||''),town:String(data.get('town')||''),status:'active',seller_type:profile?.account_type==='business'?'business':'individual'};
    const {data:created,error}=await supabase.from('manihub_stores').insert(payload).select('id,owner_id,store_name,description,category,province,town,logo_url,banner_url,seller_type').single();
    if(error){notify(error.message,'error');return;}
    activeStore=created as Store;stores.unshift(activeStore);render();notify('Your ManiHub store is open.');
  }
  if(form.id==='product-form'){
    event.preventDefault();if(!user||!activeStore){notify('Create or select your store first.','error');return;}
    const data=new FormData(form),image=String(data.get('image_url')||'').trim();
    const payload={store_id:activeStore.id,owner_id:user.id,product_name:String(data.get('product_name')||'').trim(),description:String(data.get('description')||''),category:String(data.get('category')||'Other'),price_zar:Number(data.get('price_zar')||0),stock_quantity:Number(data.get('stock_quantity')||0),media_urls:image?[image]:[],status:'active'};
    const {error}=await supabase.from('manihub_store_products').insert(payload);
    if(error){notify(error.message,'error');return;}
    await loadMarketplace();render();notify('Your product has been published.');
  }
});

async function init():Promise<void>{
  try{
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    await startSession(data.session);
    supabase.auth.onAuthStateChange((_event,nextSession)=>{void startSession(nextSession);});
  }catch(error){
    console.error('ManiHub startup failed',error);
    app.innerHTML='<main class="auth-screen"><div class="auth-brand">'+logo('auth-logo')+'</div><section class="auth-card"><h1>We could not connect</h1><p class="auth-intro">ManiHub could not reach the account service. Check your internet connection and try again.</p><p class="inline-message">'+esc(error instanceof Error?error.message:'Connection error')+'</p><button class="primary-button full-button" id="retry-connect">Try again</button></section></main>';
    document.querySelector('#retry-connect')?.addEventListener('click',()=>location.reload());
  }
}
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.info('Offline support unavailable',e)));
void init();