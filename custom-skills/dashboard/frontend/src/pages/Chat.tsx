import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth, getSessionToken } from '../contexts/AuthContext';

export function Chat() {
  const { isAdmin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setError('Admin access required');
      return;
    }

    const fetchTokenAndRedirect = async () => {
      try {
        setIsRedirecting(true);
        const sessionToken = getSessionToken();
        const response = await fetch('/api/chat/token', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get chat token');
        }

        const { data } = await response.json();

        // Redirect to gateway UI with token
        window.location.href = `https://carlitos-bot.com/__openclaw__/?token=${encodeURIComponent(data.token)}`;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsRedirecting(false);
      }
    };

    fetchTokenAndRedirect();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h1 className="text-xl font-semibold text-white">Access Denied</h1>
          <p className="text-gray-400">Admin access is required to use the chat.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h1 className="text-xl font-semibold text-white">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <h1 className="text-xl font-semibold text-white">Opening Chat</h1>
        <p className="text-gray-400">Redirecting to OpenClaw gateway...</p>
        {isRedirecting && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
            <ExternalLink className="w-4 h-4" />
            <span>carlitos-bot.com</span>
          </div>
        )}
      </div>
    </div>
  );
}
