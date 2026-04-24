import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 24 }}>
      <h1>Portal de Excecoes</h1>
      <p>Fundacao inicial criada conforme o metodo de execucao.</p>
      <ul>
        <li>Login JWT: pendente de tela</li>
        <li>Pedidos e excecoes: API base pronta</li>
        <li>Worker e ERP mock: servicos provisionados</li>
      </ul>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
