import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendsApi } from '../services/api/friends.api';
import { handleApiError, getErrorMessage } from '../services/error';

export const useFriends = () => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const navigate = useNavigate();

  // Fetch friends list
  const fetchFriends = useCallback(async (searchQuery = '') => {
    setLoading(true);
    setError('');

    try {
      const data = await friendsApi.getFriends(searchQuery);

      if (data.success) {
        setFriends(data.friends || []);
        return { success: true, friends: data.friends };
      } else {
        const errorMsg = data.message || 'Failed to fetch friends';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (error) {
      const appError = handleApiError(error);
      
      if (appError.statusCode === 401) {
        navigate('/login');
        return { success: false, message: 'Session expired' };
      }
      
      const errorMsg = getErrorMessage(appError);
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Fetch friend requests count
  const fetchFriendRequestsCount = useCallback(async () => {
    try {
      const data = await friendsApi.getFriendRequests();

      if (data.success) {
        const count = data.friendRequests?.length || 0;
        setFriendRequestsCount(count);
        return { success: true, count };
      }
      
      return { success: false };
    } catch (error) {
      console.error('Error fetching friend requests count:', error);
      return { success: false };
    }
  }, []);

  // Send friend request
  const sendFriendRequest = useCallback(async (toUserId) => {
    try {
      const data = await friendsApi.sendFriendRequest(toUserId);
      
      if (data.success) {
        return { success: true, message: data.message };
      }
      
      return { success: false, message: data.message || 'Failed to send friend request' };
    } catch (error) {
      const appError = handleApiError(error);
      return { success: false, message: getErrorMessage(appError) };
    }
  }, []);

  // Accept friend request
  const acceptFriendRequest = useCallback(async (fromUserId) => {
    try {
      const data = await friendsApi.acceptFriendRequest(fromUserId);
      
      if (data.success) {
        // Refresh friends list
        await fetchFriends();
        await fetchFriendRequestsCount();
        return { success: true, message: data.message };
      }
      
      return { success: false, message: data.message || 'Failed to accept friend request' };
    } catch (error) {
      const appError = handleApiError(error);
      return { success: false, message: getErrorMessage(appError) };
    }
  }, [fetchFriends, fetchFriendRequestsCount]);

  // Reject friend request
  const rejectFriendRequest = useCallback(async (fromUserId) => {
    try {
      const data = await friendsApi.rejectFriendRequest(fromUserId);
      
      if (data.success) {
        await fetchFriendRequestsCount();
        return { success: true, message: data.message };
      }
      
      return { success: false, message: data.message || 'Failed to reject friend request' };
    } catch (error) {
      const appError = handleApiError(error);
      return { success: false, message: getErrorMessage(appError) };
    }
  }, [fetchFriendRequestsCount]);

  // Remove friend
  const removeFriend = useCallback(async (friendId) => {
    try {
      const data = await friendsApi.removeFriend(friendId);
      
      if (data.success) {
        // Remove from local state
        setFriends(prev => prev.filter(f => f.profileId !== friendId));
        return { success: true, message: data.message };
      }
      
      return { success: false, message: data.message || 'Failed to remove friend' };
    } catch (error) {
      const appError = handleApiError(error);
      return { success: false, message: getErrorMessage(appError) };
    }
  }, []);

  // Update friend in list (for online status, etc.)
  const updateFriend = useCallback((friendId, updates) => {
    setFriends(prev => prev.map(friend =>
      friend.profileId === friendId ? { ...friend, ...updates } : friend
    ));
  }, []);

  // Move friend to top of list
  const moveFriendToTop = useCallback((friendId) => {
    setFriends(prev => {
      const friendIndex = prev.findIndex(f => f.profileId === friendId);
      if (friendIndex === -1 || friendIndex === 0) return prev;
      
      const reordered = [...prev];
      const [friend] = reordered.splice(friendIndex, 1);
      reordered.unshift({
        ...friend,
        lastMovedAt: Date.now(),
      });
      
      return reordered;
    });
  }, []);

  return {
    // State
    friends,
    loading,
    error,
    friendRequestsCount,
    setFriends,
    setError,
    
    // Actions
    fetchFriends,
    fetchFriendRequestsCount,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    updateFriend,
    moveFriendToTop,
  };
};
