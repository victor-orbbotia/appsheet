/* Estado visual compartilhado pelos cadastros. */
window.CadastroUI = (() => {
 let timer;
 function notify(message, error=false) {
  let box=document.getElementById('cadastro-toast');
  if(!box){box=document.createElement('div');box.id='cadastro-toast';box.setAttribute('role','status');box.setAttribute('aria-live','polite');document.body.append(box);}
  box.style.cssText='position:fixed;bottom:20px;right:20px;max-width:min(420px,90vw);padding:14px 18px;border-radius:12px;z-index:10000;box-shadow:0 4px 22px #0002;font:14px system-ui;background:'+(error?'#fff1f2;color:#9f1239':'#ecfdf5;color:#065f46');
  if(window.parent!==window)window.parent.postMessage({type:'cadastro-aviso',message,error},location.origin);
  box.textContent=message;box.hidden=false;clearTimeout(timer);if(!error)timer=setTimeout(()=>box.hidden=true,4500);
 }
 function capture(root=document) {
  const nodes=[...root.querySelectorAll('details')],focus=document.activeElement;
  const anchor=[...root.querySelectorAll('[data-ui-key],section[id],form[id]')].find(n=>n.getBoundingClientRect().top>=0&&n.getBoundingClientRect().top<innerHeight);
  const focusRoot=focus?.closest('[id]');
  return {focusRoot:focusRoot?.id,focusIndex:focusRoot?[...focusRoot.querySelectorAll('input,button,select,textarea')].indexOf(focus):-1,x:scrollX,y:scrollY,anchor:anchor?.dataset.uiKey,anchorId:anchor?.id,top:anchor?.getBoundingClientRect().top,focus,focusKey:focus?.dataset.uiKey,focusId:focus?.id,open:nodes.filter(n=>n.open).map(n=>n.dataset.uiKey||n.dataset.groupId||n.id).filter(Boolean)};
 }
 function restore(s,root=document){
  for(const n of root.querySelectorAll('details'))if(s.open.includes(n.dataset.uiKey||n.dataset.groupId||n.id))n.open=true;
  const find=key=>[...root.querySelectorAll('[data-ui-key]')].find(n=>n.dataset.uiKey===key);
  const f=s.focus?.isConnected?s.focus:(s.focusId?document.getElementById(s.focusId):find(s.focusKey))||document.getElementById(s.focusRoot)?.querySelectorAll('input,button,select,textarea')[s.focusIndex];f?.focus?.({preventScroll:true});
  const a=s.anchorId?document.getElementById(s.anchorId):find(s.anchor);
  scrollTo({left:s.x,top:a&&a.getBoundingClientRect().height?scrollY+a.getBoundingClientRect().top-s.top:s.y,behavior:'instant'});
 }
 return {notify,capture,restore};
})();
