/**
 * NotificationManager — ONE notification at a time with queue.
 * Fixes the double-popup issue. Import this + useNotifications hook.
 *
 * Usage in Dashboard:
 *   import { NotificationManager, useNotifications } from "./NotificationManager";
 *   const { addNotification } = useNotifications();
 *   addNotification({ severity:"HIGH", title:"SG Changed", detail:"port 22 opened" });
 */
import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";

const SEV = {
    CRITICAL: { color: "#ef4444", icon: "🚨", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)" },
    HIGH: { color: "#f97316", icon: "⚠️", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)" },
    MEDIUM: { color: "#f59e0b", icon: "🔶", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" },
    LOW: { color: "#22c55e", icon: "ℹ️", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)" },
};

const NotifCtx = createContext({ addNotification: () => { } });
export const useNotifications = () => useContext(NotifCtx);

export function NotificationProvider({ children }) {
    const [queue, setQueue] = useState([]);
    const [current, setCurrent] = useState(null);
    const timerRef = useRef(null);

    const dismiss = useCallback(() => {
        clearTimeout(timerRef.current);
        setCurrent(null);
    }, []);

    // Pop next from queue whenever current is empty
    useEffect(() => {
        if (!current && queue.length > 0) {
            const [next, ...rest] = queue;
            setQueue(rest);
            setCurrent(next);
            timerRef.current = setTimeout(() => setCurrent(null),
                next.severity === "CRITICAL" ? 8000 : 5000);
        }
    }, [current, queue]);

    const addNotification = useCallback((notif) => {
        const entry = { ...notif, id: Date.now() + Math.random() };
        setQueue(prev => {
            // Deduplicate: skip if same event_name is already queued
            if (prev.some(n => n.title === entry.title && n.detail === entry.detail)) return prev;
            return [...prev, entry];
        });
    }, []);

    return (
        <NotifCtx.Provider value={{ addNotification }}>
            {children}
            {/* Single notification toast */}
            {current && (
                <div style={{
                    position: "fixed", top: 20, right: 20, zIndex: 9999,
                    width: 340, maxWidth: "calc(100vw - 40px)",
                    background: SEV[current.severity]?.bg || "rgba(255,255,255,0.1)",
                    border: `1px solid ${SEV[current.severity]?.border || "#333"}`,
                    borderLeft: `4px solid ${SEV[current.severity]?.color || "#fff"}`,
                    borderRadius: 12, padding: "14px 16px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    animation: "slideIn 0.3s ease",
                }}>
                    <style>{`
            @keyframes slideIn { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
          `}</style>

                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 16 }}>{SEV[current.severity]?.icon}</span>
                        <span style={{
                            fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                            color: SEV[current.severity]?.color, letterSpacing: "0.06em"
                        }}>
                            {current.severity}
                        </span>
                        {/* Queue count badge */}
                        {queue.length > 0 && (
                            <span style={{
                                marginLeft: "auto", background: "rgba(255,255,255,0.1)",
                                borderRadius: 99, fontSize: 10, padding: "1px 7px",
                                color: "#8ab4c4", fontFamily: "monospace",
                            }}>+{queue.length} more</span>
                        )}
                        <button onClick={dismiss} style={{
                            marginLeft: queue.length > 0 ? 4 : "auto",
                            background: "none", border: "none", color: "#4a6a7a",
                            fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1,
                        }}>✕</button>
                    </div>

                    {/* Content */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 3 }}>
                        {current.title}
                    </div>
                    {current.detail && (
                        <div style={{ fontSize: 12, color: "#6a9ab0", lineHeight: 1.5 }}>
                            {current.detail}
                        </div>
                    )}
                    {(current.region || current.user) && (
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            {current.region && (
                                <span style={{
                                    fontSize: 10, background: "rgba(255,255,255,0.06)",
                                    borderRadius: 4, padding: "2px 7px",
                                    color: "#4a8a9a", fontFamily: "monospace"
                                }}>
                                    {current.region}
                                </span>
                            )}
                            {current.user && (
                                <span style={{
                                    fontSize: 10, background: "rgba(255,255,255,0.06)",
                                    borderRadius: 4, padding: "2px 7px",
                                    color: "#4a7a8a", fontFamily: "monospace"
                                }}>
                                    {current.user}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Progress bar */}
                    <div style={{ marginTop: 10, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1 }}>
                        <div style={{
                            height: "100%", borderRadius: 1,
                            background: SEV[current.severity]?.color || "#00d4aa",
                            animation: `shrink ${current.severity === "CRITICAL" ? 8 : 5}s linear forwards`,
                        }} />
                    </div>
                    <style>{`
            @keyframes shrink { from { width:100%; } to { width:0%; } }
          `}</style>
                </div>
            )}
        </NotifCtx.Provider>
    );
}

export default NotificationProvider;
