
import { createRoot } from "react-dom/client";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import App from "./App.tsx";
import "./index.css";
import MyWalletProvider from "./components/my-wallet-provider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";


createRoot(document.getElementById("root")!).render(
  <MyWalletProvider>
    <AuthProvider>
      <App />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </AuthProvider>
  </MyWalletProvider >
);
