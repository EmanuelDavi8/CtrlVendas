import React, { useState } from 'react'
import axios from 'axios'
import PasswordField from './PasswordField'
import { formatCPF, formatCNPJ } from '../utils/masks'

const API_BASE = '/api/usuarios'

function RegisterForm({ onBack, onSwitchToLogin, onSelectLogin, onRegisterSuccess, textFading }) {
  const handleSwitchToLogin = onSwitchToLogin || onSelectLogin
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    senha: '',
    cpf: '',
    tipo: 'ADMIN', // Padrão inicial é Administrador
    nomeEmpresa: '',
    cnpj: '',
    adminId: '' // Usado apenas se for Vendedor
  })
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  // Salva os dados no localStorage de forma segura
  const saveToLocalStorage = (user) => {
    try {
      let users = []
      const stored = localStorage.getItem('ctrl_vendas_registered_users')
      if (stored) {
        try {
          users = JSON.parse(stored) || []
          if (!Array.isArray(users)) users = []
        } catch (_) {
          users = []
        }
      }

      const filteredUsers = users.filter(
        (u) => u.cpf !== user.cpf && (u.cnpj ? u.cnpj !== user.cnpj : true)
      )
      filteredUsers.push(user)

      localStorage.setItem('ctrl_vendas_registered_users', JSON.stringify(filteredUsers))
      localStorage.setItem('ctrl_vendas_last_user', JSON.stringify(user))
      return true
    } catch (storageErr) {
      console.warn('Aviso ao gravar no localStorage (ignorado):', storageErr)
      return false
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { nomeCompleto, senha, cpf, tipo, nomeEmpresa, cnpj, adminId } = formData

    // Validações básicas baseadas no tipo de conta escolhido
    if (!nomeCompleto.trim() || !senha || !cpf.trim() || !tipo) {
      setFeedback({
        type: 'erro',
        text: 'Por favor, preencha todos os campos obrigatórios.'
      })
      return
    }

    if (tipo === 'ADMIN' && (!nomeEmpresa.trim() || !cnpj.trim())) {
      setFeedback({
        type: 'erro',
        text: 'Administradores devem informar o Nome da Empresa e o CNPJ.'
      })
      return
    }

    if (tipo === 'VENDEDOR' && (!adminId.trim() || Number(adminId) <= 0)) {
      setFeedback({
        type: 'erro',
        text: 'Vendedores devem informar um ID de Administrador válido (maior que zero).'
      })
      return
    }

    setLoading(true)
    setFeedback({ type: '', text: '' })

    const cleanCpf = cpf.trim()
    const registeredName = nomeCompleto.trim()

    // Monta o objeto para o localStorage
    const newUser = {
      nomeCompleto: registeredName,
      senha,
      cpf: cleanCpf,
      tipo,
      nomeEmpresa: tipo === 'ADMIN' ? nomeEmpresa.trim() : null,
      cnpj: tipo === 'ADMIN' ? cnpj.trim() : null,
      adminId: tipo === 'VENDEDOR' ? adminId.trim() : null,
      dataRegistro: new Date().toISOString()
    }

    saveToLocalStorage(newUser)

    // Monta o payload exato para o Backend Spring Boot
    const payloadBackend = {
      nomeCompleto: registeredName,
      senha,
      cpf: cleanCpf,
      tipo,
      nomeEmpresa: tipo === 'ADMIN' ? nomeEmpresa.trim() : null,
      cnpj: tipo === 'ADMIN' ? cnpj.trim() : null,
      administrador: tipo === 'VENDEDOR' ? { id: Number(adminId) } : null
    }

    try {
      await axios.post(API_BASE, payloadBackend, { timeout: 2500 })
    } catch (apiErr) {
      console.log('Sincronização com API em segundo plano:', apiErr?.message || 'Offline')
    }

    setFeedback({
      type: 'sucesso',
      text: 'Conta cadastrada com sucesso! Redirecionando para o login...'
    })

    setFormData({
      nomeCompleto: '',
      senha: '',
      cpf: '',
      tipo: 'ADMIN',
      nomeEmpresa: '',
      cnpj: '',
      adminId: ''
    })

    setTimeout(() => {
      setLoading(false)
      if (typeof onRegisterSuccess === 'function') {
        onRegisterSuccess(newUser)
      } else if (handleSwitchToLogin) {
        handleSwitchToLogin()
      }
    }, 1000)
  }

  return (
    <div
      id="register-form-view"
      className={`glass-card backdrop-blur-md bg-white/70 border border-white/40 shadow-xl rounded-2xl p-6 sm:p-8 w-full transition-all duration-300 ease-out transform flex flex-col ${textFading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
    >
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-[#444653] hover:text-[#131b2e] active:scale-95 transition-all duration-150 group focus:outline-none cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          Voltar
        </button>
      </div>

      <div className="mb-4 text-left">
        <h3 className="font-display text-2xl font-bold text-[#131b2e]">Criar nova conta comercial</h3>
        <p className="font-sans text-xs text-[#444653] mt-0.5">
          Informe as credenciais empresariais para ativar seu workspace.
        </p>
      </div>

      {/* SELETOR DE TIPO DE CONTA (BOTÕES ESTILO PÍLULA) */}
      <div className="flex flex-col gap-1.5 mb-3 text-left">
        <label className="font-sans text-xs font-semibold text-[#131b2e]">
          Selecione o tipo de conta:
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, tipo: 'ADMIN' }))}
            className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 ${formData.tipo === 'ADMIN'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white/60 text-[#444653] border-gray-200 hover:bg-white'
              }`}
          >
            Administrador
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, tipo: 'VENDEDOR' }))}
            className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 ${formData.tipo === 'VENDEDOR'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white/60 text-[#444653] border-gray-200 hover:bg-white'
              }`}
          >
            Vendedor
          </button>
        </div>
      </div>

      <form id="register-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
        <div className="flex flex-col gap-1 text-left">
          <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor="reg-fullname">
            Nome completo
          </label>
          <input
            id="reg-fullname"
            type="text"
            autoComplete="name"
            value={formData.nomeCompleto}
            onChange={(e) => setFormData((prev) => ({ ...prev, nomeCompleto: e.target.value }))}
            placeholder="Nome e sobrenome"
            className="glass-input glass-input-register w-full py-2.5 px-3.5 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PasswordField
            id="reg-password"
            label="Senha"
            autoComplete="new-password"
            placeholder="Mínimo 8 dígitos"
            value={formData.senha}
            onChange={(e) => setFormData((prev) => ({ ...prev, senha: e.target.value }))}
            isRegister={true}
          />

          <div className="flex flex-col gap-1 text-left">
            <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor="reg-cpf">
              CPF
            </label>
            <input
              id="reg-cpf"
              type="text"
              value={formData.cpf}
              onChange={(e) => setFormData((prev) => ({ ...prev, cpf: formatCPF(e.target.value) }))}
              placeholder="000.000.000-00"
              maxLength={14}
              className="glass-input glass-input-register w-full py-2.5 px-3.5 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none"
              required
            />
          </div>
        </div>

        {/* CAMPOS CONDICIONAIS DEPENDENDO DO TIPO ESCOLHIDO */}
        {formData.tipo === 'ADMIN' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 text-left">
              <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor="reg-company">
                Nome da empresa
              </label>
              <input
                id="reg-company"
                type="text"
                value={formData.nomeEmpresa}
                onChange={(e) => setFormData((prev) => ({ ...prev, nomeEmpresa: e.target.value }))}
                placeholder="Razão social ou fantasia"
                className="glass-input glass-input-register w-full py-2.5 px-3.5 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none"
                required
              />
            </div>

            <div className="flex flex-col gap-1 text-left">
              <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor="reg-cnpj">
                CNPJ
              </label>
              <input
                id="reg-cnpj"
                type="text"
                value={formData.cnpj}
                onChange={(e) => setFormData((prev) => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                className="glass-input glass-input-register w-full py-2.5 px-3.5 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none"
                required
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 text-left">
            <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor="reg-admin-id">
              ID do Administrador (Chefe)
            </label>
            <input
              id="reg-admin-id"
              type="number"
              min="1"
              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault() }}
              value={formData.adminId}
              onChange={(e) => setFormData((prev) => ({ ...prev, adminId: e.target.value }))}
              placeholder="Ex: 1"
              className="glass-input glass-input-register w-full py-2.5 px-3.5 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none"
              required
            />
            <span className="text-[11px] text-[#757684] mt-0.5">
              Insira o código numérico do administrador ao qual você se vinculará.
            </span>
          </div>
        )}

        {feedback.text && (
          <div
            id="register-feedback"
            className={`text-xs py-2.5 px-3.5 font-medium border-l-4 transition-all ${feedback.type === 'erro'
                ? 'bg-red-50 text-red-700 border-red-500'
                : 'bg-emerald-50 text-emerald-800 border-emerald-600'
              }`}
          >
            {feedback.text}
          </div>
        )}

        <button
          id="btn-cadastrar"
          type="submit"
          disabled={loading}
          className="mt-2 w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-blue-600 hover:opacity-95 active:scale-95 text-white shadow-md transition-all duration-150 ease-out text-center flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span id="btn-cadastrar-text">
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </span>
        </button>
      </form>

      <div className="mt-5 text-left">
        <p className="font-sans text-sm text-[#444653]">
          Já possui conta?
          <button
            type="button"
            onClick={handleSwitchToLogin}
            className="font-semibold text-[#1e40af] hover:opacity-80 transition-opacity focus:outline-none ml-1 bg-transparent border-none p-0 cursor-pointer"
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  )
}

export default RegisterForm