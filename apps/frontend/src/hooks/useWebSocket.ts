import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

export function useWebSocket(): void {
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken || !user) return;

    const socket = io(import.meta.env.VITE_WS_URL ?? '/notifications', {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: '/notifications/socket.io',
    });

    socket.on('manifeste.submitted', (data: { vol_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['manifestes', user.base_id] });
      toast.info(`Nouveau manifeste soumis — Vol ${data.vol_id}`);
    });

    socket.on('manifeste.step_validated', (data: { manifeste_id: string; etape: string }) => {
      queryClient.invalidateQueries({ queryKey: ['manifeste', data.manifeste_id] });
      toast.success(`Étape ${data.etape} validée`);
    });

    socket.on('manifeste.step_rejected', (data: { manifeste_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['manifeste', data.manifeste_id] });
      toast.error('Manifeste rejeté — correction requise');
    });

    socket.on('alert.evasan', () => {
      toast.error('⚠️ URGENCE EVASAN — Manifeste en attente de traitement immédiat', {
        duration: 0,
      });
    });

    socket.on('alert.vip_detected', () => {
      toast.warning('VIP détecté — Circuit de validation accéléré activé', { duration: 0 });
    });

    socket.on('alert.dangerous_goods', () => {
      toast.warning('Marchandise dangereuse déclarée — Validation COMGMO requise');
    });

    socket.on('cemaa.consigne_updated', (data: { manifeste_id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['manifeste', data.manifeste_id] });
      toast.warning('Consigne CEMAA mise à jour sur ce manifeste');
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [accessToken, user, queryClient]);
}
