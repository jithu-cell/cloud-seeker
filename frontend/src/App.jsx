import "./styles/global.css";
import Dashboard from "./components/Dashboard";
import { NotificationProvider } from "./components/NotificationManager";

export default function App() {
  return (
    <NotificationProvider>
      <Dashboard />
    </NotificationProvider>
  );
}