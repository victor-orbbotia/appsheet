// Contrato compartilhado; incorporado nos nós n8n e distribuído ao frontend.
function criarCatalogo() {
  const normalizar = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const valor = value => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  };
  function metadata(product) {
    try { return typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata || {}; }
    catch { return {}; }
  }
  function opcoes(product) {
    const meta = metadata(product);
    const list = Array.isArray(meta.variacoes) && meta.variacoes.length ? meta.variacoes : meta.tamanhos;
    const variavel = ['com_variacoes', 'com_tamanhos'].includes(meta.tipo) || (Array.isArray(list) && list.length > 0);
    if (product.ativo === false || product.deletado === true || meta.esgotado === true || normalizar(meta.status_estoque) === 'esgotado') return [];
    if (!variavel) {
      const preco = valor(product.preco_base);
      return preco === null ? [] : [{ variacao: '', nome: String(product.nome), preco }];
    }
    return (Array.isArray(list) ? list : []).filter(v => v && String(v.nome || '').trim() && v.ativo !== false && v.esgotado !== true && normalizar(v.status_estoque) !== 'esgotado' && valor(v.preco) !== null)
      .map(v => ({ variacao: String(v.nome).trim(), nome: `${product.nome} — ${String(v.nome).trim()}`, preco: valor(v.preco) }));
  }
  function resolver(products, item) {
    const quantity = Number(item.quantidade ?? item.quantidade_item ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Quantidade inválida (1 a 99).');
    const id = String(item.produto_id || item.id_produto || '');
    const requested = String(item.nome || item.nome_item || '').trim();
    const variant = String(item.variacao || '').trim();
    const candidates = products.flatMap(p => opcoes(p).map(o => ({ ...o, produto_id: String(p.id), produto_nome: p.nome, categoria: p.categoria })))
      .filter(o => id ? o.produto_id === id : (normalizar(o.nome) === normalizar(requested) || normalizar(o.produto_nome) === normalizar(requested)))
      .filter(o => variant ? normalizar(o.variacao) === normalizar(variant) : (!o.variacao || normalizar(o.nome) === normalizar(requested)));
    if (candidates.length !== 1) throw new Error('Selecione um produto disponível e sua variação no catálogo.');
    const selected = candidates[0];
    return { produto_id: selected.produto_id, variacao: selected.variacao, nome: selected.nome, categoria: selected.categoria,
      quantidade: quantity, preco: selected.preco, observacao: String(item.observacao || '').trim().slice(0, 180) };
  }
  return { normalizar, valor, metadata, opcoes, resolver };
}
if (typeof module !== 'undefined') module.exports = criarCatalogo;
if (typeof window !== 'undefined') window.criarCatalogo = criarCatalogo;
