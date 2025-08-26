"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { usePrivy, useLogin } from "@privy-io/react-auth"
import { User } from "@privy-io/react-auth"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, logout } = usePrivy()
  const [isLoading, setIsLoading] = useState(true)

  const { login } = useLogin({
    onComplete: () => {
      setIsLoading(false)
    },
    onError: (error) => {
      console.error("Login error:", error)
      setIsLoading(false)
    },
  })

  // Update loading state when Privy is ready
  useEffect(() => {
    if (ready) {
      setIsLoading(false)
    }
  }, [ready])

  const value: AuthContextType = {
    user,
    isAuthenticated: authenticated,
    isLoading,
    login: () => login({ loginMethods: ["wallet"] }),
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}