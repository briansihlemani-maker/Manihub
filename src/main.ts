import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import logoUrl from '../assets/manihub-logo-transparent.png';
import './style.css';

type Store = { id:string; owner_id:string; store_name:string; description:string; category:string; province:string; town:string; logo_url:string|null; banner_url:string|null; seller_type?:string };
type Product = { id:string; product_name:string; description:string; category:string; price_zar:number; stock_quantity:number; media_urls:string[]; store_id:string; manihub_stores?:{store_name:string;town:string;province:string;logo_url:string|null}|{store_name:string;town:string;province:string;logo_url:string|null}[]|null };
type Listing = { id:string; title:string; description:string; price:number; category:string; seller_name:string; province:string; town:string|null; photo_url:string|null };
type Mode = 'signin'|'signup'|'reset'|'verify'|'new-password';
type View = 'home'|'explore'|'my-store'|'messages'|'store-detail'|'product-detail';
type Conversation = {id:string;subject:string|null;conversation_type:string;updated_at:string};
type Message = {id:string;sender_id:string;body:string;created_at:string};
type Popularity = {listing_id:string;views_30d:number;saves_30d:number;enquiries_30d:number;sales_30d:number;popularity_score:number};
const app=document.querySelector<HTMLDivElement>('#app')!;
const toastRoot=document.querySelector<HTMLDivElement>('#toast-root')!;
let session:Session|null=null;
let user:User|null=null;
let profile:{display_name:string;account_type:'individual'|'business'}|null=null;
let stores:Store[]=[];
let products:Product[]=[];
let listings:Listing[]=[];
let popularity:Popularity[]=[];
let homeShelf:'sales'|'hot'|'frequent'='hot';
let mode:Mode='signin';
let pendingPhone='';
let view:View='home';
let category='All';
let searchTerm='';
let busy=false;
let backendStatus:'checking'|'connected'|'error'='checking';
let activeStore:Store|null=null;
let conversations:Conversation[]=[];
let selectedConversationId:string|null=null;
let selectedProduct:Product|Listing|null=null;
let messages:Message[]=[];

const categories=['All','Electronics','Clothing','Home & Living','Food & Groceries','Beauty','Automotive','Services','Property','Other'];
const provinces=['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'];
const money=(value:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:2}).format(Number(value)||0);
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const notify=(message:string,kind:'success'|'error'='success')=>{toastRoot.innerHTML='<div class="toast '+kind+'">'+esc(message)+'</div>';window.setTimeout(()=>toastRoot.innerHTML='',3600);};
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'MH';
const logo=(className='brand-logo')=>'<img class="'+className+'" src="'+logoUrl+'" alt="ManiHub logo">';

function authMarkup():string{
  const title=mode==='signup'?'Create your account':mode==='reset'?'Reset your password':mode==='verify'?'Verify your cellphone':mode==='new-password'?'Choose a new password':'Welcome back';
  const intro=mode==='signup'?'Join South Africa’s community marketplace.':mode==='verify'?'Enter the six-digit code sent to '+pendingPhone+'.':mode==='new-password'?'Create a new password for your ManiHub account.':'Sign in to your ManiHub account';
  const identity=mode==='reset'?'<label>Email address<input name="identifier" type="email" autocomplete="email" placeholder="you@example.com" required></label>':mode==='verify'?'<label>Verification code<input name="token" inputmode="numeric" autocomplete="one-time-code" placeholder="6-digit code" minlength="6" maxlength="6" required></label>':mode==='new-password'?'<label>New password<input name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" minlength="8" required></label><label>Confirm new password<input name="password_confirm" type="password" autocomplete="new-password" placeholder="Enter the password again" minlength="8" required></label>':'<label>Email address or cellphone number<input name="identifier" autocomplete="username" placeholder="you@example.com or 082 123 4567" required></label>';
  const password=mode==='signin'||mode==='signup'?'<label>Password<div class="password-field"><input name="password" type="password" autocomplete="'+(mode==='signup'?'new-password':'current-password')+'" placeholder="Enter your password" required minlength="8"><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Show password">Show</button></div></label>':'';
  const display=mode==='signup'?'<label>Your name<input name="display_name" autocomplete="name" placeholder="Full name" required minlength="2"></label>':'';
  const account=mode==='signup'?'<label>Account type<select name="account_type"><option value="individual">Individual</option><option value="business">Registered business</option></select></label>':'';
  const links=mode==='signin'?'<div class="auth-links"><button type="button" class="text-button" data-action="reset-mode">Forgot password?</button></div>':mode==='verify'?'<div class="auth-links"><button type="button" class="text-button" data-action="resend-otp">Resend code</button></div>':'';
  const label=busy?'Please wait…':mode==='signup'?'Create account':mode==='reset'?'Send reset link':mode==='verify'?'Verify code':mode==='new-password'?'Save new password':'Sign in';
  const switcher=mode==='signin'?'Don’t have an account? <button class="text-button" data-action="signup-mode">Create an account</button>':mode==='signup'?'Already have an account? <button class="text-button" data-action="signin-mode">Sign in</button>':mode==='verify'?'Entered the wrong number? <button class="text-button" data-action="signin-mode">Back to sign in</button>':mode==='reset'?'Remembered your password? <button class="text-button" data-action="signin-mode">Back to sign in</button>':'';
  return '<main class="auth-screen"><div class="auth-brand">'+logo('auth-logo')+'<div class="tagline">BUY. SELL. GROW. TOGETHER.</div></div><section class="auth-card"><div class="eyebrow">SOUTH AFRICA COMMUNITY MARKETPLACE</div><h1>'+title+'</h1><p class="auth-intro">'+intro+'</p><div class="backend-status '+backendStatus+'"><span></span>'+(backendStatus==='connected'?'ManiHub account service connected':backendStatus==='checking'?'Connecting to ManiHub account service…':'Connection unavailable')+'</div><div id="auth-message" class="inline-message" hidden></div><form id="auth-form">'+display+identity+password+account+links+'<button class="primary-button full-button" type="submit" '+(busy?'disabled':'')+'>'+label+'</button></form>'+(switcher?'<div class="auth-divider"><span>or</span></div><p class="auth-switch">'+switcher+'</p>':'')+'</section><p class="auth-footer">One Hub. Everything you need. · South Africa</p></main>';
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
  return '<button class="product-card" data-product="'+esc(item.id)+'" data-product-kind="'+(isStoreProduct?'store':'listing')+'">'+(image?'<img class="product-image" src="'+esc(image)+'" alt="'+esc(title)+'" loading="lazy">':'<div class="product-placeholder"><span>MH</span></div>')+'<div class="product-info"><span class="product-category">'+esc(item.category||'Marketplace')+'</span><h3>'+esc(title)+'</h3><strong class="product-price">'+money(Number(price))+'</strong><p>'+esc(seller)+'</p><small>'+esc(place||'South Africa')+'</small></div></button>';
}

function storeCard(store:Store):string{
  return '<button class="store-card" data-store="'+esc(store.id)+'">'+(store.logo_url?'<img src="'+esc(store.logo_url)+'" alt="">':'<span class="store-avatar">'+esc(initials(store.store_name))+'</span>')+'<span class="store-card-copy"><strong>'+esc(store.store_name)+'</strong><small>'+esc(store.category)+' · '+esc([store.town,store.province].filter(Boolean).join(', '))+'</small></span><span class="store-arrow">›</span></button>';
}

function homeMarkup():string{
  const all=[...products,...listings].filter(item=>category==='All'||item.category?.toLowerCase()===category.toLowerCase()).filter(item=>!searchTerm||(('product_name' in item?item.product_name:item.title)+' '+item.category+' '+('product_name' in item?((Array.isArray(item.manihub_stores)?item.manihub_stores[0]?.store_name:item.manihub_stores?.store_name)||''):(item.seller_name||''))).toLowerCase().includes(searchTerm.toLowerCase()));
  const popularityById=new Map(popularity.map(row=>[row.listing_id,row]));
  const score=(item:Product|Listing)=>{const row=popularityById.get(item.id);if(!row)return 0;return homeShelf==='sales'?Number(row.sales_30d):homeShelf==='frequent'?Number(row.views_30d):Number(row.popularity_score);};
  const ordered=[...all].sort((a,b)=>score(b)-score(a));
  const shelfTitle=homeShelf==='sales'?'Top sellers':homeShelf==='frequent'?'Frequently used':"What’s hot";
  return '<section class="welcome-strip"><div><span class="eyebrow light">SOUTH AFRICA’S COMMUNITY MARKETPLACE</span><h1>One hub. <em>Everything you need.</em></h1><p>Discover local businesses, shop from your community and grow together.</p><button class="hero-button" data-view="explore">Explore marketplace <span>→</span></button></div><div class="hero-art"><div class="hero-orbit"></div><div class="hero-letter">M</div><div class="hero-pill">LOCAL • CONNECTED • TOGETHER</div></div></section><section class="category-section"><div class="section-heading"><div><span class="eyebrow">FIND WHAT YOU NEED</span><h2>Shop by department</h2></div></div><div class="category-row">'+categories.map(c=>'<button class="category-chip '+(category===c?'selected':'')+'" data-category="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div></section><section class="content-section"><div class="section-heading"><div><span class="eyebrow">DISCOVER</span><h2>'+shelfTitle+'</h2><p>Popular products and services across South Africa.</p></div><button class="subtle-button" data-view="explore">More →</button></div><div class="shelf-tabs"><button class="shelf-tab '+(homeShelf==='sales'?'active':'')+'" data-shelf="sales">Top sellers</button><button class="shelf-tab '+(homeShelf==='hot'?'active':'')+'" data-shelf="hot">What’s hot</button><button class="shelf-tab '+(homeShelf==='frequent'?'active':'')+'" data-shelf="frequent">Frequently used</button></div><div class="product-grid">'+(ordered.length?ordered.slice(0,8).map(productCard).join(''):'<div class="empty-state"><div class="empty-icon">⌕</div><h3>Be the first to discover something</h3><p>New products and listings will appear here as sellers join ManiHub.</p></div>')+'</div></section><section class="content-section stores-section"><div class="section-heading"><div><span class="eyebrow">SHOP LOCAL</span><h2>Stores and businesses</h2><p>Meet the businesses growing in your community.</p></div><button class="subtle-button" data-view="explore">View all →</button></div><div class="store-grid">'+(stores.length?stores.slice(0,6).map(storeCard).join(''):'<div class="empty-state compact"><p>Business storefronts will appear here when sellers open their ManiHub stores.</p></div>')+'</div></section>';
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


async function loadConversations():Promise<void>{
  if(!user){conversations=[];return;}
  const {data:participantRows,error}=await supabase.from('manihub_conversation_participants').select('conversation_id').eq('user_id',user.id);
  if(error){console.warn('Could not load conversations',error.message);conversations=[];return;}
  const ids=(participantRows||[]).map((row:{conversation_id:string})=>row.conversation_id);
  if(!ids.length){conversations=[];return;}
  const {data,error:conversationError}=await supabase.from('manihub_conversations').select('id,subject,conversation_type,updated_at').in('id',ids).order('updated_at',{ascending:false});
  if(conversationError){console.warn('Could not load conversations',conversationError.message);conversations=[];return;}
  conversations=(data||[]) as Conversation[];
}
async function loadMessages(conversationId:string):Promise<void>{
  const {data,error}=await supabase.from('manihub_messages').select('id,sender_id,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true}).limit(200);
  if(error){notify(error.message,'error');messages=[];return;}
  messages=(data||[]) as Message[];
}
function messagesMarkup():string{
  const selected=conversations.find(c=>c.id===selectedConversationId);
  if(!selected)return '<section class="page-heading"><span class="eyebrow">STAY CONNECTED</span><h1>Messages</h1><p>Talk directly with ManiHub businesses and customers.</p></section><section class="inbox-panel">'+(conversations.length?conversations.map(c=>'<button class="conversation-row" data-conversation="'+esc(c.id)+'"><span class="conversation-avatar">MH</span><span><strong>'+esc((c.subject||'ManiHub conversation').replace('Store:','Store '))+'</strong><small>'+esc(c.conversation_type==='support'?'ManiHub support':'Buyer and seller conversation')+'</small></span><span class="store-arrow">›</span></button>').join(''):'<div class="empty-state compact"><h3>No messages yet</h3><p>Open a store and choose Message seller to start a conversation.</p></div>')+'</section>';
  return '<section class="page-heading"><button class="subtle-button" data-action="inbox">← All messages</button><h1>Conversation</h1><p>Messages are visible only to the people in this conversation.</p></section><section class="chat-panel"><div class="chat-history">'+(messages.length?messages.map(m=>'<div class="chat-message '+(m.sender_id===user?.id?'mine':'')+'"><p>'+esc(m.body)+'</p><small>'+(m.sender_id===user?.id?'You':'Seller / customer')+' · '+esc(new Date(m.created_at).toLocaleString('en-ZA',{dateStyle:'short',timeStyle:'short'}))+'</small></div>').join(''):'<div class="empty-state compact"><p>This conversation is ready. Send the first message.</p></div>')+'</div><form id="message-form" class="message-form"><input name="body" maxlength="10000" placeholder="Write a message…" required><button class="primary-button" type="submit">Send</button></form></section>';
}
function storeDetailMarkup():string{
  if(!activeStore)return '<section class="empty-state"><h3>Store not found</h3><button class="subtle-button" data-view="explore">Back to Explore</button></section>';
  const storeProducts=products.filter(p=>p.store_id===activeStore?.id);
  return '<section class="store-detail-head"><div class="store-detail-brand">'+(activeStore.logo_url?'<img src="'+esc(activeStore.logo_url)+'" alt="">':'<span class="store-avatar large">'+esc(initials(activeStore.store_name))+'</span>')+'<div><span class="eyebrow">MANIHUB STOREFRONT</span><h1>'+esc(activeStore.store_name)+'</h1><p>'+esc([activeStore.town,activeStore.province].filter(Boolean).join(', '))+' · '+esc(activeStore.category)+'</p></div></div><p class="store-description">'+esc(activeStore.description||'Welcome to our ManiHub store.')+'</p><button class="primary-button" data-action="start-conversation">Message seller</button></section><section class="content-section"><div class="section-heading"><h2>Store catalogue</h2><span class="result-count">'+storeProducts.length+' products</span></div><div class="product-grid">'+(storeProducts.length?storeProducts.map(productCard).join(''):'<div class="empty-state compact"><p>This store has not published products yet.</p></div>')+'</div></section>';
}

function productDetailMarkup():string{
  if(!selectedProduct)return '<section class="empty-state"><h3>Product not found</h3><button class="subtle-button" data-view="explore">Back to Explore</button></section>';
  const isStoreProduct='product_name' in selectedProduct;
  const title=isStoreProduct?selectedProduct.product_name:selectedProduct.title;
  const description=selectedProduct.description||'No description has been added yet.';
  const image=isStoreProduct?(selectedProduct.media_urls?.[0]||''):(selectedProduct.photo_url||'');
  const price=isStoreProduct?selectedProduct.price_zar:selectedProduct.price;
  const storeInfo=isStoreProduct?(Array.isArray(selectedProduct.manihub_stores)?selectedProduct.manihub_stores[0]:selectedProduct.manihub_stores):null;
  const seller=isStoreProduct?(storeInfo?.store_name||'ManiHub seller'):(selectedProduct.seller_name||'Community seller');
  if(isStoreProduct)activeStore=stores.find(store=>store.id===selectedProduct.store_id)||null;
  return '<section class="page-heading"><button class="subtle-button" data-view="explore">← Back to Explore</button></section><section class="product-detail-panel">'+(image?'<img class="product-detail-image" src="'+esc(image)+'" alt="'+esc(title)+'">':'<div class="product-detail-placeholder">ManiHub</div>')+'<div class="product-detail-copy"><span class="eyebrow">'+esc(selectedProduct.category||'Marketplace')+'</span><h1>'+esc(title)+'</h1><strong class="detail-price">'+money(Number(price))+'</strong><p>'+esc(description)+'</p><div class="detail-seller"><span class="store-avatar">'+esc(initials(seller))+'</span><div><strong>'+esc(seller)+'</strong><small>'+esc(isStoreProduct?[storeInfo?.town,storeInfo?.province].filter(Boolean).join(', '):[selectedProduct.town,selectedProduct.province].filter(Boolean).join(', '))+'</small></div></div>'+(isStoreProduct&&activeStore?.owner_id!==user?.id?'<button class="primary-button" data-action="start-conversation">Message seller</button>':isStoreProduct?'<button class="subtle-button" data-view="my-store">Manage your product</button>':'<p class="detail-note">Contact options for community listings will be connected in the next seller tools milestone.</p>')+'</div></section>';
}

function pageMarkup():string{
  if(view==='product-detail')return productDetailMarkup();
  if(view==='explore')return exploreMarkup();
  if(view==='my-store')return myStoreMarkup();
  if(view==='messages')return messagesMarkup();
  if(view==='store-detail')return storeDetailMarkup();
  return homeMarkup();
}

function render():void{
  app.innerHTML=user&&mode!=='new-password'?shellMarkup():authMarkup();
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
  const [storeResult,productResult,listingResult,popularityResult]=await Promise.all([
    supabase.from('manihub_stores').select('id,owner_id,store_name,description,category,province,town,logo_url,banner_url,seller_type').eq('status','active').order('created_at',{ascending:false}).limit(30),
    supabase.from('manihub_store_products').select('id,product_name,description,category,price_zar,stock_quantity,media_urls,store_id,manihub_stores(store_name,town,province,logo_url)').eq('status','active').order('created_at',{ascending:false}).limit(40),
    supabase.from('listings').select('id,title,description,price,category,seller_name,province,town,photo_url').eq('status','active').order('created_at',{ascending:false}).limit(40),
    supabase.rpc('manihub_get_listing_popularity')
  ]);
  stores=storeResult.error?[]:(storeResult.data as Store[]||[]);
  products=productResult.error?[]:(productResult.data as Product[]||[]);
  listings=listingResult.error?[]:(listingResult.data as Listing[]||[]);
  popularity=popularityResult.error?[]:(popularityResult.data as Popularity[]||[]);
  if(storeResult.error)console.warn('Store catalogue could not load',storeResult.error.message);
  if(productResult.error)console.warn('Store products could not load',productResult.error.message);
  if(listingResult.error)console.warn('Community listings could not load',listingResult.error.message);
}

function normalizePhone(value:string):string{
  const compact=value.replace(/[^0-9+]/g,'');
  if(compact.startsWith('0'))return '+27'+compact.slice(1);
  if(compact.startsWith('27'))return '+'+compact;
  return compact;
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
    if(mode==='verify'){
      const token=String(data.get('token')||'').trim();
      const {data:result,error}=await supabase.auth.verifyOtp({phone:pendingPhone,token,type:'sms'});
      if(error)throw error;
      if(!result.user)throw new Error('The verification code was not accepted. Request a new code and try again.');
      session=result.session;user=result.user;await ensureProfile(result.user);await loadMarketplace();await loadConversations();view='home';busy=false;render();notify('Your cellphone number is verified. Welcome to ManiHub.');return;
    }
    if(mode==='new-password'){
      const confirmation=String(data.get('password_confirm')||'');
      if(password.length<8)throw new Error('Use a password with at least 8 characters.');
      if(password!==confirmation)throw new Error('The passwords do not match.');
      const {error}=await supabase.auth.updateUser({password});
      if(error)throw error;
      mode='signin';busy=false;await supabase.auth.signOut();session=null;user=null;profile=null;render();notify('Your password has been changed. Sign in with your new password.');return;
    }
    if(mode==='signup'){
      const displayName=String(data.get('display_name')||'').trim();
      const accountType=String(data.get('account_type')||'individual');
      const isEmail=identifier.includes('@');
      const phone=normalizePhone(identifier);
      const credentials=isEmail?{email:identifier,password}:{phone,password};
      const {data:result,error}=await supabase.auth.signUp({...credentials,options:{data:{display_name:displayName,account_type:accountType}}});
      if(error)throw error;
      if(result.session&&result.user){
        session=result.session;user=result.user;await ensureProfile(result.user);await loadMarketplace();await loadConversations();view='home';busy=false;render();notify('Welcome to ManiHub, '+displayName+'!');return;
      }
      if(!isEmail){pendingPhone=phone;mode='verify';busy=false;render();showAuthMessage('A verification code has been sent to your cellphone. Enter it below to finish creating your account.');return;}
      mode='signin';busy=false;render();showAuthMessage('Your account request was received. Check your email for the verification link before signing in.');return;
    }
    const credentials=identifier.includes('@')?{email:identifier,password}:{phone:normalizePhone(identifier),password};
    const {data:result,error}=await supabase.auth.signInWithPassword(credentials);
    if(error)throw error;
    session=result.session;user=result.user;await ensureProfile(result.user);await loadMarketplace();await loadConversations();view='home';busy=false;render();notify('You are signed in.');
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
  try{await ensureProfile(user);await loadMarketplace();await loadConversations();render();}
  catch(error){console.error('ManiHub account setup failed',error);render();notify('Your account is connected, but profile data could not load. Please contact support.','error');}
}

app.addEventListener('click',async event=>{
  const target=(event.target as HTMLElement).closest<HTMLElement>('[data-action],[data-view],[data-category],[data-store]');
  if(!target)return;
  const action=target.dataset.action;
  if(target.dataset.view){view=target.dataset.view as View;render();window.scrollTo({top:0,behavior:'smooth'});return;}
  if(target.dataset.category){category=target.dataset.category;render();return;}
  if(target.dataset.shelf){homeShelf=target.dataset.shelf as 'sales'|'hot'|'frequent';render();return;}
  if(target.dataset.store){activeStore=stores.find(s=>s.id===target.dataset.store)||null;view='store-detail';render();return;}
  if(target.dataset.conversation){selectedConversationId=target.dataset.conversation;await loadMessages(selectedConversationId);view='messages';render();return;}
  if(target.dataset.product){selectedProduct=target.dataset.productKind==='store'?products.find(p=>p.id===target.dataset.product)||null:listings.find(p=>p.id===target.dataset.product)||null;view='product-detail';render();return;}
  if(action==='signup-mode'){mode='signup';render();}
  if(action==='signin-mode'){mode='signin';render();}
  if(action==='reset-mode'){mode='reset';render();}
  if(action==='resend-otp'){if(!pendingPhone){notify('Enter your cellphone number again to request a code.','error');mode='signin';render();return;}const {error}=await supabase.auth.resend({type:'sms',phone:pendingPhone});if(error)notify(error.message,'error');else notify('A new verification code has been sent.');}
  if(action==='toggle-password'){const input=document.querySelector<HTMLInputElement>('#auth-form input[name="password"]');if(input){input.type=input.type==='password'?'text':'password';target.textContent=input.type==='password'?'Show':'Hide';}}
  if(action==='search'){const input=document.querySelector<HTMLInputElement>('#explore-search')||document.querySelector<HTMLInputElement>('#global-search');if(input)searchTerm=input.value;view='explore';render();}
  if(action==='signout'){await supabase.auth.signOut();session=null;user=null;profile=null;render();}
  if(action==='account'){notify('Signed in as '+(user?.email||user?.phone||'ManiHub member'));}
  if(action==='new-product'){const editor=document.querySelector<HTMLElement>('#product-editor');if(editor)editor.hidden=false;}
  if(action==='cancel-product'){const editor=document.querySelector<HTMLElement>('#product-editor');if(editor)editor.hidden=true;}
  if(action==='change-store'){activeStore=null;view='my-store';render();}
  if(action==='start-conversation'){if(!activeStore||!user){notify('Sign in to message this seller.','error');return;}const {data,error}=await supabase.rpc('manihub_start_seller_conversation',{p_store_id:activeStore.id});if(error){notify(error.message,'error');return;}selectedConversationId=String(data);await loadConversations();await loadMessages(selectedConversationId);view='messages';render();}
  if(action==='inbox'){selectedConversationId=null;messages=[];view='messages';render();}
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
  if(form.id==='message-form'){
    event.preventDefault();if(!user||!selectedConversationId)return;
    const data=new FormData(form),body=String(data.get('body')||'').trim();if(!body)return;
    const {error}=await supabase.from('manihub_messages').insert({conversation_id:selectedConversationId,sender_id:user.id,body});
    if(error){notify(error.message,'error');return;}
    await loadMessages(selectedConversationId);render();
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
  render();
  try{
    const {error:healthError}=await supabase.from('listings').select('id',{head:true,count:'exact'}).limit(1);
    if(healthError)throw healthError;
    backendStatus='connected';
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    await startSession(data.session);
    supabase.auth.onAuthStateChange((event,nextSession)=>{if(event==='PASSWORD_RECOVERY'){session=nextSession;user=nextSession?.user||null;mode='new-password';render();return;}void startSession(nextSession);});
    if(new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery'){mode='new-password';render();}
  }catch(error){
    console.error('ManiHub startup failed',error);
    backendStatus='error';
    app.innerHTML='<main class="auth-screen"><div class="auth-brand">'+logo('auth-logo')+'</div><section class="auth-card"><h1>We could not connect</h1><p class="auth-intro">ManiHub could not reach the account service. Check your internet connection and try again.</p><p class="inline-message">'+esc(error instanceof Error?error.message:'Connection error')+'</p><button class="primary-button full-button" id="retry-connect">Try again</button></section></main>';
    document.querySelector('#retry-connect')?.addEventListener('click',()=>location.reload());
  }
}
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.info('Offline support unavailable',e)));
void init();