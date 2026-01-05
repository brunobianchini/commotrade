import React, { useState } from 'react';
import { Hexagon, Lock, User, Briefcase } from 'lucide-react';
import { auth } from '../services/AuthService';
import { db } from '../services/DatabaseService';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('trader1');
  const [password, setPassword] = useState('pass');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (auth.login(username, password)) {
      onLoginSuccess();
    } else {
      setError('Invalid credentials');
    }
  };

  // For demo convenience, list available users
  const availableUsers = db.getUsers();

  return (
    <div className="flex min-h-screen bg-slate-950 items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="text-indigo-500 mb-4 animate-pulse">
            <Hexagon size={48} strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-white">CommoTrade Exchange</h1>
          <p className="text-slate-400 text-sm mt-1">Operational Access Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-600" size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-600" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-sm text-center">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
          >
            Authenticate
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2 font-semibold">AVAILABLE ROLES (pwd: 'pass'):</p>
            <div className="grid grid-cols-2 gap-2">
                {availableUsers.map(u => (
                    <button 
                        key={u.username}
                        onClick={() => setUsername(u.username)}
                        className="text-left text-xs p-2 rounded hover:bg-slate-800 text-slate-400 flex items-center gap-2"
                    >
                        <Briefcase size={12} />
                        <span className="truncate">{u.username} ({u.role})</span>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;