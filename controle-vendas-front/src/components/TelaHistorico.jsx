import React, { useState, useMemo, useRef, useEffect } from 'react'
import axios from 'axios'

export default function TelaHistorico({
  transactions,
  onNavigate,
  user,
  products = []
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDateFilter, setSelectedDateFilter] = useState('todas')
  const [exportFeedback, setExportFeedback] = useState(false)
  const dateInputRef = useRef(null)

  const formatCurrency = (val) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

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

  const isAdmin =
    user?.tipo === 'ADMIN' ||
    user?.tipo === 'admin' ||
    user?.isAdmin === true ||
    user?.isAdmin === 1

  const currentUserId = Number(user?.id || 0)
  const currentUserName = (user?.nomeCompleto || user?.nome || user?.name || '').trim().toLowerCase()

  const userTransactions = useMemo(() => {
    if (isAdmin) return transactions

    return transactions.filter((tx) => {
      const txUserId = Number(tx.usuarioId ?? tx.userId ?? tx.usuario?.id ?? 0)
      const txSellerName = (tx.nomeVendedor || '').trim().toLowerCase()

      if (txSellerName === 'admin' || txSellerName.includes('administrador')) {
        return false
      }

      if (currentUserId > 0 && txUserId > 0) {
        return txUserId === currentUserId
      }

      if (currentUserName && txSellerName) {
        return (
          txSellerName === currentUserName ||
          txSellerName.includes(currentUserName) ||
          currentUserName.includes(txSellerName)
        )
      }

      return false
    })
  }, [transactions, isAdmin, currentUserId, currentUserName])

  const filteredTransactions = useMemo(() => {
    const agora = new Date()
    const hojeISO = agora.toISOString().slice(0, 10)
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()

    const anoAtual = agora.getFullYear()
    const mesAtual = agora.getMonth()
    const inicioSemana = new Date(anoAtual, mesAtual, 25).getTime()
    const inicioMes = new Date(anoAtual, mesAtual, 1).getTime()

    return userTransactions.filter((tx) => {
      const matchSearch =
        tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.items || []).some((item) =>
          item.nome.toLowerCase().includes(searchTerm.toLowerCase())
        ) ||
        (tx.nomeVendedor && tx.nomeVendedor.toLowerCase().includes(searchTerm.toLowerCase()))

      if (!matchSearch) return false

      if (!selectedDateFilter || selectedDateFilter === 'todas') {
        return true
      }

      const txDateISO = parseDataHoraToISO(tx.dataHora)
      const txTimestamp = parseDataHoraToTimestamp(tx.dataHora)

      if (selectedDateFilter === 'hoje') {
        return txDateISO === hojeISO || txTimestamp >= inicioHoje
      }

      if (selectedDateFilter === 'semana') {
        return txTimestamp >= inicioSemana
      }

      if (selectedDateFilter === 'mes') {
        return txTimestamp >= inicioMes
      }

      return txDateISO === selectedDateFilter
    })
  }, [userTransactions, searchTerm, selectedDateFilter])

  const totalGeralVendas = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + Number(tx.total || 0), 0)
  }, [filteredTransactions])

  const totalItensListados = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => acc + (tx.items || []).reduce((sum, it) => sum + Number(it.quantidade || it.quantity || 0), 0),
      0
    )
  }, [filteredTransactions])

  const [destaqueInfo, setDestaqueInfo] = useState({ nome: 'Carregando...', total: 0 })

  useEffect(() => {
    const fetchDestaque = async () => {
      try {
        let url = '/api/destaque';
        if (selectedDateFilter && selectedDateFilter !== 'todas') {
          const dateParam = selectedDateFilter === 'hoje' ? new Date().toISOString().slice(0, 10) : selectedDateFilter;
          if (dateParam) url += `?date=${dateParam}`;
        }
        const resp = await axios.get(url);
        const data = resp.data || {};
        setDestaqueInfo({ nome: data.nome || 'Nenhum', total: data.total || 0 });
      } catch (err) {
        console.error('Erro ao buscar destaque:', err);
        setDestaqueInfo({ nome: 'Nenhum', total: 0 });
      }
    };
    fetchDestaque();
  }, [selectedDateFilter]);

  const handleExportCSV = () => {
    setExportFeedback(true)

    const rows = [
      ['Data e Hora', 'ID Pedido', 'Vendido Por', 'Status', 'Produto', 'Preço Unit.', 'Quantidade', 'Total']
    ]

    filteredTransactions.forEach((tx) => {
      const itensAgrupadosCSV = (tx.items || []).reduce((acc, item) => {
        const nome = item.nome
        const preco = Number(item.precoUnit || item.preco || 0)
        const qtd = Number(item.quantidade || item.quantity || 0)

        if (!acc[nome]) {
          acc[nome] = { nome, preco, quantidade: 0, total: 0 }
        }
        acc[nome].quantidade += qtd
        acc[nome].total += (qtd * preco)
        return acc
      }, {})

      Object.values(itensAgrupadosCSV).forEach((item) => {
        rows.push([
          tx.dataHora,
          tx.id,
          `"${tx.nomeVendedor || 'Administrador'}"`,
          tx.status,
          `"${item.nome}"`,
          item.preco.toFixed(2),
          item.quantidade,
          item.total.toFixed(2)
        ])
      })
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `historico-vendas-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      setExportFeedback(false)
    }, 2000)
  }

  const isCustomDateActive = selectedDateFilter && !['todas', 'hoje', 'semana', 'mes'].includes(selectedDateFilter)

  return (
    <div className="bg-[#f8f9ff] text-slate-900 antialiased min-h-screen flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* HEADER IDÊNTICO AO DA TELA DE GRÁFICOS */}
      <header className="pb-2 sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="h-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="btn-voltar-dashboard"
              aria-label="Voltar ao Dashboard"
              onClick={() => (onNavigate ? onNavigate('dashboard') : window.history.back())}
              type="button"
              className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-semibold cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              <span>Voltar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="bg-zinc-50 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Histórico de vendas
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Auditoria completa de pedidos efetuados, baixas de estoque e receitas geradas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="exportBtn"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 hover:border-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] text-white">
                {exportFeedback ? 'check_circle' : 'download'}
              </span>
              <span>{exportFeedback ? 'Exportando CSV...' : 'Exportar Relatório'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Transacionado
            </span>
            <span className="text-xl font-bold text-blue-700 mt-2 block">
              {formatCurrency(totalGeralVendas)}
            </span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Pedidos Registados
            </span>
            <span className="text-xl font-bold text-slate-800 mt-2 block">
              {filteredTransactions.length}
            </span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Unidades Vendidas
            </span>
            <span className="text-xl font-bold text-slate-800 mt-2 block">
              {totalItensListados}
            </span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Destaque Vendas
            </span>
            <span className="text-lg font-bold text-blue-700 mt-2 block truncate" title={destaqueInfo.nome}>
              {destaqueInfo.nome}
            </span>
            <span className="text-sm text-slate-700 font-semibold mt-1" title={`${destaqueInfo.total} ${destaqueInfo.total === 1 ? 'venda' : 'vendas'}`}>
              {destaqueInfo.total} {destaqueInfo.total === 1 ? 'venda' : 'vendas'}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, produto ou nome do vendedor..."
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDateFilter('todas')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDateFilter === 'todas'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
            >
              Todas ({transactions.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedDateFilter('hoje')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDateFilter === 'hoje'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => setSelectedDateFilter('semana')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDateFilter === 'semana'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
            >
              Semana
            </button>

            <button
              type="button"
              onClick={() => setSelectedDateFilter('mes')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDateFilter === 'mes'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
            >
              Mês
            </button>

            <div
              onClick={() => {
                if (dateInputRef.current) {
                  try {
                    dateInputRef.current.showPicker()
                  } catch {
                    dateInputRef.current.click()
                  }
                }
              }}
              className={`relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${isCustomDateActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${isCustomDateActive ? 'text-white' : 'text-slate-500'}`}>
                calendar_month
              </span>
              <span>
                {isCustomDateActive
                  ? new Date(selectedDateFilter + 'T00:00:00').toLocaleDateString('pt-BR')
                  : 'Outra data'}
              </span>

              <input
                ref={dateInputRef}
                type="date"
                value={isCustomDateActive ? selectedDateFilter : ''}
                onChange={(e) => setSelectedDateFilter(e.target.value || 'todas')}
                className="absolute opacity-0 pointer-events-none w-0 h-0"
                title="Selecionar data específica"
              />

              {isCustomDateActive && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedDateFilter('todas')
                  }}
                  className="text-white/80 hover:text-white ml-1 cursor-pointer z-20 relative"
                  title="Limpar filtro de data"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">
                search_off
              </span>
              <h3 className="font-bold text-slate-700 text-base">
                Nenhuma transação encontrada
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Tente alterar os filtros de pesquisa ou data.
              </p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const itensAgrupados = (tx.items || []).reduce((acc, item) => {
                const nome = item.nome
                const preco = Number(item.precoUnit || item.preco || 0)
                const qtd = Number(item.quantidade || item.quantity || 0)
                const productId = item.productId || item.id

                if (!acc[nome]) {
                  acc[nome] = {
                    productId,
                    nome,
                    fotoUrl: item.fotoUrl || item.foto || item.imagem || '',
                    precoUnit: preco,
                    quantidade: 0,
                    total: 0
                  }
                }
                acc[nome].quantidade += qtd
                acc[nome].total += (qtd * preco)
                return acc
              }, {})

              const listaItensUnicos = Object.values(itensAgrupados)

              return (
                <div
                  key={tx.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden transition-all hover:shadow-md"
                >
                  <div className="bg-slate-50/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold border border-blue-200">
                        <span>Vendido por: {tx.nomeVendedor || 'Administrador'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/40 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="py-2.5 px-6">Data e Hora</th>
                          <th className="py-2.5 px-4">ID Pedido</th>
                          <th className="py-2.5 px-4">Nome do Produto</th>
                          <th className="py-2.5 px-4 text-right">Preço Unit.</th>
                          <th className="py-2.5 px-4 text-center">Quantidade</th>
                          <th className="py-2.5 px-6 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                        {listaItensUnicos.map((item, idx) => {
                          const matchingProd = products.find(p => p.id === item.productId || p.nome === item.nome)
                          const foto = item.fotoUrl || matchingProd?.fotoUrl || matchingProd?.foto || ''

                          return (
                            <tr
                              key={`${tx.id}-${idx}`}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="py-3 px-6 text-slate-500 text-xs">
                                {tx.dataHora}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-600">
                                {tx.id}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden shadow-sm">
                                    {foto ? (
                                      <img src={foto} alt={item.nome} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                                    )}
                                  </div>
                                  <span className="font-semibold text-slate-900">
                                    {item.nome}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right text-slate-600 font-semibold">
                                {formatCurrency(item.precoUnit)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                                  {item.quantidade} un
                                </span>
                              </td>
                              <td className="py-3 px-6 text-right font-bold text-slate-900">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-xs text-slate-500">
          <div>
            Mostrando <strong className="text-slate-800">{filteredTransactions.length}</strong> de{' '}
            <strong className="text-slate-800">{userTransactions.length}</strong> transações ({totalItensListados} itens contabilizados)
          </div>
        </div>
      </main>
    </div>
  )
}