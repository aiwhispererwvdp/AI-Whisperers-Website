'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Language } from './types'
import { DEFAULT_LANGUAGE } from './types'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const STORAGE_KEY = 'ai-paraguay-language'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)
  const [isLoading, setIsLoading] = useState(true)

  // Load saved language preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language
      if (saved && ['es', 'gn', 'en'].includes(saved)) {
        setLanguageState(saved)
      }
    } catch (error) {
      console.warn('Failed to load language preference:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch (error) {
      console.warn('Failed to save language preference:', error)
    }
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}