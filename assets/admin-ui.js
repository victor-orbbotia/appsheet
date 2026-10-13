/* Convenções visuais compartilhadas; não decide ações ou autorizações. */
window.AdminUI=(()=>{
 let refresh=null,observer=null;
 function posicionar(){
  if(new URLSearchParams(location.search).get('embedded')==='1')return;
  const barra=document.getElementById('admin-session-bar');if(!barra)return;
  if(!refresh)refresh=document.getElementById('refresh-catalog')||document.getElementById('btnAtualizar')||document.querySelector('button[onclick="carregarLista()"]');
  if(!refresh){refresh=document.createElement('button');refresh.id='admin-refresh';refresh.type='button';refresh.textContent='⟳';refresh.onclick=()=>window.location.reload();}
  if(!refresh.id){refresh.id='admin-refresh';refresh.textContent='⟳';}
  refresh.title='Atualizar dados da página';refresh.setAttribute('aria-label','Atualizar dados da página');
  if(refresh.id!=='refresh-catalog')refresh.onclick=()=>window.location.reload();
  if(refresh.parentElement!==barra)barra.insertBefore(refresh,barra.querySelector('button'));
  if(!observer){observer=new MutationObserver(posicionar);observer.observe(barra,{childList:true});}
 }
 function iniciar(){if(window.AdminSession?.enabled)window.AdminSession.ready.then(posicionar).catch(()=>{});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
 return {posicionar};
})();
