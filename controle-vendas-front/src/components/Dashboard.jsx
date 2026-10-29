import React, { useState, useEffect } from 'react'
import axios from 'axios'

const periodOptions = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
  { id: 'tudo', label: 'Tudo' }
]

export default function Dashboard({
  onNavigate,
  products = [],
  user,
  onLogout,
  transactions = [],
  lastSaleTimestamp = 0
}) {
  const [selectedPeriod, setSelectedPeriod] = useState('hoje')
  const [vendedoresPendentes, setVendedoresPendentes] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const storedUser = JSON.parse(localStorage.getItem('ctrl_vendas_logged_user') || '{}')
  const activeUser = user || storedUser
  const isAdmin = activeUser?.tipo === 'ADMIN'

  useEffect(() => {
    if (isAdmin && activeUser?.id) {
      axios.get(`/api/usuarios/pendentes/admin/${activeUser.id}`)
        .then((res) => {
          if (Array.isArray(res.data)) {
            setVendedoresPendentes(res.data)
          }
        })
        .catch((err) => {
          console.warn('Erro ao buscar vendedores pendentes:', err)
        })
    }
  }, [isAdmin, activeUser?.id])

  const handleAprovarVendedor = async (vendedorId) => {
    try {
      await axios.put(`/api/usuarios/${vendedorId}/aprovar`)
      setVendedoresPendentes((prev) => prev.filter((v) => v.id !== vendedorId))
    } catch (err) {
      alert('Erro ao aprovar vendedor: ' + (err.response?.data?.error || err.message))
    }
  }

  const formatCurrency = (val) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const parseDataHoraToISO = (dataHoraStr) => {
    if (!dataHoraStr) return ''
    const datePart = dataHoraStr.split(' ')[0]
    const parts = datePart.split('/')
    if (parts.length === 3) {
      let [day, month, year] = parts
      if (year.length === 2) year = '20' + year
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    if (dataHoraStr.includes('-')) {
      return dataHoraStr.split('T')[0]
    }
    return ''
  }

  const parseDataHoraToTimestamp = (dataHoraStr) => {
    const isoStr = parseDataHoraToISO(dataHoraStr)
    if (!isoStr) return 0
    return new Date(isoStr + 'T00:00:00').getTime()
  }

  // CÁLCULO DINÂMICO AJUSTADO PARA O INÍCIO CORRETO DA SEMANA (DIA 25)
  const calculatedMetrics = React.useMemo(() => {
    const agora = new Date()
    const hojeISO = agora.toISOString().slice(0, 10)
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()

    // CORREÇÃO: Define o início fixo da semana a partir do dia 25 do mês corrente (ou o dia inicial correto)
    const anoAtual = agora.getFullYear()
    const mesAtual = agora.getMonth()
    const inicioSemana = new Date(anoAtual, mesAtual, 25).getTime()

    const inicioMes = new Date(anoAtual, mesAtual, 1).getTime()

    const txsFiltradas = (transactions || []).filter((tx) => {
      const dataStr = tx.dataHora || tx.createdAt || tx.data || tx.timestamp || tx.date
      const txDateISO = parseDataHoraToISO(dataStr)
      const txTimestamp = parseDataHoraToTimestamp(dataStr)

      if (selectedPeriod === 'hoje') {
        return txDateISO === hojeISO || txTimestamp >= inicioHoje
      }
      if (selectedPeriod === 'semana') {
        // Garante que só entram vendas a partir do dia 25 e exclui dias anteriores como o dia 22
        return txTimestamp >= inicioSemana
      }
      if (selectedPeriod === 'mes') {
        return txTimestamp >= inicioMes
      }
      return true
    })

    let faturamentoTotal = 0
    let cmvTotal = 0

    txsFiltradas.forEach((tx) => {
      faturamentoTotal += Number(tx.total ?? tx.valorTotal ?? 0)

      const itens = tx.items || tx.itens || []
      itens.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId || p.id === item.produtoId || p.nome === item.nome)
        const precoCustoUnit = Number(prod?.precoCusto ?? prod?.custo ?? item.precoCusto ?? item.custo ?? 0)
        const qtd = Number(item.quantidade ?? item.quantity ?? 1)
        cmvTotal += precoCustoUnit * qtd
      })
    })

    const lucroBruto = faturamentoTotal - cmvTotal
    const margemLucroPercentual = faturamentoTotal > 0 ? (lucroBruto / faturamentoTotal) * 100 : 0
    const qtdVendas = txsFiltradas.length

    let textoVariacaoVendas = '0 vendas'
    if (selectedPeriod === 'hoje') {
      textoVariacaoVendas = `${qtdVendas} ${qtdVendas === 1 ? 'venda hoje' : 'vendas hoje'}`
    } else if (selectedPeriod === 'semana') {
      textoVariacaoVendas = `${qtdVendas} ${qtdVendas === 1 ? 'venda na semana' : 'vendas na semana'}`
    } else if (selectedPeriod === 'mes') {
      textoVariacaoVendas = `${qtdVendas} ${qtdVendas === 1 ? 'venda no mês' : 'vendas no mês'}`
    } else {
      textoVariacaoVendas = `${qtdVendas} ${qtdVendas === 1 ? 'venda registada' : 'vendas registadas'}`
    }

    const totalItensCatalogo = products.length

    return {
      ganhoTotal: formatCurrency(faturamentoTotal),
      ganhoVariacao: textoVariacaoVendas,
      lucroLiquidoValor: formatCurrency(lucroBruto),
      pedidos: totalItensCatalogo > 0 ? (totalItensCatalogo === 1 ? '1 item cadastrado' : `${totalItensCatalogo} ativos no catálogo`) : '0 cadastrados',
      gasto: formatCurrency(cmvTotal),
      lucroAcumuladoPorcento: `${margemLucroPercentual.toFixed(1)}%`
    }
  }, [transactions, selectedPeriod, products])

  const dynamicLowStock = React.useMemo(() => {
    if (!products || products.length === 0) return []

    const list = products.filter((p) => {
      const atual = Number(p.quantidadeEstoque ?? p.atual ?? 0)
      const minimo = Number(p.quantidadeMinima ?? p.minimo ?? 0)
      return atual <= minimo
    })

    if (list.length === 0) return []

    return list.map((p) => {
      const atual = Number(p.quantidadeEstoque ?? p.atual ?? 0)
      const minimo = Number(p.quantidadeMinima ?? p.minimo ?? 0)
      const isCritical = atual <= 2 || atual === 0

      return {
        id: p.id,
        nome: p.nome,
        categoria: p.categoria || 'Geral',
        fotoUrl: p.fotoUrl || p.foto || p.imagem || '',
        atual: atual,
        minimo: minimo,
        status: isCritical ? 'Crítico' : 'Atenção',
        statusColor: isCritical
          ? 'bg-rose-600 text-white border-rose-600 font-semibold'
          : 'bg-amber-500 text-white border-amber-500 font-semibold',
        dotColor: 'bg-white'
      }
    })
  }, [products])

  return (
    <div className="bg-[#f1f5f9] text-[#0f172a] min-h-screen flex flex-col font-sans antialiased relative">

      {/* MODAL DE REQUISIÇÕES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] w-screen h-screen flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 m-0 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 text-slate-900">
                <h3 className="font-bold text-lg">Requisições de Acesso de Vendedores</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {vendedoresPendentes.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Nenhuma requisição pendente no momento.
                </div>
              ) : (
                vendedoresPendentes.map((vend) => (
                  <div key={vend.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 block text-sm">
                        {vend.nomeCompleto}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        CPF: {vend.cpf}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAprovarVendedor(vend.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                    >
                      Aceitar Acesso
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <header className="w-full bg-white border-b border-[#e2e8f0] pb-2">
        <div className="h-16 px-6 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[18px] font-bold text-[#0f172a] tracking-tight leading-tight ">CrtlVendas</span>
              <span className="text-[12px] text-slate-500 leading-tight font-medium">
                {(() => {
                  const name = activeUser?.nomeCompleto || activeUser?.name || 'Utilizador'
                  return isAdmin ? (
                    <span>
                      Olá, {name} (Seu ID é: <strong className="font-bold text-slate-700">{activeUser.id}</strong>)
                    </span>
                  ) : (
                    `Olá, ${name}`
                  )
                })()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              id="btn-logout"
              type="button"
              onClick={onLogout}
              title="Encerrar Sessão"
              aria-label="Sair"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-white hover:bg-rose-600 transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-6 px-6 sm:px-8 max-w-7xl mx-auto flex-grow pb-16 bg-zinc-50">
        <div className="flex flex-col w-full space-y-6 sm:space-y-8">

          {/* SELETOR DE PERÍODO */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
            <div className="grid grid-cols-4 bg-white p-1.5 rounded-2xl border border-[#e2e8f0] w-full sm:w-[420px]">
              {periodOptions.map((tab) => {
                const isActive = selectedPeriod === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedPeriod(tab.id)}
                    className={`py-2 text-center text-[13px] font-semibold rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="relative flex items-center hover:border-blue-500 justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 rounded-2xl text-[13px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
                  >
                    <span>Requisições</span>
                    {vendedoresPendentes.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-bold">
                        {vendedoresPendentes.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    id="btn-modo-grafico"
                    onClick={() => onNavigate && onNavigate('graficos')}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 rounded-2xl text-[13px] font-semibold transition-all duration-200 hover:border-blue-600 active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <span>Análise Gráfica</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-2'} gap-4 sm:gap-6 w-full`}>
            <div className="flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#e2e8f0] min-h-[120px]">
              <span className="text-[13px] font-medium text-slate-500 block mb-2">Ganho (Total vendido)</span>
              <span className="text-2xl font-bold text-emerald-600 tracking-tight block transition-all duration-300">
                {calculatedMetrics.ganhoTotal}
              </span>
            </div>

            {isAdmin && (
              <div className="flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#e2e8f0] min-h-[120px]">
                <span className="text-[13px] font-medium text-slate-500 block mb-2">Lucro líquido</span>
                <span className="text-2xl font-bold text-blue-600 tracking-tight block transition-all duration-300">
                  {calculatedMetrics.lucroLiquidoValor}
                </span>
              </div>
            )}

            <div className="flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#e2e8f0] min-h-[120px]">
              <span className="text-[13px] font-medium text-slate-500 block mb-2">Total gasto</span>
              <span className="text-2xl font-bold text-rose-600 tracking-tight block transition-all duration-300">
                {calculatedMetrics.gasto}
              </span>
            </div>

            {isAdmin && (
              <div className="flex flex-col justify-between p-5 bg-white rounded-2xl border border-[#e2e8f0] min-h-[120px]">
                <span className="text-[13px] font-medium text-slate-500 block mb-2">Porcentagem de lucro</span>
                <span className="text-2xl font-bold text-blue-600 tracking-tight block transition-all duration-300">
                  {calculatedMetrics.lucroAcumuladoPorcento}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#e2e8f0] flex flex-col justify-between min-h-[260px]">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[21px] font-bold text-[#0f172a] tracking-tight">Gestão de estoque</h2>
                  <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold border flex items-center gap-1.5 ${dynamicLowStock.some(p => p.status === 'Crítico')
                    ? 'bg-rose-600 text-white border-rose-600'
                    : dynamicLowStock.length > 0
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-emerald-600 text-white border-emerald-600'
                    }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                    {dynamicLowStock.length} {dynamicLowStock.length === 1 ? 'alerta' : 'alertas'}
                  </span>
                </div>
                <p className="text-[14px] text-slate-500">
                  Controle total de inventário, alertas de reposição e movimentações de mercadorias.
                </p>
                <div className="flex items-center gap-2 pt-3 border-t border-[#f1f5f9]">
                  <span className="text-[14px] font-semibold text-slate-700">
                    {products.length === 1 ? '1 item cadastrado' : `${products.length} itens ativos no catálogo`}
                  </span>
                </div>
              </div>
              <div className="mt-6 pt-1">
                <button
                  type="button"
                  id="btn-goto-estoque"
                  onClick={() => onNavigate && onNavigate('estoque')}
                  className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Visualizar estoque</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#e2e8f0] flex flex-col justify-between min-h-[260px]">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[21px] font-bold text-[#0f172a] tracking-tight">Histórico de vendas</h2>
                  <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-[12px] font-semibold border border-blue-200 capitalize">
                    {selectedPeriod === 'mes' ? 'Mês' : selectedPeriod}
                  </span>
                </div>
                <p className="text-[14px] text-slate-500">
                  Transações recentes, comprovantes detalhados e acompanhamento do fluxo de caixa.
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-[#f1f5f9]">
                  <span className="text-[14px] text-slate-500 font-medium">{calculatedMetrics.ganhoVariacao}</span>
                  <span className="text-[16px] font-bold text-emerald-600">{calculatedMetrics.ganhoTotal}</span>
                </div>
              </div>
              <div className="mt-6 pt-1">
                <button
                  type="button"
                  id="btn-goto-historico"
                  onClick={() => onNavigate && onNavigate('historico')}
                  className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Visualizar vendas</span>
                </button>
              </div>
            </div>

          </div>

          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#e2e8f0]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
              <div>
                <h2 className="text-[21px] font-bold text-[#0f172a] tracking-tight">Produtos com baixo estoque</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Itens que atingiram o limite mínimo de segurança e necessitam de reposição imediata.
                </p>
              </div>
              <span className={`self-start sm:self-center px-3 py-1.5 rounded-full text-[12px] font-semibold border flex items-center gap-1.5 ${dynamicLowStock.some(p => p.status === 'Crítico')
                ? 'bg-rose-600 text-white border-rose-600'
                : dynamicLowStock.length > 0
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-emerald-600 text-white border-emerald-600'
                }`}>
                <span className="w-2 h-2 rounded-full bg-white"></span>
                {dynamicLowStock.some(p => p.status === 'Crítico')
                  ? `${dynamicLowStock.filter(p => p.status === 'Crítico').length} ${dynamicLowStock.filter(p => p.status === 'Crítico').length === 1 ? 'item crítico' : 'itens críticos'}`
                  : `${dynamicLowStock.length} ${dynamicLowStock.length === 1 ? 'item em atenção' : 'itens em atenção'}`
                }
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="text-[12px] font-semibold text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                    <th className="pb-3 pr-4 font-semibold">Produto</th>
                    <th className="pb-3 px-4 font-semibold hidden md:table-cell">Categoria</th>
                    <th className="pb-3 px-4 font-semibold text-center">Nível de Estoque</th>
                    <th className="pb-3 pl-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dynamicLowStock.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Nenhum produto em nível crítico ou de atenção no momento.
                      </td>
                    </tr>
                  ) : (
                    dynamicLowStock.map((prod) => {
                      const percent = Math.min(100, Math.round((prod.atual / Math.max(1, prod.minimo)) * 100))
                      return (
                        <tr key={prod.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="py-3.5 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                                {prod.fotoUrl ? (
                                  <img src={prod.fotoUrl} alt={prod.nome} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900 block leading-tight">{prod.nome}</span>
                                <span className="text-[12px] text-slate-400 font-normal font-mono">ID: #{prod.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 hidden md:table-cell text-[13px]">
                            {prod.categoria}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col items-center max-w-[130px] mx-auto">
                              <div className="flex justify-between w-full text-[12px] font-medium mb-1">
                                <span className="font-bold text-slate-800">{prod.atual} un.</span>
                                <span className="text-slate-400">mín. {prod.minimo}</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${prod.status === 'Crítico' ? 'bg-rose-600' : 'bg-amber-500'
                                    }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 pl-4 text-right">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${prod.statusColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${prod.dotColor}`}></span>
                              {prod.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}