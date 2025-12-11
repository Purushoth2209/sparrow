/**
 * useSync Hook
 * 
 * Handles message synchronization on app open and reconnect.
 * Integrates with sync service to fetch and merge messages.
 */

import { useEffect, useCallback, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useChatStore } from '../store/chat.store';
import { syncAndMerge, getSyncStatus } from '../services/sync.service';

/**
 * Hook to manage message synchronization
 * 
 * @param {Object} options - Sync options
 * @param {boolean} options.syncOnMount - Sync when component mounts (default: true)
 * @param {boolean} options.syncOnReconnect - Sync when socket reconnects (default: true)
 * @returns {Object} Sync state and controls
 */
export const useSync = (options = {}) => {
  const { isConnected } = useSocket();
  const { mergeMessages } = useChatStore();
  const { syncOnMount = true, syncOnReconnect = true } = options;
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Perform sync
  const performSync = useCallback(async (forceFullSync = false) => {
    if (isSyncing) {
      return; // Already syncing
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await syncAndMerge(
        { forceFullSync },
        mergeMessages
      );

      if (result.success) {
        setLastSync(new Date(result.syncTimestamp));
        return { success: true, ...result };
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncError(error.message || 'Sync failed');
      return { success: false, error: error.message };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, mergeMessages]);

  // Load sync status on mount
  useEffect(() => {
    getSyncStatus().then(status => {
      setLastSync(status.lastSyncDate);
    });
  }, []);

  // Sync on mount
  useEffect(() => {
    if (syncOnMount) {
      performSync().catch(error => {
        console.error('Initial sync error:', error);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync on reconnect
  useEffect(() => {
    if (syncOnReconnect && isConnected) {
      performSync().catch(error => {
        console.error('Reconnect sync error:', error);
      });
    }
  }, [isConnected, syncOnReconnect, performSync]);

  return {
    isSyncing,
    lastSync,
    syncError,
    performSync,
    getSyncStatus: () => getSyncStatus().then(status => {
      setLastSync(status.lastSyncDate);
      return status;
    }),
  };
};

