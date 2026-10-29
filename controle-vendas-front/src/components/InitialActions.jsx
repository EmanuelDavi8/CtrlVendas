import React from 'react'

function InitialActions({ onSelectLogin, onSelectRegister, onSwitchToLogin, onSwitchToRegister, textFading }) {
  const handleLogin = onSelectLogin || onSwitchToLogin
  const handleRegister = onSelectRegister || onSwitchToRegister

  return (
    <div
      id="initial-actions-view"
      className={`glass-card backdrop-blur-md bg-white/70 border border-white/40 shadow-xl rounded-2xl p-6 sm:p-8 w-full transition-all duration-300 ease-out transform flex flex-col ${textFading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
    >
      <div className="flex flex-col gap-3.5 mt-1 w-full">
        <button
          id="btn-entrar-inicial"
          type="button"
          onClick={handleLogin}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 active:scale-95 transition-all duration-150 ease-out text-center flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Entrar</span>
        </button>

        <button
          id="btn-cadastrar-inicial"
          type="button"
          onClick={onSelectRegister}
          className="w-full py-3.5 px-6 rounded-xl font-medium text-sm bg-white/80 text-[#131b2e] border border-slate-200/80 hover:bg-white hover:opacity-95 active:scale-95 transition-all duration-150 ease-out text-center flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Cadastre-se</span>
        </button>
      </div>

      <div className="mt-7 text-center sm:text-left w-full">
        <p className="font-sans text-sm text-[#444653]">
          já possui uma conta?{' '}
          <button
            type="button"
            onClick={handleLogin}
            className="text-blue-700 font-semibold hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none p-0 inline font-sans"
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  )
}

export default InitialActions
