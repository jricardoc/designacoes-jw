import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, check, Info, Check } from 'lucide-react';
import './ConfirmModal.css';

/**
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {function} onConfirm
 * @param {string} title
 * @param {string} message
 * @param {string} type - 'danger' | 'warning' | 'info' | 'success'
 * @param {boolean} showInput - se deve mostrar input de texto
 * @param {string} inputPlaceholder
 * @param {string} confirmText
 * @param {string} cancelText
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  showInput = false,
  inputPlaceholder = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}) {
  const [inputValue, setInputValue] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setInputValue('');
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  const handleConfirm = () => {
    onConfirm(showInput ? inputValue : undefined);
  };

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertTriangle size={24} className="modal-icon danger" />;
      case 'warning': return <AlertTriangle size={24} className="modal-icon warning" />;
      case 'success': return <Check size={24} className="modal-icon success" />;
      default: return <Info size={24} className="modal-icon info" />;
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`}>
      <div className="modal-backdrop" onClick={onClose} />
      
      <div className={`modal-content ${isOpen ? 'open' : ''}`}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-header">
          <div className={`modal-icon-wrapper ${type}`}>
            {getIcon()}
          </div>
          <h3 className="modal-title">{title}</h3>
        </div>

        <div className="modal-body">
          <p className="modal-message">{message}</p>
          
          {showInput && (
            <div className="modal-input-wrapper">
              <input
                type="text"
                className="modal-input"
                placeholder={inputPlaceholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button 
            className={`modal-btn confirm ${type}`}
            onClick={handleConfirm}
            disabled={showInput && !inputValue.trim()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
