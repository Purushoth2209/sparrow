/**
 * Queue Processor Setup Component
 * 
 * Initializes the queue processor and sync service when the app loads.
 * This component should be mounted once at the app root.
 */

import { useQueueProcessor } from '../../hooks/useQueueProcessor';
import { useSync } from '../../hooks/useSync';

export const QueueProcessorSetup = () => {
  // Initialize queue processor
  useQueueProcessor({
    processingInterval: 5000, // Check queue every 5 seconds
  });

  // Initialize sync service
  useSync({
    syncOnMount: true, // Sync when app opens
    syncOnReconnect: true, // Sync when socket reconnects
  });

  // This component doesn't render anything
  return null;
};

