import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, ExternalLink, CheckCircle } from 'lucide-react';
import { useAuth, getSessionToken } from '../contexts/AuthContext';

export function Chat() {
  const { isAdmin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gatewayToken, setGatewayToken] = useState<string | null>(null);

  const openChat = useCallback((token: string) => {
    // Explicitly set session=agent:main to avoid gateway adding suffix (agent:main:main)
    window.open(`https://carlitos-bot.com/__openclaw__/chat?token=${encodeURIComponent(token)}&session=agent:main`, '_blank');
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setError('Admin access required');
      setIsLoading(false);
      return;
    }

    const fetchTokenAndOpen = async () => {
      try {
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
        setGatewayToken(data.token);
        openChat(data.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenAndOpen();
  }, [isAdmin, openChat]);

  if (!isAdmin) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
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
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h1 className="text-xl font-semibold text-white">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <h1 className="text-xl font-semibold text-white">Opening Chat</h1>
          <p className="text-gray-400">Getting access token...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
        <CheckCircle className="w-12 h-12 text-green-500" />
        <h1 className="text-xl font-semibold text-white">Chat Opened</h1>
        <p className="text-gray-400">
          The OpenClaw chat has been opened in a new tab. You can close this page or keep it open to return to the dashboard.
        </p>
        {gatewayToken && (
          <button
            onClick={() => openChat(gatewayToken)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mt-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open Chat Again
          </button>
        )}
      </div>
    </div>
  );
}
