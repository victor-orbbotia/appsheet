'use strict';

// Módulo puro: catálogo recebido exclusivamente do banco pelo backend.
// Não grava pedidos, não recebe credenciais e não decide etapas do atendimento.
function criarMotorPersonalizacoes(dados) {
  const copiar = value => JSON.parse(JSON.stringify(value));
  const tabelas = ['produtos', 'categorias', 'produto_variacoes', 'personalizacao_grupos',
    'personalizacao_opcoes', 'categoria_personalizacao_grupos', 'produto_personalizacao_grupos',
    'produto_personalizacao_opcoes', 'variacao_personalizacao_precos'];
  for (const tabela of tabelas) {
    if (!Array.isArray(dados?.[tabela])) throw new Error(`Catálogo incompleto: ${tabela}`);
  }
  const banco = copiar(dados);
  function falhar(codigo, detalhes = {}) {
    const erro = new Error(codigo);
    erro.codigo = codigo;
    erro.detalhes = detalhes;
    throw erro;
  }
  function inteiro(valor, minimo, campo) {
    if (!Number.isSafeInteger(valor) || valor < minimo) falhar('quantidade_invalida', { campo });
    return valor;
  }
  function centavos(valor) {
    // NUMERIC do PostgreSQL chega como string; não arredondar preço inválido.
    if (!['string', 'number'].includes(typeof valor) ||
        !/^\d+(\.\d{1,2})?$/.test(String(valor))) falhar('preco_invalido');
    const [reais, fracao = ''] = String(valor).split('.');
    const total = Number(reais) * 100 + Number(fracao.padEnd(2, '0'));
    if (!Number.isSafeInteger(total)) falhar('preco_invalido');
    return total;
  }
  function seguro(valor) {
    if (!Number.isSafeInteger(valor) || valor < 0) falhar('total_fora_do_limite');
    return valor;
  }
  const ordenar = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  function escopoValido(escopo) {
    if (typeof escopo?.account_id !== 'string' || !escopo.account_id.trim() ||
        typeof escopo.segmento !== 'string' || !escopo.segmento.trim()) falhar('escopo_invalido');
  }
  const linhas = (tabela, escopo) => banco[tabela].filter(r =>
    r.account_id === escopo.account_id && r.segmento === escopo.segmento);
  function unico(lista, codigo) {
    if (lista.length !== 1) falhar(codigo);
    return lista[0];
  }
  function limites(min, max) {
    inteiro(min, 0, 'min_selecoes'); inteiro(max, 0, 'max_selecoes');
    if (max < min) falhar('configuracao_invalida');
  }
  function verificarImportacao(produto, categoria, variacoes) {
    if ((produto.categoria || null) !== (categoria?.nome || null)) {
      falhar('catalogo_desatualizado', { motivo: 'categoria' });
    }
    const metadata = produto.metadata || {};
    const normalizar = lista => {
      if (lista == null) return null;
      if (!Array.isArray(lista)) falhar('catalogo_desatualizado', { motivo: 'variacoes_invalidas' });
      return lista.map(v => {
        if (!v || typeof v.nome !== 'string' || !v.nome.trim()) {
          falhar('catalogo_desatualizado', { motivo: 'variacoes_invalidas' });
        }
        return [v.nome, centavos(v.preco)];
      });
    };
    const atual = normalizar(metadata.variacoes), legado = normalizar(metadata.tamanhos);
    if (atual && legado && JSON.stringify(atual) !== JSON.stringify(legado)) {
      falhar('catalogo_desatualizado', { motivo: 'arrays_divergentes' });
    }
    const referencia = atual || legado || [];
    const importadas = [...variacoes].sort((a, b) => a.ordem - b.ordem || ordenar(a, b))
      .map(v => [v.nome, centavos(v.preco)]);
    if (JSON.stringify(referencia) !== JSON.stringify(importadas)) {
      falhar('catalogo_desatualizado', { motivo: 'variacoes' });
    }
  }
  function resolver(escopo, entrada) {
    escopoValido(escopo);
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) falhar('entrada_invalida');
    const produto = unico(linhas('produtos', escopo).filter(p => p.id === entrada.produto_id), 'produto_indisponivel');
    if (produto.ativo !== true || produto.deletado === true || produto.metadata?.esgotado === true ||
        produto.metadata?.status_estoque === 'esgotado') falhar('produto_indisponivel');
    const categoria = produto.categoria_id
      ? unico(linhas('categorias', escopo).filter(c => c.id === produto.categoria_id), 'categoria_invalida') : null;
    if (categoria && categoria.ativo !== true) falhar('categoria_indisponivel');
    const todasVariacoes = linhas('produto_variacoes', escopo).filter(v => v.produto_id === produto.id && v.ativo === true);
    verificarImportacao(produto, categoria, todasVariacoes);
    let variacao = null;
    if (todasVariacoes.length) {
      if (!entrada.variacao_id) falhar('variacao_obrigatoria', {
        variacoes: todasVariacoes.filter(v => v.ativo).map(v => ({ id: v.id, nome: v.nome, preco: v.preco }))
      });
      variacao = unico(todasVariacoes.filter(v => v.id === entrada.variacao_id && v.ativo === true), 'variacao_indisponivel');
    } else if (entrada.variacao_id) falhar('variacao_indisponivel');
    const precoBase = centavos(variacao ? variacao.preco : produto.preco_base);
    const vinculos = linhas('produto_personalizacao_grupos', escopo).filter(v => v.produto_id === produto.id);
    const efetivos = new Set(linhas('categoria_personalizacao_grupos', escopo)
      .filter(v => categoria && v.categoria_id === categoria.id).map(v => v.grupo_id));
    for (const v of vinculos) {
      if (v.modo === 'incluir') efetivos.add(v.grupo_id);
      else if (v.modo === 'excluir') efetivos.delete(v.grupo_id);
      else falhar('configuracao_invalida');
    }
    const grupos = [];
    for (const id of [...efetivos].sort()) {
      const grupo = unico(linhas('personalizacao_grupos', escopo).filter(g => g.id === id), 'configuracao_invalida');
      if (!grupo.ativo) continue;
      const especifico = vinculos.find(v => v.grupo_id === id);
      const min = especifico?.min_selecoes ?? grupo.min_selecoes;
      const max = especifico?.max_selecoes ?? grupo.max_selecoes;
      limites(min, max);
      const excluidas = linhas('produto_personalizacao_opcoes', escopo)
        .filter(v => v.produto_id === produto.id && v.grupo_id === id && v.excluida).map(v => v.opcao_id);
      const opcoes = linhas('personalizacao_opcoes', escopo)
        .filter(o => o.grupo_id === id && o.ativo === true && !excluidas.includes(o.id))
        .sort(ordenar).map(o => {
          inteiro(o.max_quantidade, 1, 'max_quantidade');
          if (typeof o.permite_quantidade !== 'boolean' || (!o.permite_quantidade && o.max_quantidade !== 1)) {
            falhar('configuracao_invalida');
          }
          const overrides = linhas('variacao_personalizacao_precos', escopo).filter(v =>
            variacao && v.variacao_id === variacao.id && v.produto_id === produto.id && v.grupo_id === id && v.opcao_id === o.id);
          if (overrides.length > 1) falhar('configuracao_invalida');
          return { id: o.id, nome: o.nome, permite_quantidade: o.permite_quantidade,
            max_quantidade: o.max_quantidade, preco_centavos: centavos(overrides.length ? overrides[0].preco : o.preco_padrao) };
        });
      if (opcoes.reduce((s, o) => seguro(s + o.max_quantidade), 0) < min) {
        falhar('grupo_obrigatorio_indisponivel', { grupo_id: id });
      }
      grupos.push({ id, nome: grupo.nome, min_selecoes: min, max_selecoes: max, opcoes });
    }
    const catalogo = { produto_id: produto.id, nome: produto.nome, categoria_id: produto.categoria_id || null,
      variacao_id: variacao?.id || null, variacao: variacao?.nome || '', preco_base_centavos: precoBase, grupos };
    // Revisão determinística para detectar alterações, não é token de autorização.
    return { ...catalogo, revisao_catalogo: JSON.stringify(catalogo) };
  }
  function executar(fn) {
    try { return fn(); }
    catch (erro) {
      if (!erro.codigo) throw erro;
      return { status: 'pendencia', codigo: erro.codigo, ...erro.detalhes };
    }
  }
  function consultarProduto(escopo, entrada) {
    return executar(() => ({ status: 'sucesso', catalogo: resolver(escopo, entrada) }));
  }
  function validarItem(escopo, entrada) {
    return executar(() => {
      const catalogo = resolver(escopo, entrada);
      const quantidade = inteiro(entrada.quantidade, 1, 'quantidade');
      if (!Array.isArray(entrada.modificadores)) falhar('modificadores_invalidos');
      const observacao = entrada.observacao ?? '';
      if (typeof observacao !== 'string' || observacao.length > 2000) falhar('observacao_invalida');
      const vistos = new Set(), contagem = new Map(), modificadores = [];
      let adicionais = 0;
      for (const escolha of entrada.modificadores) {
        if (!escolha || typeof escolha !== 'object') falhar('modificadores_invalidos');
        const grupo = catalogo.grupos.find(g => g.id === escolha.grupo_id);
        const opcao = grupo?.opcoes.find(o => o.id === escolha.opcao_id);
        if (!opcao) falhar('opcao_indisponivel');
        if (vistos.has(opcao.id)) falhar('opcao_duplicada', { opcao_id: opcao.id });
        vistos.add(opcao.id);
        const qtd = inteiro(escolha.quantidade, 1, 'modificador.quantidade');
        if (qtd > opcao.max_quantidade) falhar('limite_opcao', { opcao_id: opcao.id });
        contagem.set(grupo.id, seguro((contagem.get(grupo.id) || 0) + qtd));
        adicionais = seguro(adicionais + seguro(opcao.preco_centavos * qtd));
        modificadores.push({ grupo_id: grupo.id, grupo_nome: grupo.nome, opcao_id: opcao.id,
          nome: opcao.nome, quantidade: qtd, preco: opcao.preco_centavos / 100 });
      }
      for (const grupo of catalogo.grupos) {
        const qtd = contagem.get(grupo.id) || 0;
        if (qtd < grupo.min_selecoes || qtd > grupo.max_selecoes) {
          falhar('limite_grupo', { grupo_id: grupo.id, min_selecoes: grupo.min_selecoes,
            max_selecoes: grupo.max_selecoes, selecionadas: qtd });
        }
      }
      modificadores.sort((a, b) => ordenar({id:a.grupo_id + '/' + a.opcao_id}, {id:b.grupo_id + '/' + b.opcao_id}));
      const precoCentavos = seguro(catalogo.preco_base_centavos + adicionais);
      const item = { contrato_item: 1, produto_id: catalogo.produto_id, nome: catalogo.nome,
        variacao_id: catalogo.variacao_id, variacao: catalogo.variacao, quantidade, observacao,
        preco_base: catalogo.preco_base_centavos / 100, preco: precoCentavos / 100, modificadores };
      const assinatura = JSON.stringify([item.produto_id, item.variacao_id,
        modificadores.map(m => [m.grupo_id, m.opcao_id, m.quantidade])]);
      const resposta = { item: { ...item, assinatura_composicao: assinatura },
        total_centavos: seguro(precoCentavos * quantidade), revisao_catalogo: catalogo.revisao_catalogo };
      if (entrada.revisao_esperada == null || entrada.preco_esperado == null) {
        return { status: 'orcamento', ...resposta };
      }
      if (entrada.revisao_esperada !== catalogo.revisao_catalogo || centavos(entrada.preco_esperado) !== precoCentavos) {
        return { status: 'conflito', codigo: 'orcamento_alterado', ...resposta };
      }
      return { status: 'validado', ...resposta };
    });
  }
  return { consultarProduto, validarItem };
}

// Só aceita snapshots produzidos pelo backend. Não utilizar em payload bruto.
function chaveAgrupamento(item) {
  if (item.contrato_item !== 1 || !Array.isArray(item.modificadores)) throw new Error('Snapshot incompatível');
  const escolhas = [...item.modificadores].sort((a,b) => {
    const esquerda = a.grupo_id + '/' + a.opcao_id, direita = b.grupo_id + '/' + b.opcao_id;
    return esquerda < direita ? -1 : esquerda > direita ? 1 : 0;
  });
  return JSON.stringify([item.produto_id, item.variacao_id, item.observacao,
    item.preco_base, item.preco, escolhas.map(m => [m.grupo_id,m.opcao_id,m.quantidade,m.preco])]);
}


'use strict';

// Frações exatas: um arredondamento comercial no preço unitário final.
function cotarMeiaPizza(dados, escopo, entrada) {
  const fail = (codigo, detalhes = {}) => { throw Object.assign(new Error(codigo), { codigo, detalhes }); };
  const inteiro = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
  const ordenar = lista => [...lista].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  try {
    const c = dados.configuracoes.find(x => x.id === entrada.composicao_id && x.account_id === escopo.account_id && x.segmento === escopo.segmento);
    if (!c || !c.ativo) fail('composicao_indisponivel');
    if (!inteiro(c.minimo,2,4) || !inteiro(c.maximo,c.minimo,4) || !['iguais','personalizada'].includes(c.divisao)) fail('configuracao_invalida');
    const partes = entrada.partes;
    if (!Array.isArray(partes) || !inteiro(partes.length,c.minimo,c.maximo)) fail('limite_sabores');
    if (new Set(partes.map(p=>p.produto_id)).size !== partes.length) fail('sabor_repetido');
    const quantidade = entrada.quantidade ?? 1;
    if (!inteiro(quantidade,1,999)) fail('quantidade_invalida');
    const denominador = c.divisao === 'iguais' ? partes.length : 100;
    const pesos = partes.map(p=>c.divisao === 'iguais' ? 1 : p.percentual);
    if (c.divisao === 'personalizada' && (pesos.some(p=>!inteiro(p,5,95)||p%5) || pesos.reduce((a,b)=>a+b,0)!==100)) fail('fracoes_invalidas');
    const motor = criarMotorPersonalizacoes(dados.catalogo);
    const resolvidos = partes.map((p,i)=>{
      const vinculo = c.sabores.find(f=>f.produto_id===p.produto_id);
      if (!vinculo) fail('sabor_nao_permitido');
      const r = motor.consultarProduto(escopo,{produto_id:p.produto_id,variacao_id:vinculo.variacao_id});
      if (r.status!=='sucesso') fail(r.codigo,{produto_id:p.produto_id});
      return { ...r.catalogo, numerador:pesos[i], denominador };
    });
    // Denominador comum também contém o número de sabores para a média simples.
    const unidade = BigInt(denominador * partes.length);
    const calcular = (valores, formula) => {
      if (valores.some(v=>!inteiro(v,0,Number.MAX_SAFE_INTEGER))) fail('preco_invalido');
      if(formula==='maior') return BigInt(Math.max(...valores))*unidade;
      if(formula==='media') return valores.reduce((s,v)=>s+BigInt(v),0n)*(unidade/BigInt(valores.length));
      if(formula==='proporcional') return valores.reduce((s,v,i)=>s+BigInt(v)*BigInt(pesos[i]),0n)*(unidade/BigInt(denominador));
      fail('formula_invalida');
    };
    let total = calcular(resolvidos.map(p=>p.preco_base_centavos), c.formula);
    const baseExata = total;
    const globais = entrada.globais ?? [];
    if(!Array.isArray(globais) || partes.some(p=>p.modificadores!==undefined&&!Array.isArray(p.modificadores))) fail('modificadores_invalidos');
    const registros = [], usados = new Set(), contagens = new Map();
    const gruposConfigurados = new Map(c.grupos.map(g=>[g.grupo_id,g]));
    for(const p of resolvidos) for(const g of p.grupos) {
      if(g.min_selecoes>0&&!gruposConfigurados.has(g.id)) fail('grupo_obrigatorio_sem_regra',{grupo_id:g.id});
    }
    const adicionar = (m, indice) => {
      const regra = gruposConfigurados.get(m.grupo_id);
      const escopoEsperado = indice===null?'inteira':'parte';
      if(!regra || regra.escopo!==escopoEsperado) fail('escopo_adicional_invalido');
      const key = `${indice ?? 'inteira'}/${m.grupo_id}/${m.opcao_id}`;
      if(usados.has(key)) fail('opcao_duplicada'); usados.add(key);
      if(!inteiro(m.quantidade,1,999)) fail('quantidade_adicional_invalida');
      const indices = indice===null ? resolvidos.map((_,i)=>i) : [indice];
      const opcoes = indices.map(i=>{
        const grupo = resolvidos[i].grupos.find(g=>g.id===m.grupo_id);
        const o = grupo?.opcoes.find(o=>o.id===m.opcao_id);
        if(!o || m.quantidade>o.max_quantidade) fail('opcao_indisponivel_ou_limite',{grupo_id:m.grupo_id,produto_id:resolvidos[i].produto_id});
        const contador=`${i}/${grupo.id}`;
        contagens.set(contador,(contagens.get(contador)||0)+m.quantidade);
        return o;
      });
      let custo;
      if(indice===null) custo=calcular(opcoes.map(o=>o.preco_centavos),regra.cobranca);
      else if(regra.cobranca==='integral') custo=BigInt(opcoes[0].preco_centavos)*unidade;
      else if(regra.cobranca==='proporcional') custo=BigInt(opcoes[0].preco_centavos)*BigInt(pesos[indice])*(unidade/BigInt(denominador));
      else fail('cobranca_invalida');
      custo*=BigInt(m.quantidade); total+=custo;
      registros.push({grupo_id:m.grupo_id,opcao_id:m.opcao_id,nome:opcoes[0].nome,quantidade:m.quantidade,
        escopo:escopoEsperado,produto_id:indice===null?null:resolvidos[indice].produto_id,cobranca:regra.cobranca,
        precos_origem:ordenar(indices.map((i,j)=>({produto_id:resolvidos[i].produto_id,preco_centavos:opcoes[j].preco_centavos}))),valor_exato:{numerador:custo.toString(),denominador:unidade.toString()}});
    };
    globais.forEach(m=>adicionar(m,null));
    partes.forEach((p,i)=>(p.modificadores||[]).forEach(m=>adicionar(m,i)));
    resolvidos.forEach((p,i)=>p.grupos.forEach(g=>{
      const q=contagens.get(`${i}/${g.id}`)||0;
      if(q<g.min_selecoes||q>g.max_selecoes) fail('limite_grupo',{produto_id:p.produto_id,grupo_id:g.id,minimo:g.min_selecoes,maximo:g.max_selecoes});
    }));
    const centavos=(total*2n+unidade)/(unidade*2n);
    if(centavos*BigInt(quantidade)>BigInt(Number.MAX_SAFE_INTEGER)) fail('total_fora_do_limite');
    const composicao=ordenar(resolvidos.map(p=>({produto_id:p.produto_id,variacao_id:p.variacao_id,nome:p.nome,
      variacao:p.variacao,preco_base_centavos:p.preco_base_centavos,fracao:{numerador:p.numerador,denominador:p.denominador}})));
    return {status:'orcamento',venda_habilitada:c.venda_habilitada===true,contrato:'meia_pizza_v1',composicao_id:c.id,
      nome:c.nome,tamanho:c.tamanho,formula:c.formula,versao:c.versao,quantidade,partes:composicao,modificadores:ordenar(registros),
      base_exata:{numerador:baseExata.toString(),denominador:unidade.toString()},
      preco_unitario_centavos:Number(centavos),total_centavos:Number(centavos)*quantidade,
      revisao_catalogo:JSON.stringify({config:c,partes:ordenar(resolvidos.map(p=>({produto_id:p.produto_id,revisao:p.revisao_catalogo})))}),
      assinatura:JSON.stringify({composicao_id:c.id,partes:composicao,modificadores:ordenar(registros)})};
  } catch(e) {
    if(!e.codigo) throw e;
    return {status:'pendencia',codigo:e.codigo,...e.detalhes,venda_habilitada:false};
  }
}

window.criarMotorPersonalizacoes=criarMotorPersonalizacoes;
window.cotarMeiaPizza=cotarMeiaPizza;
