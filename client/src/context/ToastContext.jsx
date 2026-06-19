import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const tid = useRef(null);

  const toast = useCallback((text) => {
    setMsg(text);
    setVisible(true);
    clearTimeout(tid.current);
    tid.current = setTimeout(() => setVisible(false), 2600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast-wrap ${visible ? 'show' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#5fe3a3" strokeWidth="2.5" width="16" height="16">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
