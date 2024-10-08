import React, { createContext, useState, useContext, useEffect, Dispatch, SetStateAction } from 'react';

// Define the shape of the context
interface AuthContextType {
  token: string | null;
  setToken: Dispatch<SetStateAction<string | null>>;
}

// Provide the initial context with the appropriate types
const AuthContext = createContext<AuthContextType>({
  token: null, // initial value for token
  setToken: () => {}, // empty setter function for now
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);

  // Login function
  const login = async () => {
    try {
      const response = await fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: "testuser10",
          password: "password12345"
        }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      return data.token; // Assuming your backend returns a token field
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Fetch token on component mount
  useEffect(() => {
    login().then(fetchedToken => {
      if (fetchedToken) {
        setToken(fetchedToken);
        console.log('authProviderToken: ' + fetchedToken);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ token, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};
