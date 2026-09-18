import { useState, useEffect, useRef } from 'react';
import authAPI from '../services/authAPI';

/**
 * Custom React hook to check whether a username is available or already taken.
 * 
 * @param {string} username - The username to check.
 * @param {number} delay - Debounce delay in milliseconds (default 350ms).
 * @returns {object} { status, exists, message, isChecking, isAvailable, isTaken }
 */
export function useUsernameCheck(username, delay = 350) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'taken'
  const [exists, setExists] = useState(null);
  const [message, setMessage] = useState('');
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const trimmed = (username || '').trim();

    if (!trimmed) {
      setStatus('idle');
      setExists(null);
      setMessage('');
      return;
    }

    if (trimmed.length < 3) {
      setStatus('idle');
      setExists(null);
      setMessage('');
      return;
    }

    setStatus('checking');
    setMessage('Checking availability...');

    const currentRequestId = ++latestRequestRef.current;

    const timer = setTimeout(async () => {
      try {
        const data = await authAPI.checkUsername(trimmed);
        if (latestRequestRef.current === currentRequestId) {
          if (data.exists) {
            setStatus('taken');
            setExists(true);
            setMessage('Username is already taken. Please choose another username.');
          } else {
            setStatus('available');
            setExists(false);
            setMessage('Username is available.');
          }
        }
      } catch (err) {
        if (latestRequestRef.current === currentRequestId) {
          setStatus('idle');
          setExists(null);
          setMessage('');
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [username, delay]);

  return {
    status,
    exists,
    message,
    isChecking: status === 'checking',
    isAvailable: status === 'available',
    isTaken: status === 'taken'
  };
}

export default useUsernameCheck;
