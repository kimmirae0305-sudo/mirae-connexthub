import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { canAccessPage, type PageKey } from "./permissions";

interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        localStorage.removeItem("authToken");
        setToken(null);
      }
    } catch {
      localStorage.removeItem("authToken");
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Login failed");
    }

    const data = await response.json();
    localStorage.setItem("authToken", data.token);
    setToken(data.token);
    setUser(data.user);
    
    // Redirect based on mustChangePassword flag
    if (data.user.mustChangePassword) {
      setLocation("/change-password");
    } else {
      setLocation("/");
    }
  }, [setLocation]);

  const logout = useCallback(() => {
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
    setLocation("/login");
  }, [setLocation]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function ProtectedRoute({ children, allowChangePassword = false }: { children: React.ReactNode, allowChangePassword?: boolean }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  useEffect(() => {
    // If user must change password and this route doesn't allow it, redirect
    if (!isLoading && user && user.mustChangePassword && !allowChangePassword) {
      setLocation("/change-password");
    }
  }, [user, isLoading, allowChangePassword, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" data-testid="loading-spinner">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPage?: PageKey;
  fallback?: React.ReactNode;
}

export function RoleGuard({ 
  children, 
  allowedRoles, 
  requiredPage,
  fallback 
}: RoleGuardProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" data-testid="role-guard-loading">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  let hasAccess = false;

  if (requiredPage) {
    hasAccess = canAccessPage(user.role, requiredPage);
  } else if (allowedRoles) {
    hasAccess = allowedRoles.includes(user.role);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4" data-testid="access-denied">
        <div className="text-4xl text-muted-foreground">403</div>
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
        <button
          onClick={() => setLocation("/")}
          className="text-primary hover:underline"
          data-testid="button-go-home"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
