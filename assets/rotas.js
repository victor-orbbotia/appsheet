'use strict';
// URLs legíveis; não é controle de acesso. Os guardas administrativos continuam ativos.
window.OrbbotiaRoutes=(()=>{
 const script=document.currentScript,root=new URL('../',script.src);
 const routes={
  'index.html':'painel/','app/index.html':'','acesso.html':'entrar/','onboarding.html':'configuracao-inicial/',
  'pedidos/index.html':'pedidos/','produtos/novo.html':'catalogo/','conhecimento/novo.html':'conhecimento/',
  'profissionais/novo.html':'equipe/','configuracoes/index.html':'configuracoes/',
  'produtos/meia-pizza.html':'catalogo/pizzas/','produtos/personalizacoes.html':'catalogo/adicionais/',
  'produtos/menu_studio_pro_mobile_first.html':'catalogo/editor/'
 };
 const source=script.dataset.source;
 // A origem dos arquivos relativos é preservada mesmo quando a URL visível muda.
 if(source){let base=document.querySelector('base');if(!base){base=document.createElement('base');document.head.prepend(base);}base.href=new URL('./',new URL(source,root)).href;}
 function url(value,base=document.baseURI){const u=new URL(value,base);if(u.origin===root.origin&&u.pathname.startsWith(root.pathname)){const relative=u.pathname.slice(root.pathname.length);if(Object.hasOwn(routes,relative))u.pathname=root.pathname+routes[relative];
  const admin=Object.values(routes).filter(p=>p&&p!=='entrar/').includes(u.pathname.slice(root.pathname.length));
  const context=window.AdminSession?.navigation;
  if(admin&&context?.empresa&&(!u.searchParams.has('account_id')||u.searchParams.get('account_id')===context.accountId)&&(!u.searchParams.has('empresa')||u.searchParams.get('empresa').toLowerCase()===context.empresa)){
   u.searchParams.delete('account_id');u.searchParams.delete('segmento');u.searchParams.set('empresa',context.empresa);
  }
 }return u;}
 const current=new URL(location.href);
 if(source==='app/index.html'&&(current.searchParams.has('account_id')||current.searchParams.has('empresa')||window.parent!==window)&&!current.searchParams.has('acesso')&&!current.searchParams.has('loja')&&!current.searchParams.has('demo')){location.replace(url('index.html',root).href+current.search);}
 else{const clean=url(current.href);if(source==='app/index.html'&&current.pathname===root.pathname+'index.html')clean.pathname=root.pathname;if(clean.href!==current.href)history.replaceState(history.state,'',clean.href);}
 function links(scope){for(const a of scope.querySelectorAll('a[href]')){const clean=url(a.href);if(clean.href!==a.href)a.href=clean.href;}}
 document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(a)a.href=url(a.href).href;});
 window.addEventListener('admin-contexto-resolvido',()=>links(document));
 document.addEventListener('DOMContentLoaded',()=>{links(document);new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'){const a=r.target;if(a.matches('a[href]')){const clean=url(a.href);if(clean.href!==a.href)a.href=clean.href;}}else for(const n of r.addedNodes)if(n.nodeType===1){if(n.matches('a[href]')){const clean=url(n.href);if(clean.href!==n.href)n.href=clean.href;}links(n);}}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});});
 return {url,root,routes,source};
})();
