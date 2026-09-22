import { User } from "@anocm/shared";
import React, { useEffect /*useState*/ } from "react";

interface AuthContextType {
  isAuth: boolean;
  setIsAuth: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export const useAuthContext = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuth, setIsAuth] = React.useState(false);
  const [user /*setUser*/] = React.useState<User | null>(null);
  const [loading /*setLoading*/] = React.useState(true);

  const value = React.useMemo(
    () => ({
      isAuth,
      setIsAuth,
      user,
      loading,
    }),
    [isAuth, user, loading],
  );

  useEffect(() => {}, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
