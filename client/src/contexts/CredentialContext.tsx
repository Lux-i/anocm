import React from "react";

export interface Credentials {
  username: string;
  password: string;
}

interface CredentialContextType {
  credentials: Credentials;
  setCredentials: React.Dispatch<React.SetStateAction<Credentials>>;
}

const CredentialContext = React.createContext<CredentialContextType | null>(
  null,
);

export const useCredentialContext = () => {
  const context = React.useContext(CredentialContext);
  if (!context) {
    throw new Error(
      "useCredentialContext must be used within a CredentialProvider",
    );
  }
  return context;
};

export const CredentialProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [credentials, setCredentials] = React.useState<Credentials>({
    username: "",
    password: "",
  });

  const value = React.useMemo(
    () => ({
      credentials: credentials,
      setCredentials,
    }),
    [credentials],
  );

  return (
    <CredentialContext.Provider value={value}>
      {children}
    </CredentialContext.Provider>
  );
};
