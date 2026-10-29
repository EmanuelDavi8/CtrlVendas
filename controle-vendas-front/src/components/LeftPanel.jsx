import React from 'react'

function LeftPanel({ viewState, textFading }) {
  const getPanelContent = () => {
    switch (viewState) {
      case 'login':
        return {
          title: 'Seja bem vindo de volta!',
          subtitle: 'Acesse seus canais de vendas, metas e pipeline comercial'
        }
      case 'register':
        return {
          title: 'Bem vindo!',
          subtitle: 'Configure sua organização comercial em menos de 2 minutos'
        }
      default:
        return {
          title: 'Seja bem vindo!',
          subtitle: 'Plataforma de alta performance para inteligência e controle de vendas'
        }
    }
  }

  const { title, subtitle } = getPanelContent()

  return (
    <div
      id="left-panel"
      className={`w-full min-h-[200px] sm:min-h-[220px] lg:min-h-screen bg-blue-700 flex flex-col justify-center items-center px-8 lg:px-12 text-center select-none z-10 shadow-lg lg:shadow-none transition-all duration-700 ease-in-out shrink-0 ${viewState === 'initial' ? 'w-full lg:w-[60%]' : 'w-full lg:w-[40%]'
        }`}
    >
      <div className="max-w-md mx-auto flex flex-col items-center justify-center">
        <h1
          id="blue-panel-title"
          className={`font-display lg:text-4xl text-3xl font-bold text-white tracking-tight leading-tight transition-opacity duration-300 ${textFading ? 'opacity-0' : 'opacity-100'
            }`}
        >
          {title}
        </h1>
        <p
          id="blue-panel-subtitle"
          className={`font-sans lg:text-base text-blue-100 mt-3 font-normal max-w-sm transition-opacity duration-300 ${textFading ? 'opacity-0' : 'opacity-100'
            }`}
        >
          {subtitle}
        </p>
      </div>
    </div>
  )
}

export default LeftPanel