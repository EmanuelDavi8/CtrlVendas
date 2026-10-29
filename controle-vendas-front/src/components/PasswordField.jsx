import React, { useState } from 'react'

function PasswordField({
  id,
  name,
  label = 'Senha',
  value,
  onChange,
  placeholder = '••••••••••••',
  autoComplete = 'current-password',
  required = true,
  isRegister = false,
  extraHeader
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-col gap-1.5 text-left">
      <div className="flex items-center justify-between">
        <label className="font-sans text-xs font-semibold text-[#131b2e]" htmlFor={id}>
          {label}
        </label>
        {extraHeader}
      </div>
      <div className="relative w-full">
        <input
          id={id}
          name={name || id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full py-2.5 pl-3.5 pr-11 rounded-lg text-[#131b2e] font-sans text-sm placeholder:text-[#757684] focus:outline-none ${
            isRegister ? 'glass-input glass-input-register' : 'glass-input'
          }`}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 active:scale-90 p-1 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
          title={showPassword ? 'Ocultar senha' : 'Ver senha'}
          aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
        >
          <span className="material-symbols-outlined text-[20px]">
            {showPassword ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  )
}

export default PasswordField
