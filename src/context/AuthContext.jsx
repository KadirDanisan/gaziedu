import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { userApi } from "../api/userApi";

const AuthContext = createContext(null);

const initialUser = {
  firstName: "",
  lastName: "",
  fullName: "",
  email: "",
  nationalId: "",
  gender: "",
  genderLabel: "Seçim yapılmadı",
  userType: "Belirtilmedi",
  customerType: "1",
  addressLine1: "",
  addressLine2: "",
  countryCode: "",
  countryLabel: "",
  city: "",
  district: "",
  postalCode: "",
};

function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [isReady, setIsReady] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const login = (payload) => {
    setIsLoggedIn(true);
    if (!payload) return;
    setUser((prev) => ({
      ...prev,
      ...payload,
    }));
  };

  const loginUser = async ({ email, password }) => {
    const result = await userApi.login({ email, password });
    localStorage.setItem("userToken", result.token);
    let profile = result.user;
    try {
      profile = await userApi.me();
    } catch {
      profile = result.user;
    }
    login(profile);
    try {
      const items = await userApi.getFavorites();
      setFavorites(items || []);
    } catch {
      setFavorites([]);
    }
    return profile;
  };

  const registerUser = async ({ firstName, lastName, email, password, nationalId }) => {
    const result = await userApi.register({ firstName, lastName, email, password, nationalId });
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem("userToken");
    setIsLoggedIn(false);
    setUser(initialUser);
    setFavorites([]);
  };

  const loadFavorites = useCallback(async () => {
    const items = await userApi.getFavorites();
    setFavorites(items || []);
    return items || [];
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await userApi.me();
    setUser((prev) => ({ ...prev, ...profile }));
    return profile;
  }, []);

  const isFavorite = useCallback((course) => {
    if (!course?.id) return false;
    const st = course.sourceType || "education";
    return favorites.some((f) => f.id === course.id && (f.sourceType || "education") === st);
  }, [favorites]);

  const toggleFavorite = useCallback(
    async (id, sourceType = "education") => {
      if (!id) return false;
      if (!isLoggedIn) {
        throw new Error("Favorilere eklemek için giriş yapmalısınız.");
      }
      const st = sourceType === "calendar" ? "calendar" : "education";
      const already = favorites.some((f) => f.id === id && (f.sourceType || "education") === st);
      if (already) {
        if (st === "calendar") {
          await userApi.removeFavorite({ calendarId: id });
        } else {
          await userApi.removeFavorite({ educationId: id });
        }
        setFavorites((prev) =>
          prev.filter((f) => !(f.id === id && (f.sourceType || "education") === st)),
        );
        return false;
      }
      await userApi.addFavorite(st === "calendar" ? { calendarId: id } : { educationId: id });
      await loadFavorites();
      return true;
    },
    [isLoggedIn, favorites, loadFavorites]
  );

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
        await loadFavorites();
      } catch {
        localStorage.removeItem("userToken");
        setIsLoggedIn(false);
        setUser(initialUser);
        setFavorites([]);
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
      favorites,
      isFavorite,
      loadFavorites,
      refreshProfile,
      toggleFavorite,
    }),
    [isLoggedIn, isReady, user, favorites, isFavorite, loadFavorites, refreshProfile, toggleFavorite]
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
