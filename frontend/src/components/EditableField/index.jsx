import React, { useState, useEffect, useRef } from "react";
import "./styles.css";

export default function EditableField({ value, onSave, fallback = "-", fieldName, className = "", options = null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || "");
  const inputRef = useRef(null);

  useEffect(() => {
    setTempValue(value || "");
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setTempValue(value || "");
      setIsEditing(false);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    if (tempValue.trim() !== (value || "").trim()) {
      onSave(fieldName, tempValue.trim());
    }
  };

  if (isEditing) {
    if (options) {
      return (
        <select
          ref={inputRef}
          className={`editable-input ${className}`}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
        >
          <option value="">Selecione...</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        ref={inputRef}
        type="text"
        className={`editable-input ${className}`}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <span 
      className={`editable-text ${className}`} 
      onDoubleClick={handleDoubleClick}
      title="Dê um duplo clique para editar"
    >
      {value || fallback}
    </span>
  );
}
