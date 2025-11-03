
import React, { useState, useEffect, useCallback } from 'react';
import type { User } from './types';
import Auth from './components/Auth';
import ChatComponent from './components/Chat';

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
    
    // Check for logged-in user
    const savedUser = localStorage.getItem('oi_chat_currentUser');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const handleAuth = (username: string) => {
    const user: User = { username };
    setCurrentUser(user);
    localStorage.setItem('oi_chat_currentUser', JSON.stringify(user));
  };
  
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('oi_chat_currentUser');
  };

  return (
    <div className="font-sans antialiased text-gray-900 dark:text-gray-100">
      {currentUser ? (
        <ChatComponent user={currentUser} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      ) : (
        <Auth onAuth={handleAuth} />
      )}
    </div>
  );
};

export default App;
