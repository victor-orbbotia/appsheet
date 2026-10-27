/* Ajuda junto ao campo, sem aumentar o espaço entre rótulo e controle. */
(() => {
 function organizar(){
  for(const label of document.querySelectorAll('body.catalogo-formularios label:has(.field-hint)')){
   const control=label.control || label.querySelector('input,select,textarea');
   if(!control || control.type==='checkbox' || label.closest('.pdf-page,#preview-canvas'))continue;
   const hints=[...label.querySelectorAll('.field-hint')];
   let anchor=control;
   for(const hint of hints){
    anchor.after(hint);anchor=hint;
    if(control.id){hint.id ||= `${control.id}-ajuda`;const ids=new Set((control.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(hint.id);control.setAttribute('aria-describedby',[...ids].join(' '));}
   }
  }
 }
 organizar();
 new MutationObserver(organizar).observe(document.body,{childList:true,subtree:true});
})();
