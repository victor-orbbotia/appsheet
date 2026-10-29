'use strict';
window.CatalogoNavegacao=(()=>{
 const allowed={module:['produtos','entregas','upsell'],type:['common','pizza','addons'],common:['list','new'],addon:['list','new','where','advanced'],advanced:['prices','rules'],delivery:['new','list','other'],pizza:['items','sizes','lines','flavors','borders','extras']};
 const key=(account,segment)=>{const user=window.AdminSession?.navigation?.userId;return user?'orbbotia:catalogo:abas:v2:'+encodeURIComponent(user)+':'+encodeURIComponent(account)+':'+encodeURIComponent(segment):null;};
 function ler(account,segment){if(!key(account,segment))return {};try{const value=JSON.parse(sessionStorage.getItem(key(account,segment))||'{}');return Object.fromEntries(Object.entries(value).filter(([k,v])=>allowed[k]?.includes(v)));}catch{return {};}}
 function gravar(account,segment,patch){if(!account||!key(account,segment))return;try{const value={...ler(account,segment)};for(const [k,v]of Object.entries(patch))if(allowed[k]?.includes(v))value[k]=v;sessionStorage.setItem(key(account,segment),JSON.stringify(value));}catch{}}
 return {ler,gravar};
})();
