/**
 * App.jsx — Root component
 * Wraps the whole app in NotificationProvider so any component
 * can call addNotification() without passing props down manually.
 */
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
