import React from "react";
import "./styles.css";

export default function Carrinho() {
  return (
    <div className="carrinho-page">
      <div className="carrinho-header">
        <h1>Meu Carrinho</h1>
        <p>Esta página está em construção e será implementada em breve.</p>
      </div>
      <div className="carrinho-empty-state">
        <div className="carrinho-icon-wrapper">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
        </div>
        <h2>Seu carrinho está vazio</h2>
        <p>Adicione itens em outras páginas para vê-los aqui.</p>
      </div>
    </div>
  );
}
