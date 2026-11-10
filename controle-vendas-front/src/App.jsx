import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import TelaEstoque from './components/TelaEstoque'
import TelaHistorico from './components/TelaHistorico'
import TelaGraficos from './components/TelaGraficos'
import LeftPanel from './components/LeftPanel'
import BrandHeader from './components/BrandHeader'
import InitialActions from './components/InitialActions'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'


const API_BASE = 'https://ctrlvendas-back.onrender.com/api'

function mapProdutoFromApi(p) {
  const uId = p.usuarioId != null ? Number(p.usuarioId) : (p.userId != null ? Number(p.userId) : (p.usuario?.id != null ? Number(p.usuario.id) : null))
  return {
    id: p.id,
    usuarioId: uId,
    userId: uId,
    nome: p.nome,
    sku: p.sku || '',
    categoria: p.categoria || 'Geral',
    preco: typeof p.preco === 'number' ? p.preco : parseFloat(p.preco) || 0,
    precoCusto: typeof p.precoCusto === 'number' ? p.precoCusto : parseFloat(p.precoCusto || p.custo || 0),
    atual: p.quantidadeEstoque ?? 0,
    minimo: p.quantidadeMinima ?? 0,
    fotoUrl: p.fotoUrl || '',
    icon: p.icon || 'inventory_2'
  }
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('ctrl_vendas_logged_user')
      return savedUser ? JSON.parse(savedUser) : null
    } catch {
      return null
    }
  })

  const [currentScreen, setCurrentScreen] = useState(() => (user?.id ? 'dashboard' : 'login'))
  const [authView, setAuthView] = useState('initial')
  const [textFading, setTextFading] = useState(false)

  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [additionalRevenue, setAdditionalRevenue] = useState(0)
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [lastSaleTimestamp, setLastSaleTimestamp] = useState(0)

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem('ctrl_vendas_logged_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('ctrl_vendas_logged_user')
    }
  }, [user])

  const fetchWithAuth = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(user?.id ? { 'X-User-Id': String(user.id) } : {}),
      ...(options.headers || {})
    }

    return fetch(url, {
      ...options,
      headers
    })
  }

  useEffect(() => {
    if (!user?.id) return
    fetchProducts()
    fetchTransactions()
  }, [user?.id])

  const fetchProducts = async () => {
    if (!user?.id) return
    setLoadingProducts(true)
    try {
      const res = await fetchWithAuth(`${API_BASE}/produtos/usuario/${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data.map(mapProdutoFromApi))
      }
    } catch (err) {
      console.warn('API de produtos offline:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchTransactions = async () => {
    if (!user?.id) return
    try {
      const isAdmin = user.tipo === 'ADMIN' || user.tipo === 'admin' || user.isAdmin === true || user.isAdmin === 1
      const url = isAdmin
        ? `${API_BASE}/vendas?tipo=ADMIN`
        : `${API_BASE}/vendas/usuario/${user.id}`

      const res = await fetchWithAuth(url)
      if (res.ok) {
        const data = await res.json()
        const mappedTransactions = data.map(tx => {
          const uId = tx.usuarioId != null ? Number(tx.usuarioId) : (tx.userId != null ? Number(tx.userId) : (tx.usuario?.id != null ? Number(tx.usuario.id) : null))
          return {
            ...tx,
            usuarioId: uId,
            userId: uId,
            nomeVendedor: tx.nomeVendedor || 'Vendedor',
            total: Number(tx.total || tx.valorTotal || 0),
            items: (tx.items || tx.itens || []).map(it => ({
              ...it,
              precoUnit: Number(it.precoUnit || it.preco || 0),
              quantidade: Number(it.quantidade || it.quantity || 0),
              total: Number(it.total || it.subtotal || 0),
              fotoUrl: it.fotoUrl || it.foto || it.imagem || ''
            }))
          }
        })
        setTransactions(mappedTransactions)
      }
    } catch (err) {
      console.warn('API de vendas offline:', err)
    }
  }

  const handleNavigate = (screen) => {
    const isAdmin =
      user?.tipo === 'ADMIN' ||
      user?.tipo === 'admin' ||
      user?.isAdmin === true ||
      user?.isAdmin === 1

    const adminScreens = ['graficos']

    if (adminScreens.includes(screen) && !isAdmin) {
      alert('Acesso negado: Apenas administradores podem aceder aos gráficos.')
      return
    }

    setCurrentScreen(screen)
  }

  const handleSwitchAuthView = (newView) => {
    setTextFading(true)
    setTimeout(() => {
      setAuthView(newView)
      setTextFading(false)
    }, 150)
  }

  const handleLoginSuccess = (loggedUser) => {
    if (loggedUser) {
      setUser(loggedUser)
      localStorage.setItem('ctrl_vendas_logged_user', JSON.stringify(loggedUser))
    }
    setCurrentScreen('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('ctrl_vendas_logged_user')
    setCurrentScreen('login')
    setAuthView('initial')
    setUser(null)
    setProducts([])
    setTransactions([])
    setAdditionalRevenue(0)
    setNewOrdersCount(0)
  }

  const handleAddProduct = async (productData) => {
    if (!user?.id) return null
    const payload = {
      ...productData,
      usuarioId: user.id,
      fotoUrl: productData.fotoUrl || '',
      preco: productData.preco,
      precoCusto: productData.precoCusto ?? 0,
      quantidadeEstoque: productData.quantidadeEstoque ?? 0,
      quantidadeMinima: productData.quantidadeMinima ?? 0
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/produtos`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const created = await res.json()
        setProducts((prev) => [...prev, mapProdutoFromApi(created)])
        return created
      }
    } catch (err) {
      console.warn('Erro ao criar produto:', err)
    }
    return null
  }

  const handleEditProduct = async (productId, productData) => {
    const payload = {
      nome: productData.nome,
      categoria: productData.categoria,
      sku: productData.sku,
      icon: productData.icon,
      fotoUrl: productData.fotoUrl || '',
      preco: productData.preco,
      precoCusto: productData.precoCusto,
      quantidadeEstoque: productData.quantidadeEstoque,
      quantidadeMinima: productData.quantidadeMinima
    }
    try {
      const res = await fetchWithAuth(`${API_BASE}/produtos/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const updated = await res.json()
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? mapProdutoFromApi(updated) : p))
        )
        return true
      }
    } catch (err) {
      console.warn('Erro ao editar produto:', err)
    }
    return false
  }

  const handleDeleteProduct = async (productId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/produtos/${productId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId))
        return true
      }
    } catch (err) {
      console.warn('Erro ao excluir produto:', err)
    }
    return false
  }

  const handleConfirmSale = async (saleItems, totalValue) => {
    setProducts((prev) =>
      prev.map((prod) => {
        const itemSold = saleItems.find((it) => it.productId === prod.id || it.id === prod.id)
        if (itemSold) {
          const qty = Number(itemSold.quantity || itemSold.quantidade || 1)
          return { ...prod, atual: Math.max(0, prod.atual - qty) }
        }
        return prod
      })
    )

    setAdditionalRevenue((prev) => prev + totalValue)
    setNewOrdersCount((prev) => prev + 1)

    if (user?.id) {
      try {
        await fetchProducts()
        await fetchTransactions()
      } catch (err) {
        console.warn('Erro ao sincronizar dados:', err)
      }
    }

    setLastSaleTimestamp(Date.now())
    return true
  }

  if (currentScreen === 'dashboard') {
    return (
      <Dashboard
        onNavigate={handleNavigate}
        products={products}
        user={user}
        onLogout={handleLogout}
        additionalRevenue={additionalRevenue}
        newOrdersCount={newOrdersCount}
        transactions={transactions}
        lastSaleTimestamp={lastSaleTimestamp}
      />
    )
  }

  if (currentScreen === 'estoque') {
    return (
      <TelaEstoque
        products={products}
        onNavigate={handleNavigate}
        onConfirmSale={handleConfirmSale}
        onAddProduct={handleAddProduct}
        onEditProduct={handleEditProduct}
        onDeleteProduct={handleDeleteProduct}
        user={user}
        loadingProducts={loadingProducts}
      />
    )
  }

  if (currentScreen === 'historico') {
    return (
      <TelaHistorico
        transactions={transactions}
        onNavigate={handleNavigate}
        user={user}
        products={products}
      />
    )
  }

  if (currentScreen === 'graficos') {
    return (
      <TelaGraficos
        onNavigate={handleNavigate}
        user={user}
        transactions={transactions}
        products={products}
      />
    )
  }

  const isInitial = authView === 'initial'

  return (
    <main className="w-full min-h-screen bg-blue-700 lg:bg-white overflow-x-hidden">
      <div className="flex flex-col lg:flex-row w-full min-h-screen relative">

        <div
          className={`w-full ${isInitial ? 'lg:w-[60%]' : 'lg:w-[40%]'} bg-blue-700 flex flex-col justify-center items-center px-8 text-center select-none z-10 shrink-0 transition-all duration-700 ease-in-out ${isInitial ? 'pt-28 pb-48 lg:py-24 min-h-[60vh] lg:min-h-screen' : 'pt-8 pb-12 lg:py-24 min-h-[25vh] lg:min-h-screen'}`}
        >
          <div className="max-w-md mx-auto flex flex-col items-center justify-center">
            <h1 className={`font-display lg:text-4xl text-3xl font-bold text-white tracking-tight leading-tight transition-opacity duration-300 ${textFading ? 'opacity-0' : 'opacity-100'}`}>
              {authView === 'login' ? 'Seja bem vindo de volta!' : authView === 'register' ? 'Bem vindo!' : 'Seja bem vindo!'}
            </h1>
            <p className={`font-sans lg:text-base text-blue-100 mt-3 font-normal max-w-sm transition-opacity duration-300 ${textFading ? 'opacity-0' : 'opacity-100'}`}>
              {authView === 'login' ? 'Acesse seus canais de vendas, metas e pipeline comercial' : authView === 'register' ? 'Configure sua organização comercial em menos de 2 minutos' : 'Plataforma de alta performance para inteligência e controle de vendas'}
            </p>
          </div>
        </div>

        <div
          className={`flex-1 w-full bg-white rounded-t-[40px] lg:rounded-none shadow-2xl lg:shadow-none flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-10 relative z-20 transition-all duration-700 ease-in-out ${isInitial
            ? 'min-h-[45vh] -mt-20 lg:mt-0'
            : 'min-h-[80vh] lg:min-h-screen -mt-6 lg:mt-0'
            }`}
        >
          <div className="max-w-md w-full mx-auto flex flex-col justify-center my-auto items-stretch text-left">
            <BrandHeader textFading={textFading} />

            {authView === 'initial' && (
              <InitialActions
                onSelectLogin={() => handleSwitchAuthView('login')}
                onSelectRegister={() => handleSwitchAuthView('register')}
                onSwitchToLogin={() => handleSwitchAuthView('login')}
                onSwitchToRegister={() => handleSwitchAuthView('register')}
                textFading={textFading}
              />
            )}

            {authView === 'login' && (
              <LoginForm
                onBack={() => handleSwitchAuthView('initial')}
                onSwitchToRegister={() => handleSwitchAuthView('register')}
                onLoginSuccess={handleLoginSuccess}
                textFading={textFading}
              />
            )}

            {authView === 'register' && (
              <RegisterForm
                onBack={() => handleSwitchAuthView('initial')}
                onSwitchToLogin={() => handleSwitchAuthView('login')}
                onRegisterSuccess={(registeredData) => {
                  if (registeredData) {
                    setUser(registeredData)
                  }
                  handleSwitchAuthView('login')
                }}
                textFading={textFading}
              />
            )}
          </div>
        </div>

      </div>
    </main>
  )
}