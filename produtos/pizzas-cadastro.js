'use strict';
let saborEditado = null;
function renderGradeSabores() {
  const mount = $('grade-sabores'); mount.replaceChildren();
  const sabores = produtos().filter(p => categoriasPizza().some(c => c.id === p.categoria_id));
  for (const p of sabores) {
    const details = el('details'); details.append(el('summary', p.nome));
    for (const c of dados.configuracoes.filter(c => c.categoria_id === p.categoria_id)) {
      const link = c.sabores.find(f => f.produto_id === p.id);
      const variation = variacoesProduto(p.id).find(v => v.id === link?.variacao_id);
      details.append(el('p', `${c.tamanho}: ${variation ? moeda(Number(variation.preco) * 100) : 'Sem vínculo'} · ${c.nome}`));
    }
    const edit = el('button', 'Editar sabor e preços'); edit.className = 'secondary';
    edit.onclick = () => editarSabor(p); details.append(edit); mount.append(details);
  }
  if (!sabores.length) mount.append(el('p', 'Nenhum sabor cadastrado nesta categoria.'));
}
function editarSabor(p = null) {
  saborEditado = p;
  $('sabor-nome').value = p?.nome || ''; $('sabor-descricao').value = p?.descricao || '';
  $('sabor-categoria').replaceChildren(op('', 'Escolha a categoria'), ...categoriasPizza().map(c => op(c.id, c.nome)));
  $('sabor-categoria').value = p?.categoria_id || (categoriasPizza().length === 1 ? categoriasPizza()[0].id : '');
  $('sabor-categoria').disabled = Boolean(p);
  renderPrecosSabor(); $('editor-sabor').open = true;
  $('editor-sabor').scrollIntoView({behavior: 'smooth', block: 'start'});
}
function renderPrecosSabor() {
  const mount = $('sabor-precos'); mount.replaceChildren();
  const configs = dados.configuracoes.filter(c => c.categoria_id === $('sabor-categoria').value);
  for (const c of configs) {
    const row = el('div'); row.className = 'entry'; row.dataset.tamanhoId = c.id;
    row.append(el('strong', `${c.tamanho} · ${c.nome}`));
    const link = c.sabores.find(f => f.produto_id === saborEditado?.id);
    const variants = saborEditado ? variacoesProduto(saborEditado.id) : [];
    const variant = variants.find(v => v.id === link?.variacao_id);
    const label = el('label', 'Preço da pizza inteira neste tamanho (R$)');
    const price = el('input'); price.type = 'number'; price.min = '0'; price.step = '0.01'; price.dataset.preco = '1';
    price.value = variant ? Number(variant.preco).toFixed(2) : ''; price.placeholder = 'Não cadastrar neste tamanho'; label.append(price); row.append(label);
    const mapping = select([['', 'Criar variação para este tamanho'], ...variants.map(v => [v.id, `${v.nome} · ${moeda(Number(v.preco) * 100)}`])], link?.variacao_id || '');
    mapping.dataset.vinculo = '1'; mapping.disabled = Boolean(link); mapping.setAttribute('aria-label', `Variação correspondente a ${c.tamanho}`);
    mapping.onchange = () => { const v = variants.find(v => v.id === mapping.value); if (v) price.value = Number(v.preco).toFixed(2); };
    if (variants.length) row.append(el('small', link ? 'Vínculo existente preservado.' : 'Cadastro antigo: selecione uma vez qual variação corresponde a este tamanho. Não associamos nomes automaticamente.'), mapping);
    else row.append(mapping);
    mount.append(row);
  }
  if (!configs.length) mount.append(el('p', 'Cadastre um tamanho como rascunho na seção abaixo antes de adicionar os preços.'));
}
$('novo-sabor').onclick = () => editarSabor();
$('sabor-categoria').onchange = renderPrecosSabor;
$('personalizacoes-link').href = 'personalizacoes.html?' + new URLSearchParams({account_id: $('conta').value, segmento});
$('salvar-sabor').onclick = () => executar(async () => {
  if (!$('sabor-nome').value.trim() || !$('sabor-categoria').value) throw Error('Informe nome e categoria do sabor.');
  if (!Number.isSafeInteger(dados.versao_catalogo)) throw Error('Atualize o banco e o workflow de pizzas antes de salvar nesta grade.');
  const precos = [...$('sabor-precos').children].filter(row => row.dataset.tamanhoId && row.querySelector('[data-preco]').value !== '').map(row => {
    const c = dados.configuracoes.find(c => c.id === row.dataset.tamanhoId);
    const value = row.querySelector('[data-preco]').value;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Informe preços positivos ou zero, com até duas casas decimais.');
    return {composicao_id: c.id, versao: c.versao, preco: value, variacao_id: row.querySelector('[data-vinculo]').value || null};
  });
  if (!precos.length) throw Error('Informe o preço em pelo menos um tamanho.');
  dados = await request('salvar_sabor', {id: saborEditado?.id, nome: $('sabor-nome').value.trim(), descricao: $('sabor-descricao').value.trim(), categoria_id: $('sabor-categoria').value, precos}, dados.versao_catalogo);
  lista(); formulario(); $('editor-sabor').open = false;
  aviso('Sabor e preços salvos. Os vínculos dos tamanhos foram atualizados. A liberação de venda de cada montagem permanece como estava.');
});
