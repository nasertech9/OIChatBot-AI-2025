
import React, { useState } from 'react';

interface AuthProps {
  onAuth: (username: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Username and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setError('');

    if (isLogin) {
      // Mock login: check if user exists in localStorage
      const users = JSON.parse(localStorage.getItem('oi_chat_users') || '{}');
      if (users[username] && users[username] === password) {
        onAuth(username);
      } else {
        setError('Invalid username or password.');
      }
    } else {
      // Mock signup: add user to localStorage
      const users = JSON.parse(localStorage.getItem('oi_chat_users') || '{}');
      if (users[username]) {
        setError('Username already exists.');
      } else {
        users[username] = password;
        localStorage.setItem('oi_chat_users', JSON.stringify(users));
        onAuth(username);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat" style={{backgroundImage: "url('https://picsum.photos/1920/1080?blur=5')"}}>
      <div className="w-full max-w-md p-8 space-y-8 bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-wider">OIChatBot AI</h1>
          <p className="mt-2 text-cyan-300 text-lg">{isLogin ? 'Welcome Back' : 'Create Your Account'}</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-500 bg-black/40 text-white placeholder-gray-400 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 focus:z-10 sm:text-sm rounded-t-md"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-500 bg-black/40 text-white placeholder-gray-400 focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 focus:z-10 sm:text-sm rounded-b-md"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 focus:ring-offset-gray-900 transition-all duration-300 shadow-[0_0_15px_rgba(0,255,255,0.6)] hover:shadow-[0_0_25px_rgba(0,255,255,0.8)]"
            >
              {isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-sm text-gray-300">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-medium text-cyan-400 hover:text-cyan-300 ml-2">
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
