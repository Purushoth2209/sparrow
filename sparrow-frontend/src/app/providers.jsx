import React from 'react';
import { SocketProvider } from '../contexts/SocketContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { AuthProvider } from '../store/auth.store';
import { ChatProvider } from '../store/chat.store';
import { ConversationProvider } from '../store/conversation.store';
import { ToastProvider } from '../contexts/ToastContext';
import { SocketHandlersSetup } from '../components/common/SocketHandlersSetup';
import { QueueProcessorSetup } from '../components/common/QueueProcessorSetup';

export const AppProviders = ({ children }) => {
  return (
    <SocketProvider>
      <AuthProvider>
        <NotificationProvider>
          <ChatProvider>
            <ConversationProvider>
              <ToastProvider>
                <SocketHandlersSetup />
                <QueueProcessorSetup />
                {children}
              </ToastProvider>
            </ConversationProvider>
          </ChatProvider>
        </NotificationProvider>
      </AuthProvider>
    </SocketProvider>
  );
};

