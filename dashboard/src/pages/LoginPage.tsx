import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';

export default function LoginPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return <div className="p-4 flex justify-center items-center h-full">Loading...</div>;
  if (user) return <Navigate to="/sessions" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error: authError } = isSignUp 
      ? await signUp(email, password)
      : await signIn(email, password);

    if (authError) {
      setError(authError.message);
    } else if (isSignUp) {
      setError("Success! If email confirmations are on, check your inbox.");
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow-sm border border-gray-200 rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
        {isSignUp ? 'Create Account' : 'Sign In'}
      </h2>
      
      {error && (
        <div className={`p-3 mb-4 rounded text-sm ${error.startsWith('Success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
          <input 
            type="email" 
            required 
            className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700">Password</label>
          <input 
            type="password" 
            required 
            className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-medium p-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button 
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
          className="text-blue-600 hover:underline text-sm font-medium"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
