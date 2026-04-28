import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

const initialUser = {
  fullName: "kadir danışan",
  email: "kadir@fadestudio.com.tr",
  phone: "",
  profession: "",
  gender: "Seçim yapılmadı",
  userType: "Belirtilmedi",
};

function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(initialUser);

  const login = (payload) => {
    setIsLoggedIn(true);
    if (payload?.fullName || payload?.email) {
      setUser((prev) => ({
        ...prev,
        fullName: payload.fullName || prev.fullName,
        email: payload.email || prev.email,
      }));
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(initialUser);
  };

  const value = useMemo(
    () => ({
      isLoggedIn,
      user,
      login,
      logout,
    }),
    [isLoggedIn, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export { AuthProvider, useAuth };
