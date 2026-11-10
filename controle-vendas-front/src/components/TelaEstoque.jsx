import React, { useState, useEffect, useMemo } from 'react'
import axios from 'axios'

export default function TelaEstoque({
    products,
    onNavigate,
    onConfirmSale,
    onAddProduct,
    onEditProduct,
    onDeleteProduct,
    user,
    loadingProducts
}) {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('Todas')
    const [selectedQuantities, setSelectedQuantities] = useState({})
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Estados para a notificação toast animada (entrada e saída)
    const [successToastData, setSuccessToastData] = useState(null)
    const [shouldRenderToast, setShouldRenderToast] = useState(false)
    const [isToastExiting, setIsToastExiting] = useState(false)

    // Estado para a data da venda no modal de visualização
    const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0])

    // Modal de Filtro e Ordenação
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [filterMinStock, setFilterMinStock] = useState('')
    const [filterMaxPrice, setFilterMaxPrice] = useState('')
    const [filterStatus, setFilterStatus] = useState('todos')
    const [sortBy, setSortBy] = useState('recente')

    // Modal Adicionar/Editar Produto
    const [isProductModalOpen, setIsProductModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState(null)
    const [productForm, setProductForm] = useState({
        nome: '', categoria: '', fotoUrl: '',
        preco: '', precoCusto: '', quantidadeEstoque: '', quantidadeMinima: ''
    })
    const [productFormError, setProductFormError] = useState('')
    const [savingProduct, setSavingProduct] = useState(false)

    // Estado para o Modal de Confirmação de Exclusão
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [productToDelete, setProductToDelete] = useState(null)

    const isAdmin =
        user?.tipo === 'ADMIN' ||
        user?.tipo === 'admin' ||
        user?.isAdmin === true ||
        user?.isAdmin === 1

    const currentUserId = Number(user?.id || 0)

    // Produtos isolados garantindo que produtos sem ID ou do próprio vendedor aparecem sempre
    const userProducts = useMemo(() => {
        return products;
    }, [products]);

    // Extrair categorias únicas a partir dos produtos do utilizador
    const categories = useMemo(() => {
        const set = new Set(userProducts.map((p) => p.categoria).filter(Boolean))
        return ['Todas', ...Array.from(set)]
    }, [userProducts])

    // Cálculos financeiros do estoque visível para o utilizador
    const estoqueFinanceiro = useMemo(() => {
        let custoTotal = 0
        let valorPotencialTotal = 0

        userProducts.forEach((p) => {
            const qtd = Number(p.atual ?? p.quantidadeEstoque ?? 0)
            const custoUnit = Number(p.precoCusto ?? p.custo ?? 0)
            const precoUnit = Number(p.preco ?? 0)

            custoTotal += custoUnit * qtd
            valorPotencialTotal += precoUnit * qtd
        })

        return {
            gasto: custoTotal,
            possivelGanho: valorPotencialTotal
        }
    }, [userProducts])

    // Filtragem e Ordenação dinâmica dos produtos
    const filteredProducts = useMemo(() => {
        const filtered = userProducts.filter((prod) => {
            const selectedQty = selectedQuantities[prod.id] || 0
            const estoqueDisponivelReal = prod.atual - selectedQty

            const matchSearch =
                prod.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(prod.id).includes(searchTerm)

            const matchCategory =
                selectedCategory === 'Todas' || prod.categoria === selectedCategory

            const matchMinStock = filterMinStock === '' || estoqueDisponivelReal >= parseInt(filterMinStock)
            const matchMaxPrice = filterMaxPrice === '' || prod.preco <= parseFloat(filterMaxPrice)

            let matchStatus = true
            if (filterStatus === 'disponivel') matchStatus = estoqueDisponivelReal > prod.minimo
            else if (filterStatus === 'baixo') matchStatus = estoqueDisponivelReal > 0 && estoqueDisponivelReal <= prod.minimo
            else if (filterStatus === 'esgotado') matchStatus = estoqueDisponivelReal <= 0

            return matchSearch && matchCategory && matchMinStock && matchMaxPrice && matchStatus
        })

        return filtered.sort((a, b) => {
            const nameA = a.nome || ''
            const nameB = b.nome || ''
            const priceA = Number(a.preco || 0)
            const priceB = Number(b.preco || 0)
            const qtyA = Number(a.atual || 0)
            const qtyB = Number(b.atual || 0)
            const idA = Number(a.id || 0)
            const idB = Number(b.id || 0)

            if (sortBy === 'az') return nameA.localeCompare(nameB)
            if (sortBy === 'za') return nameB.localeCompare(nameA)
            if (sortBy === 'preco-maior') return priceB - priceA
            if (sortBy === 'preco-menor') return priceA - priceB
            if (sortBy === 'qtd-maior') return qtyB - qtyA
            if (sortBy === 'id') return idA - idB
            return 0
        })
    }, [userProducts, searchTerm, selectedCategory, filterMinStock, filterMaxPrice, filterStatus, selectedQuantities, sortBy])

    const hasActiveFilters = filterMinStock !== '' || filterMaxPrice !== '' || filterStatus !== 'todos' || sortBy !== 'recente'

    const clearFilters = () => {
        setFilterMinStock('')
        setFilterMaxPrice('')
        setFilterStatus('todos')
        setSortBy('recente')
        setIsFilterOpen(false)
    }

    const handleDecrease = (productId) => {
        setSelectedQuantities((prev) => {
            const current = prev[productId] || 0
            if (current <= 1) {
                const next = { ...prev }
                delete next[productId]
                return next
            }
            return { ...prev, [productId]: current - 1 }
        })
    }

    const handleSelectOne = (productId, maxStock) => {
        setSelectedQuantities((prev) => {
            const current = prev[productId] || 0
            if (current >= maxStock) return prev
            return { ...prev, [productId]: current + 1 }
        })
    }

    const selectedItems = useMemo(() => {
        return Object.entries(selectedQuantities)
            .map(([idStr, qty]) => {
                const id = Number(idStr)
                const product = userProducts.find((p) => p.id === id)
                if (!product || qty <= 0) return null
                return {
                    product,
                    quantity: qty,
                    subtotal: qty * product.preco
                }
            })
            .filter(Boolean)
    }, [selectedQuantities, userProducts])

    const totalItemsCount = useMemo(() => {
        return selectedItems.reduce((acc, item) => acc + item.quantity, 0)
    }, [selectedItems])

    const totalGeneral = useMemo(() => {
        return selectedItems.reduce((acc, item) => acc + item.subtotal, 0)
    }, [selectedItems])

    const [shouldRenderBar, setShouldRenderBar] = useState(false)
    const [isBarExiting, setIsBarExiting] = useState(false)

    useEffect(() => {
        if (totalItemsCount > 0) {
            setShouldRenderBar(true)
            setIsBarExiting(false)
        } else if (shouldRenderBar && !isBarExiting) {
            setIsBarExiting(true)
            const timer = setTimeout(() => {
                setShouldRenderBar(false)
                setIsBarExiting(false)
            }, 300)
            return () => clearTimeout(timer)
        }
    }, [totalItemsCount, shouldRenderBar, isBarExiting])

    const formatCurrency = (val) => {
        return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const handleProductImageChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setProductForm((prev) => ({ ...prev, fotoUrl: reader.result }))
            }
            reader.readAsDataURL(file)
        }
    }

    const handleConfirmOrder = async () => {
        if (selectedItems.length === 0) return

        const activeUser = user || JSON.parse(localStorage.getItem('ctrl_vendas_logged_user') || '{}')
        const activeUserId = activeUser?.id
        const activeUserName = activeUser?.nomeCompleto || activeUser?.nome || activeUser?.name || 'Vendedor'

        const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000)

        const itensAgrupadosMap = {}
        selectedItems.forEach((item) => {
            const prodId = item.product.id
            if (!itensAgrupadosMap[prodId]) {
                itensAgrupadosMap[prodId] = {
                    productId: prodId,
                    nome: item.product.nome,
                    sku: item.product.sku || '',
                    preco: item.product.preco,
                    quantity: 0,
                    subtotal: 0,
                    icon: 'inventory_2'
                }
            }
            itensAgrupadosMap[prodId].quantity += item.quantity
            itensAgrupadosMap[prodId].subtotal += item.subtotal
        })

        const salePayload = {
            usuarioId: activeUserId,
            userId: activeUserId,
            nomeVendedor: activeUserName,
            orderId,
            total: totalGeneral,
            dataVenda: saleDate,
            items: Object.values(itensAgrupadosMap)
        }

        try {
            let createdOrderId = orderId
            try {
                const response = await axios.post('/api/vendas', salePayload)
                createdOrderId = response.data?.orderId || orderId
            } catch (proxyErr) {
                const response = await axios.post(`${API_BASE}/vendas`, salePayload); createdOrderId = response.data?.orderId || orderId
            }

            setSelectedQuantities({})
            setIsModalOpen(false)

            setSuccessToastData({
                orderId: createdOrderId,
                total: totalGeneral,
                itemsCount: totalItemsCount
            })
            setShouldRenderToast(true)
            setIsToastExiting(false)

            if (onConfirmSale) {
                onConfirmSale(salePayload.items, totalGeneral, createdOrderId)
            }

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('venda_confirmada', { detail: { orderId: createdOrderId, usuarioId: activeUserId } }))
                window.dispatchEvent(new CustomEvent('sale_completed', { detail: { orderId: createdOrderId, usuarioId: activeUserId } }))
            }

            setTimeout(() => {
                setIsToastExiting(true)
                setTimeout(() => {
                    setShouldRenderToast(false)
                    setSuccessToastData(null)
                    setIsToastExiting(false)
                }, 300)
            }, 3500)

        } catch (err) {
            alert('Erro ao confirmar venda: ' + (err.response?.data?.error || err.message))
        }
    }

    const openEditModal = (product) => {
        setEditingProduct(product)
        setProductForm({
            nome: product.nome,
            categoria: product.categoria || '',
            fotoUrl: product.fotoUrl || product.foto || product.imagem || '',
            preco: String(product.preco ?? ''),
            precoCusto: String(product.precoCusto ?? product.custo ?? ''),
            quantidadeEstoque: String(product.atual ?? ''),
            quantidadeMinima: String(product.minimo ?? '')
        })
        setProductFormError('')
        setIsProductModalOpen(true)
    }

    const openAddModal = () => {
        setEditingProduct(null)
        setProductForm({
            nome: '', categoria: '', fotoUrl: '',
            preco: '', precoCusto: '', quantidadeEstoque: '', quantidadeMinima: ''
        })
        setProductFormError('')
        setIsProductModalOpen(true)
    }

    const handleSaveProduct = async () => {
        if (!productForm.nome.trim()) {
            setProductFormError('O nome do produto é obrigatório.')
            return
        }
        if (!productForm.preco || isNaN(parseFloat(productForm.preco))) {
            setProductFormError('Informe um preço de venda válido.')
            return
        }

        setSavingProduct(true)
        setProductFormError('')

        const data = {
            nome: productForm.nome.trim(),
            categoria: productForm.categoria.trim() || 'Geral',
            sku: editingProduct ? (editingProduct.sku || String(editingProduct.id)) : '',
            fotoUrl: productForm.fotoUrl,
            preco: parseFloat(productForm.preco),
            precoCusto: productForm.precoCusto !== '' ? parseFloat(productForm.precoCusto) : 0,
            quantidadeEstoque: parseInt(productForm.quantidadeEstoque) || 0,
            quantidadeMinima: parseInt(productForm.quantidadeMinima) || 0,
            usuarioId: user?.id || JSON.parse(localStorage.getItem('ctrl_vendas_logged_user') || '{}')?.id
        }

        try {
            if (editingProduct) {
                await onEditProduct(editingProduct.id, data)
            } else {
                await onAddProduct(data)
            }
            setIsProductModalOpen(false)
        } catch (err) {
            console.error("Erro detalhado ao salvar produto:", err)
            setProductFormError('Erro ao salvar produto. Tente novamente.')
        } finally {
            setSavingProduct(false)
        }
    }

    const promptDeleteProduct = () => {
        if (!editingProduct) return
        setProductToDelete(editingProduct)
        setIsDeleteModalOpen(true)
    }

    const confirmDeleteProduct = async () => {
        if (!productToDelete) return

        try {
            if (onDeleteProduct) {
                await onDeleteProduct(productToDelete.id)
            }
            setIsDeleteModalOpen(false)
            setIsProductModalOpen(false)
            setProductToDelete(null)
        } catch (err) {
            console.error("Erro ao excluir produto:", err)
            setProductFormError('Erro ao excluir produto.')
            setIsDeleteModalOpen(false)
        }
    }

    return (
        <div className="bg-[#f8f9ff] text-[#0b1c30] min-h-screen flex flex-col font-sans antialiased pb-28 relative selection:bg-blue-100 selection:text-blue-900">
            <style>{`
        @keyframes slideUpToast {
          from { transform: translate(-50%, 120%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideDownToast {
          from { transform: translate(-50%, 0); opacity: 1; }
          to { transform: translate(-50%, 120%); opacity: 0; }
        }
        .animate-toast-in { animation: slideUpToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-toast-out { animation: slideDownToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes slideUpBar {
          from { transform: translateY(120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideDownBar {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(120%); opacity: 0; }
        }
        .animate-slide-up-bar { animation: slideUpBar 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-down-bar { animation: slideDownBar 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

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

            <main className="bg-zinc-50 w-full max-w-7xl mx-auto pt-8 px-6 sm:px-8 flex-grow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                            Estoque
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Controle total do estoque dos seus produtos
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2.5">
                            <div className="text-xs">
                                <span className="text-slate-400 block font-medium">Cadastrados</span>
                                <span className="font-bold text-slate-800 text-[14px]">
                                    {userProducts.length === 1 ? '1 item' : `${userProducts.length} itens`}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2.5">
                            <div className="text-xs">
                                <span className="text-slate-400 block font-medium">Total Gasto</span>
                                <span className="font-bold text-rose-600 text-[14px]">
                                    {formatCurrency(estoqueFinanceiro.gasto)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2.5">
                            <div className="text-xs">
                                <span className="text-slate-400 block font-medium">Possível Ganho</span>
                                <span className="font-bold text-emerald-600 text-[14px]">
                                    {formatCurrency(estoqueFinanceiro.possivelGanho)}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            id="btn-filtro"
                            onClick={() => setIsFilterOpen(true)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all cursor-pointer active:scale-95 ${hasActiveFilters
                                ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20'
                                : 'bg-blue-600 text-white border-slate-200 hover:bg-blue-700 hover:border-blue-700 hover:text-white shadow-sm'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            <span>Filtrar e ordenar{hasActiveFilters ? ' ●' : ''}</span>
                        </button>

                        <button
                            type="button"
                            id="btn-adicionar-produto"
                            onClick={openAddModal}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 font-semibold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span>Adicionar</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                            search
                        </span>
                        <input
                            type="text"
                            id="search-input-estoque"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Pesquisar por nome ou ID..."
                            className="w-full h-11 pl-11 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${selectedCategory === cat
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loadingProducts ? (
                        <div className="py-16 text-center text-slate-400">
                            <span className="material-symbols-outlined text-[42px] text-slate-300 animate-spin block mx-auto mb-2">
                                autorenew
                            </span>
                            <p className="font-semibold text-slate-500">Carregando produtos...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th className="py-3.5 px-6">Produto</th>
                                        <th className="py-3.5 px-4 hidden sm:table-cell">Categoria</th>
                                        <th className="py-3.5 px-4 text-right">Preço Unit.</th>
                                        <th className="py-3.5 px-4 text-center">Estoque</th>
                                        <th className="py-3.5 px-6 text-center">Saída (Qtd)</th>
                                        <th className="py-3.5 px-6 text-right">Subtotal</th>
                                        <th className="py-3.5 px-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <span className="material-symbols-outlined text-[42px] text-slate-300">
                                                        inventory
                                                    </span>
                                                    <p className="font-semibold text-slate-600">Nenhum produto encontrado</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((prod) => {
                                            const selectedQty = selectedQuantities[prod.id] || 0
                                            const estoqueDisponivelReal = prod.atual - selectedQty
                                            const isOutOfStock = estoqueDisponivelReal <= 0
                                            const subtotal = selectedQty * prod.preco
                                            const isLowStock = estoqueDisponivelReal <= prod.minimo && estoqueDisponivelReal > 0

                                            const statusColor = isOutOfStock
                                                ? 'bg-rose-600 text-white border-rose-600 font-semibold'
                                                : isLowStock
                                                    ? 'bg-amber-500 text-white border-amber-500 font-semibold'
                                                    : 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                            const dotColor = 'bg-white'

                                            return (
                                                <tr
                                                    key={prod.id}
                                                    className={`transition-colors hover:bg-slate-50/60 ${selectedQty > 0 ? 'bg-blue-50/30' : ''
                                                        }`}
                                                >
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3.5">
                                                            <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden shadow-md">
                                                                {(prod.fotoUrl || prod.foto || prod.imagem) ? (
                                                                    <img
                                                                        src={prod.fotoUrl || prod.foto || prod.imagem}
                                                                        alt={prod.nome}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-[36px]">inventory_2</span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-slate-900 block leading-snug">
                                                                    {prod.nome}
                                                                </span>
                                                                <span className="text-[12px] font-mono text-slate-400">
                                                                    ID: #{prod.id}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-4 px-4 text-slate-600 hidden sm:table-cell text-[13px]">
                                                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                                                            {prod.categoria || 'Geral'}
                                                        </span>
                                                    </td>

                                                    <td className="py-4 px-4 text-right font-medium text-slate-800">
                                                        {formatCurrency(prod.preco)}
                                                    </td>

                                                    <td className="py-4 px-4 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusColor}`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                                                {estoqueDisponivelReal === 1 ? '1 item' : `${estoqueDisponivelReal} un`}
                                                            </span>
                                                            {isLowStock && (
                                                                <span className="text-[10px] text-amber-600 font-medium mt-0.5">
                                                                    Mín. {prod.minimo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDecrease(prod.id)}
                                                                disabled={selectedQty <= 0}
                                                                className={`w-9 h-9 rounded-xl flex items-center justify-center border font-bold transition-all active:scale-90 cursor-pointer ${selectedQty > 0
                                                                    ? 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700 shadow-sm'
                                                                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                                                    }`}
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">remove</span>
                                                            </button>

                                                            <span
                                                                className={`w-10 text-center font-bold text-[15px] select-none ${selectedQty > 0 ? 'text-blue-700' : 'text-slate-400'
                                                                    }`}
                                                            >
                                                                {selectedQty}
                                                            </span>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectOne(prod.id, prod.atual)}
                                                                disabled={isOutOfStock || selectedQty >= prod.atual}
                                                                title="Adicionar unidades para saída"
                                                                className={`w-9 h-9 rounded-xl flex items-center justify-center border font-bold transition-all active:scale-90 cursor-pointer ${!isOutOfStock && selectedQty < prod.atual
                                                                    ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20'
                                                                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed opacity-60'
                                                                    }`}
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">add</span>
                                                            </button>
                                                        </div>
                                                    </td>

                                                    <td className="py-4 px-6 text-right">
                                                        <span
                                                            className={`font-semibold block ${selectedQty > 0 ? 'text-blue-700 font-bold' : 'text-slate-300'
                                                                }`}
                                                        >
                                                            {selectedQty > 0 ? formatCurrency(subtotal) : 'R$ 0,00'}
                                                        </span>
                                                    </td>

                                                    <td className="py-4 px-4 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditModal(prod)}
                                                            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 border border-transparent hover:border-blue-500 transition-all cursor-pointer mx-auto"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* NOTIFICAÇÃO FLUTUANTE DE SUCESSO */}
            {shouldRenderToast && successToastData && (
                <div className={`fixed bottom-6 left-1/2 z-50 w-[92%] max-w-xl bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-emerald-500 ${isToastExiting ? 'animate-toast-out' : 'animate-toast-in'}`}>
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-700/60 flex items-center justify-center text-white shrink-0 shadow-inner">
                            <span className="material-symbols-outlined text-[26px]">check_circle</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-[16px] leading-tight text-white">Venda feita com sucesso!</span>
                            <span className="text-xs text-emerald-100 mt-0.5 font-medium">
                                Pedido #{successToastData.orderId} • <strong className="text-white">{formatCurrency(successToastData.total)}</strong> ({successToastData.itemsCount} {successToastData.itemsCount === 1 ? 'item' : 'itens'})
                            </span>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-emerald-200 text-[22px]">verified</span>
                </div>
            )}

            {/* MODAL DE FILTRO E ORDENAÇÃO */}
            {isFilterOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900">Filtros e Ordenação</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFilterOpen(false)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Ordenar por</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="recente">Mais Recentes / Padrão</option>
                                    <option value="id">ID (Crescente)</option>
                                    <option value="az">Nome (A - Z)</option>
                                    <option value="za">Nome (Z - A)</option>
                                    <option value="preco-maior">Preço (Maior para Menor)</option>
                                    <option value="preco-menor">Preço (Menor para Maior)</option>
                                    <option value="qtd-maior">Quantidade em Estoque (Maior)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Status do Estoque</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="todos">Todos os Status</option>
                                    <option value="disponivel">Disponível (Acima do Mínimo)</option>
                                    <option value="baixo">Atenção / Baixo Estoque</option>
                                    <option value="esgotado">Esgotado (0 un)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Estoque Mínimo Disponível</label>
                                <input
                                    type="number"
                                    value={filterMinStock}
                                    onChange={(e) => setFilterMinStock(e.target.value)}
                                    placeholder="Ex: 5"
                                    min="0"
                                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Preço Máximo (R$)</label>
                                <input
                                    type="number"
                                    value={filterMaxPrice}
                                    onChange={(e) => setFilterMaxPrice(e.target.value)}
                                    placeholder="Ex: 100.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="px-4 py-2 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                                Limpar Filtros
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsFilterOpen(false)}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                            >
                                Aplicar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BARRA FLUTUANTE DE SELEÇÃO */}
            {shouldRenderBar && (
                <div className={`fixed bottom-6 inset-x-0 z-30 px-6 max-w-3xl mx-auto ${isBarExiting ? 'animate-slide-down-bar' : 'animate-slide-up-bar'}`}>
                    <div className="bg-white text-slate-900 px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-200">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/30">
                                {totalItemsCount}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-[15px] leading-tight text-slate-900">
                                    {totalItemsCount} {totalItemsCount === 1 ? 'item selecionado' : 'itens selecionados'}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                    Total: <strong className="text-blue-600">{formatCurrency(totalGeneral)}</strong>
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedQuantities({})}
                                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all cursor-pointer active:scale-95"
                            >
                                Limpar
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-tight shadow-lg shadow-blue-600/30 active:scale-95 transition-all cursor-pointer"
                            >
                                Visualizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE VISUALIZAÇÃO E CONFIRMAÇÃO DA VENDA */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-base">Resumo da Venda</h3>
                                    <p className="text-xs text-slate-500">Confirme os itens selecionados e a data da operação</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 block mb-0.5">Data da Venda</label>
                                    <span className="text-[11px] text-slate-500">Esta data aparecerá registada no histórico</span>
                                </div>
                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 shadow-sm"
                                />
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Itens Selecionados</h4>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                                    {selectedItems.map((item) => (
                                        <div key={item.product.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                                    {item.product.fotoUrl || item.product.foto || item.product.imagem ? (
                                                        <img src={item.product.fotoUrl || item.product.foto || item.product.imagem} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[20px] text-slate-400">inventory_2</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-900 text-sm block">{item.product.nome}</span>
                                                    <span className="text-xs text-slate-400">
                                                        {item.quantity} un. × {formatCurrency(item.product.preco)}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="font-bold text-slate-800 text-sm">
                                                {formatCurrency(item.subtotal)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white text-slate-900 border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                                <div>
                                    <span className="text-xs text-slate-400 block font-medium">Valor Total da Venda</span>
                                    <span className="text-xs text-slate-500 font-semibold">{totalItemsCount} {totalItemsCount === 1 ? 'item' : 'itens'} no total</span>
                                </div>
                                <span className="text-2xl font-bold text-blue-600 tracking-tight">
                                    {formatCurrency(totalGeneral)}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="py-2.5 px-5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 cursor-pointer transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmOrder}
                                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                <span>Confirmar Venda</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isProductModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        {editingProduct ? 'Modificar Produto' : 'Adicionar Produto'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {editingProduct ? `Editando ID: #${editingProduct.id}` : 'Novo item no catálogo'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsProductModalOpen(false)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            {editingProduct && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Código do Sistema (ID Automático)</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={`#${editingProduct.id}`}
                                        className="w-full h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-sm cursor-not-allowed font-mono font-semibold"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Nome do Produto *</label>
                                <input
                                    type="text"
                                    value={productForm.nome}
                                    onChange={(e) => setProductForm((p) => ({ ...p, nome: e.target.value }))}
                                    placeholder="Ex: Café Especial Torrado 500g"
                                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Categoria</label>
                                <input
                                    type="text"
                                    value={productForm.categoria}
                                    onChange={(e) => setProductForm((p) => ({ ...p, categoria: e.target.value }))}
                                    placeholder="Ex: Mercearia"
                                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Preço Custo (R$) *</label>
                                    <input
                                        type="number"
                                        value={productForm.precoCusto}
                                        onChange={(e) => setProductForm((p) => ({ ...p, precoCusto: e.target.value }))}
                                        placeholder="0,00"
                                        min="0"
                                        step="0.01"
                                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Preço Venda (R$) *</label>
                                    <input
                                        type="number"
                                        value={productForm.preco}
                                        onChange={(e) => setProductForm((p) => ({ ...p, preco: e.target.value }))}
                                        placeholder="0,00"
                                        min="0"
                                        step="0.01"
                                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Qtd Estoque</label>
                                    <input
                                        type="number"
                                        value={productForm.quantidadeEstoque}
                                        onChange={(e) => setProductForm((p) => ({ ...p, quantidadeEstoque: e.target.value }))}
                                        placeholder="0"
                                        min="0"
                                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Qtd Mínima</label>
                                    <input
                                        type="number"
                                        value={productForm.quantidadeMinima}
                                        onChange={(e) => setProductForm((p) => ({ ...p, quantidadeMinima: e.target.value }))}
                                        placeholder="0"
                                        min="0"
                                        className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Foto do Produto</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden shadow-sm">
                                        {productForm.fotoUrl ? (
                                            <img src={productForm.fotoUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-[24px]">image</span>
                                        )}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProductImageChange}
                                        className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 hover:file:cursor-pointer"
                                    />
                                </div>
                            </div>

                            {productFormError && (
                                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 font-medium">
                                    {productFormError}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                            {editingProduct ? (
                                <button
                                    type="button"
                                    onClick={promptDeleteProduct}
                                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-100 text-white border border-rose-200 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
                                >
                                    <span>Excluir</span>
                                </button>
                            ) : <div />}

                            <div className="flex gap-2 flex-1 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setIsProductModalOpen(false)}
                                    className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 cursor-pointer transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveProduct}
                                    disabled={savingProduct}
                                    className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    {savingProduct ? (
                                        <>
                                            <span className="material-symbols-outlined text-[18px] animate-spin">autorenew</span>
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{editingProduct ? 'Salvar' : 'Adicionar'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
            {isDeleteModalOpen && productToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <span className="material-symbols-outlined text-[26px]">warning</span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            Tem certeza que quer excluir?
                        </h3>

                        <p className="text-sm text-slate-500 mb-6">
                            O produto <strong className="text-slate-800 font-semibold">"{productToDelete.nome}"</strong> será permanentemente removido do sistema.
                        </p>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 cursor-pointer transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteProduct}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-500/20 cursor-pointer transition-all active:scale-95"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}