import React from 'react'

function BrandHeader({ textFading = false }) {
  return (
    <div
      className={`w-full flex flex-col items-start justify-start text-left mb-6 transition-all duration-300 ease-out transform ${textFading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
    >
      <h2 className="font-display text-3xl font-bold text-[#131b2e] tracking-tight leading-tight mb-1">
        CrtlVendas
      </h2>

      <p className="font-sans text-sm text-[#444653] mt-0">
        Vendas automatizadas e controladas
      </p>
    </div>
  )
}

export default BrandHeader