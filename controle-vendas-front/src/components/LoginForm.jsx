import React, { useState } from 'react'
import PasswordField from './PasswordField'
import { formatCPF } from '../utils/masks'

function LoginForm({
  onBack,
  onSwitchToRegister,
  onSelectRegister,
  initialUsername = '',
  textFading,
  onLogin,
  onLoginSuccess
}) {
  const handleSwitchToRegister = onSwitchToRegister || onSelectRegister
  const [formData, setFormData] = useState({
    cpf: initialUsername,
    password: ''
  })
  const [feedback, setFeedback] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)
  const [isPendingState, setIsPendingState] = useState(false)

  React.useEffect(() => {
    if (initialUsername) {
      setFormData((prev) => ({ ...prev, cpf: formatCPF(initialUsername) }))
    }
  }, [initialUsername])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.cpf.trim() || !formData.password) {
      setFeedback({
        type: 'erro',
        text: 'Por favor, informe seu CPF e senha.'
      })
      return
    }

    setLoading(true)
    setIsPendingState(false)
    setFeedback({
      type: 'sucesso',
      text: 'Acessando workspace comercial...'
    })

    try {
      const res = await fetch('http://localhost:8080/api/usuarios/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cpf: formData.cpf,
          senha: formData.password
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        setLoading(false)
        const errorMsg = errData.error || 'CPF ou senha incorretos.'

        if (errorMsg.includes('aguarda aprovação') || errorMsg.includes('pendente')) {
          setIsPendingState(true)
        }

        setFeedback({
          type: 'erro',
          text: errorMsg
        })
        return
      }

      const matched = await res.json()
      setLoading(false)

      const displayName = matched.nomeCompleto || matched.name || 'Administrador'
      const userId = matched.id
      const userType = matched.tipo || 'VENDEDOR'

      const userObj = {
        cpf: formData.cpf.trim(),
        name: displayName,
        nomeCompleto: displayName,
        tipo: userType,
        ...(userId != null ? { id: userId } : {})
      }

      if (onLoginSuccess) {
        onLoginSuccess(userObj)
      } else if (onLogin) {
        onLogin(userObj)
      }

    } catch (err) {
      setLoading(false)
      setFeedback({
        type: 'erro',
        text: 'Erro de conexão com o servidor. Verifique se o backend está ativo.'
      })
    }
  }

  return (
    <div
      id="login-form-view"
      className={`glass-card backdrop-blur-md bg-white/70 border border-white/40 shadow-xl rounded-2xl p-6 sm:p-8 w-full transition-all duration-300 ease-out transform flex flex-col ${textFading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
    >
      <div className="flex items-center justify-between mb-5">
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

      <div className="mb-5 text-left">
        <h3 className="font-display text-2xl font-bold text-[#131b2e]">Acesse sua conta</h3>
        <p className="font-sans text-xs text-[#444653] mt-1">
          Informe seu CPF e senha para entrar no console comercial.
        </p>
      </div>

      <form id="login-form" onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1.5 text-left">
          <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor="login-cpf">
            CPF
          </label>
          <input
            id="login-cpf"
            type="text"
            autoComplete="username"
            value={formData.cpf}
            onChange={(e) => setFormData((prev) => ({ ...prev, cpf: formatCPF(e.target.value) }))}
            placeholder="000.000.000-00"
            maxLength={14}
            className="glass-input glass-input-register w-full py-2.5 px-3.5 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none"
            required
          />
        </div>

        {/* Passando a prop isRegister={true} para o PasswordField ficar idêntico ao de cadastro */}
        <PasswordField
          id="login-password"
          label="Senha"
          autoComplete="current-password"
          value={formData.password}
          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
          isRegister={true}
        />

        {feedback.text && (
          <div
            id="login-feedback"
            className={`text-xs py-3 px-3.5 border-l-4 flex items-center gap-2.5 transition-all ${feedback.type === 'erro'
                ? isPendingState
                  ? 'bg-amber-50 text-amber-800 border-amber-500'
                  : 'bg-red-50 text-red-700 border-red-500'
                : 'bg-blue-50 text-[#1e40af] border-blue-600'
              }`}
          >
            {isPendingState && (
              <span className="material-symbols-outlined text-[20px] text-amber-600 animate-spin">
                hourglass_top
              </span>
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <button
          type="submit"
          id="btn-entrar-sistema"
          disabled={loading}
          className="mt-2 w-full py-3.5 px-6 rounded-xl font-sans text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 active:scale-95 transition-all duration-150 ease-out text-center flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <span>{loading ? 'Conectando...' : 'Entrar no Sistema'}</span>
        </button>
      </form>

      <div className="mt-6 text-left">
        <p className="font-sans text-sm text-[#444653]">
          Não possui cadastro?
          <button
            type="button"
            onClick={handleSwitchToRegister}
            className="font-semibold text-[#1e40af] hover:opacity-80 transition-opacity focus:outline-none ml-1 bg-transparent border-none p-0 cursor-pointer"
          >
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  )
}

export default LoginForm