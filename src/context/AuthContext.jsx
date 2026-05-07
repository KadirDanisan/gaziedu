import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { userApi } from "../api/userApi";

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
  const [isReady, setIsReady] = useState(false);

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

  const loginUser = async ({ email, password }) => {
    const result = await userApi.login({ email, password });
    localStorage.setItem("userToken", result.token);
    login(result.user);
    return result.user;
  };

  const registerUser = async ({ firstName, lastName, email, password }) => {
    const result = await userApi.register({ firstName, lastName, email, password });
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem("userToken");
    setIsLoggedIn(false);
    setUser(initialUser);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem("userToken");
      if (!token) {
        setIsReady(true);
        return;
      }

      try {
        const profile = await userApi.me();
        login(profile);
      } catch {
        localStorage.removeItem("userToken");
        setIsLoggedIn(false);
        setUser(initialUser);
      } finally {
        setIsReady(true);
      }
    };

    bootstrap();
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      isReady,
      user,
      login,
      loginUser,
      registerUser,
      logout,
    }),
    [isLoggedIn, isReady, user]
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
