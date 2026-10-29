import React, { useState, useEffect, useRef, useMemo } from 'react'

// Converte string de data da transação ("dd/MM/yyyy às HH:mm" ou ISO) em objeto Date
function parseTxDate(tx) {
  if (!tx) return null
  const raw = tx.dataHora || tx.createdAt || tx.data
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw

  if (typeof raw === 'string') {
    if (raw.includes('/')) {
      const parts = raw.split(' às ')
      const datePart = parts[0].trim()
      const timePart = parts[1] ? parts[1].trim() : '00:00'
      const [day, month, year] = datePart.split('/').map(Number)
      const [hours, minutes] = timePart.split(':').map(Number)
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month - 1, day, hours || 0, minutes || 0)
      }
    }
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

// Calcula lucro líquido real da transação
function getTxProfit(tx, products = []) {
  if (tx.lucro !== undefined && tx.lucro !== null && !isNaN(Number(tx.lucro))) {
    return Number(tx.lucro)
  }
  if (!tx.items || tx.items.length === 0) {
    return Number(tx.total || 0)
  }
  return tx.items.reduce((sum, item) => {
    const qtd = Number(item.quantidade || item.quantity || 0)
    const precoUnit = Number(item.precoUnit || item.preco || 0)
    const totalItem = Number(item.total || precoUnit * qtd || 0)

    let custoUnit = 0
    if (item.precoCusto !== undefined && item.precoCusto !== null && Number(item.precoCusto) > 0) {
      custoUnit = Number(item.precoCusto)
    } else {
      const prod = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          (p.nome && item.nome && p.nome.toLowerCase() === item.nome.toLowerCase())
      )
      if (prod) {
        custoUnit = Number(prod.precoCusto ?? prod.custo ?? 0)
      }
    }
    const custoTotal = custoUnit * qtd
    return sum + (totalItem - custoTotal)
  }, 0)
}

export default function TelaGraficos({
  onNavigate,
  user,
  transactions = [],
  products = []
}) {
  const [currentPeriod, setCurrentPeriod] = useState('Semana')
  const canvasRef = useRef(null)
  const chartRef = useRef(null)
  const [isChartLoaded, setIsChartLoaded] = useState(false)

  const userName = user?.nomeCompleto || user?.nome || user?.name || 'Administrador'
  const userRole = user?.tipo === 'ADMIN' ? 'Administrador' : (user?.tipo || 'Administrador')
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') || 'AD'

  const formatCurrency = (val) =>
    (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const chartConfig = useMemo(() => {
    const now = new Date()

    if (currentPeriod === 'Hoje') {
      const labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']
      const fullLabels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']
      const values = [0, 0, 0, 0, 0, 0, 0, 0]

      if (transactions && transactions.length > 0) {
        transactions.forEach((tx) => {
          const d = parseTxDate(tx)
          if (
            d &&
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          ) {
            const h = d.getHours()
            let idx = 0
            if (h < 9) idx = 0
            else if (h < 11) idx = 1
            else if (h < 13) idx = 2
            else if (h < 15) idx = 3
            else if (h < 17) idx = 4
            else if (h < 19) idx = 5
            else if (h < 21) idx = 6
            else idx = 7

            values[idx] += getTxProfit(tx, products)
          }
        })
      }

      const totalProfit = values.reduce((acc, v) => acc + v, 0)
      return {
        subtitle:
          totalProfit > 0
            ? 'Lucro líquido apurado no dia de hoje'
            : 'Nenhuma venda registada hoje',
        labels,
        fullLabels,
        values,
        metaText: `Lucro líquido do dia: ${formatCurrency(totalProfit)}`,
        totalProfit
      }
    }

    if (currentPeriod === 'Semana') {
      const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      const fullLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
      const values = [0, 0, 0, 0, 0, 0, 0]

      if (transactions && transactions.length > 0) {
        const curDay = (now.getDay() + 6) % 7
        const monday = new Date(now)
        monday.setDate(now.getDate() - curDay)
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        sunday.setHours(23, 59, 59, 999)

        transactions.forEach((tx) => {
          const d = parseTxDate(tx)
          if (d && d >= monday && d <= sunday) {
            const dayIdx = (d.getDay() + 6) % 7
            values[dayIdx] += getTxProfit(tx, products)
          }
        })
      }

      const totalProfit = values.reduce((acc, v) => acc + v, 0)
      return {
        subtitle:
          totalProfit > 0
            ? 'Rentabilidade líquida diária da semana corrente'
            : 'Nenhuma venda registada nesta semana',
        labels,
        fullLabels,
        values,
        metaText: `Total de lucro na semana: ${formatCurrency(totalProfit)}`,
        totalProfit
      }
    }

    if (currentPeriod === 'Mês') {
      const labels = ['01', '05', '10', '15', '20', '25', '30']
      const fullLabels = ['Dia 01', 'Dia 05', 'Dia 10', 'Dia 15', 'Dia 20', 'Dia 25', 'Dia 30']
      const values = [0, 0, 0, 0, 0, 0, 0]

      if (transactions && transactions.length > 0) {
        transactions.forEach((tx) => {
          const d = parseTxDate(tx)
          if (d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            const day = d.getDate()
            let idx = 0
            if (day <= 4) idx = 0
            else if (day <= 9) idx = 1
            else if (day <= 14) idx = 2
            else if (day <= 19) idx = 3
            else if (day <= 24) idx = 4
            else if (day <= 29) idx = 5
            else idx = 6

            values[idx] += getTxProfit(tx, products)
          }
        })
      }

      const totalProfit = values.reduce((acc, v) => acc + v, 0)
      return {
        subtitle:
          totalProfit > 0
            ? 'Lucro consolidado diário no mês corrente'
            : 'Nenhuma venda registada neste mês',
        labels,
        fullLabels,
        values,
        metaText: `Lucro total no mês: ${formatCurrency(totalProfit)}`,
        totalProfit
      }
    }

    // Período: 'Tudo'
    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const fullLabels = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro'
    ]
    const values = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    if (transactions && transactions.length > 0) {
      transactions.forEach((tx) => {
        const d = parseTxDate(tx)
        if (d) {
          const m = d.getMonth()
          if (m >= 0 && m <= 11) {
            values[m] += getTxProfit(tx, products)
          }
        }
      })
    }

    const totalProfit = values.reduce((acc, v) => acc + v, 0)
    return {
      subtitle:
        totalProfit > 0
          ? 'Histórico consolidado anual e evolução de rentabilidade'
          : 'Sem histórico de vendas registado',
      labels,
      fullLabels,
      values,
      metaText: `Lucro acumulado total: ${formatCurrency(totalProfit)}`,
      totalProfit
    }
  }, [transactions, products, currentPeriod])

  // Ranking real de Top Produtos (1º ao 5º lugar)
  const topProducts = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return []
    }

    const now = new Date()

    const txsInPeriod = transactions.filter((tx) => {
      if (currentPeriod === 'Tudo') return true
      const d = parseTxDate(tx)
      if (!d) return false

      if (currentPeriod === 'Hoje') {
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        )
      }
      if (currentPeriod === 'Semana') {
        const curDay = (now.getDay() + 6) % 7
        const monday = new Date(now)
        monday.setDate(now.getDate() - curDay)
        monday.setHours(0, 0, 0, 0)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        sunday.setHours(23, 59, 59, 999)
        return d >= monday && d <= sunday
      }
      if (currentPeriod === 'Mês') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      return true
    })

    if (txsInPeriod.length === 0) {
      return []
    }

    const productStats = {}
    txsInPeriod.forEach((tx) => {
      (tx.items || []).forEach((item) => {
        const key = item.productId || item.nome || item.name || 'Produto'
        if (!productStats[key]) {
          productStats[key] = {
            name: item.nome || item.name || 'Produto',
            quantity: 0,
            revenue: 0,
            profit: 0
          }
        }

        const qtd = Number(item.quantidade || item.quantity || 0)
        const preco = Number(item.precoUnit || item.preco || 0)
        const receita = Number(item.total || preco * qtd || 0)

        let custoUnit = 0
        if (item.precoCusto !== undefined && item.precoCusto !== null && Number(item.precoCusto) > 0) {
          custoUnit = Number(item.precoCusto)
        } else {
          const prod = products.find(
            (p) =>
              (item.productId && p.id === item.productId) ||
              (p.nome && item.nome && p.nome.toLowerCase() === item.nome.toLowerCase())
          )
          if (prod) {
            custoUnit = Number(prod.precoCusto ?? prod.custo ?? 0)
          }
        }
        const lucro = receita - custoUnit * qtd

        productStats[key].quantity += qtd
        productStats[key].revenue += receita
        productStats[key].profit += lucro
      })
    })

    const sorted = Object.values(productStats).sort((a, b) => b.revenue - a.revenue)
    if (sorted.length === 0) return []

    const maxRevenue = sorted[0].revenue || 1
    return sorted.slice(0, 5).map((prod, index) => {
      const pct = Math.min(100, Math.round((prod.revenue / maxRevenue) * 100))
      return {
        rank: `${index + 1}º`,
        name: prod.name,
        sales: `${prod.quantity} ${prod.quantity === 1 ? 'unidade vendida' : 'unidades vendidas'}`,
        revenue: formatCurrency(prod.revenue),
        profit: formatCurrency(prod.profit),
        percentage: pct,
        isFirst: index === 0
      }
    })
  }, [transactions, products, currentPeriod])

  // Injeção do Chart.js
  useEffect(() => {
    if (window.Chart) {
      setIsChartLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js'
    script.async = true
    script.onload = () => setIsChartLoaded(true)
    document.body.appendChild(script)
  }, [])

  // Renderização da curva com Chart.js sem distorções visuais
  useEffect(() => {
    if (!canvasRef.current || !isChartLoaded) return
    const Chart = window.Chart
    if (!Chart) return

    if (chartRef.current) {
      chartRef.current.destroy()
      chartRef.current = null
    }

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    const gradient = ctx.createLinearGradient(0, 0, 0, 280)
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.22)')
    gradient.addColorStop(0.6, 'rgba(37, 99, 235, 0.04)')
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)')

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartConfig.labels,
        datasets: [
          {
            label: 'Lucro Líquido',
            data: chartConfig.values,
            borderColor: '#2563eb',
            borderWidth: 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: (context) => {
              const idx = context.dataIndex
              const total = context.dataset.data.length
              return idx === total - 1 ? '#059669' : '#2563eb'
            },
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2.5,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: '#2563eb',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        animation: {
          duration: 500,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            titleColor: '#94a3b8',
            bodyColor: '#ffffff',
            titleFont: { size: 11, weight: '500', family: 'Inter, sans-serif' },
            bodyFont: { size: 13, weight: '700', family: 'Inter, sans-serif' },
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 12,
            displayColors: false,
            borderColor: 'rgba(51, 65, 85, 0.5)',
            borderWidth: 1,
            callbacks: {
              title: () => '',
              label: (context) => {
                const fullLabel = chartConfig.fullLabels[context.dataIndex] || context.label
                const val = context.parsed.y || 0
                const formatted = val.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                })
                return `${fullLabel}: ${formatted} de lucro`
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 12, weight: '600', family: 'Inter, sans-serif' },
              padding: 10
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9', drawBorder: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11, weight: '500', family: 'Inter, sans-serif' },
              padding: 10,
              callback: (value) => {
                if (value === 0) return 'R$ 0,00'
                if (value >= 1000) {
                  return `R$ ${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
                }
                return `R$ ${value}`
              }
            }
          }
        }
      }
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [chartConfig, isChartLoaded])

  return (
    <div className="bg-[#f8f9ff] text-slate-900 antialiased min-h-screen flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Bar Desktop & Responsiva */}
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

      {/* Conteúdo Principal Responsivo */}
      <main className="bg-zinc-50 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Cabeçalho da Página com Seletor de Período Integrado */}
        <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Análise gráfica e desempenho
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Visão avançada sobre as suas vendas
            </p>
          </div>

          {/* Seletor Dinâmico por Período */}
          <div className="p-1.5 bg-white rounded-2xl flex items-center gap-1 text-xs self-start md:self-auto border border-slate-2">
            {['Hoje', 'Semana', 'Mês', 'Tudo'].map((period) => {
              const isActive = currentPeriod === period
              return (
                <button
                  key={period}
                  id={`btn-periodo-${period.toLowerCase()}`}
                  type="button"
                  onClick={() => setCurrentPeriod(period)}
                  className={`px-4 py-2 rounded-xl text-center transition-all cursor-pointer ${isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                >
                  {period}
                </button>
              )
            })}
          </div>
        </section>

        {/* Grid Principal Responsivo: 2 Colunas no Desktop (Gráfico de Lucro Líquido + Top Produtos) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card 1: Gráfico de Lucro Líquido */}
          <section className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col justify-between h-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                    Curva de Lucro Líquido
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{chartConfig.subtitle}</p>
              </div>

              {/* CORREÇÃO: Azul sólido e chapado */}
              <div className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold border border-blue-600">
                {currentPeriod}
              </div>
            </div>

            {/* Container do Gráfico Canvas Chart.js com total responsividade */}
            <div className="relative w-full h-64 sm:h-72 my-4">
              <canvas ref={canvasRef} id="canvas-lucro-liquido" className="w-full h-full" />
              {!isChartLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                    <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></span>
                    <span>Carregando gráfico...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Informativo do Gráfico */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium"></span>
                <span className="flex items-center gap-1.5 font-medium"></span>
              </div>
              <span className="font-semibold text-slate-600">{chartConfig.metaText}</span>
            </div>
          </section>

          {/* Card 2: Painel de Top Produtos */}
          <section className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/80 shadow-sm flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                    Top Produtos
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Ranking de 1º a 5º lugar baseado em vendas reais
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-3">
                {topProducts.length === 0 ? (
                  <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                      <span className="material-symbols-outlined text-[24px]">production_quantity_limits</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Nenhuma venda registada</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      {currentPeriod === 'Tudo'
                        ? 'Realize vendas no sistema para preencher o ranking comercial.'
                        : `Nenhuma venda encontrada para o período "${currentPeriod}". Realize vendas para preencher o ranking.`}
                    </p>
                  </div>
                ) : (
                  topProducts.map((prod) => (
                    <div
                      key={prod.rank}
                      className="p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3 text-sm mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* CORREÇÃO: Azul sólido e chapado para o primeiro lugar */}
                          <span
                            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${prod.isFirst
                              ? 'bg-blue-600 text-white border border-blue-600 shadow-xs'
                              : 'bg-slate-100 border border-slate-200 text-slate-700'
                              }`}
                          >
                            {prod.rank}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 truncate block text-sm">
                              {prod.name}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {prod.sales}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-slate-900 font-mono tracking-tight block text-sm">
                            {prod.revenue}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {prod.volume}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${prod.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Atualizado em tempo real</span>
              <span className="font-medium text-slate-500">
                {topProducts.length === 0
                  ? '0 produtos listados'
                  : `${topProducts.length} ${topProducts.length === 1 ? 'produto listado' : 'produtos listados'}`}
              </span>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export { TelaGraficos }