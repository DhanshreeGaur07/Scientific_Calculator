import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

const BUTTONS = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "⌫", "="],
];

const BTN_TYPE = {
  C: "action",
  "±": "action",
  "%": "action",
  "÷": "op",
  "×": "op",
  "−": "op",
  "+": "op",
  "=": "equals",
  "⌫": "action",
  0: "zero",
};

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [showHistory, setShowHistory] = useState(true);

  // Check backend connectivity
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then(() => setBackendStatus("online"))
      .catch(() => setBackendStatus("offline"));
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // backend might be offline
    }
  };

  const handleButton = useCallback(
    async (btn) => {
      setError("");

      if (btn === "C") {
        setDisplay("0");
        setExpression("");
        return;
      }

      if (btn === "⌫") {
        if (expression.length <= 1) {
          setDisplay("0");
          setExpression("");
        } else {
          const newExpr = expression.slice(0, -1);
          setExpression(newExpr);
          setDisplay(newExpr || "0");
        }
        return;
      }

      if (btn === "±") {
        if (display !== "0") {
          const newExpr = expression.startsWith("-")
            ? expression.slice(1)
            : "-" + expression;
          setExpression(newExpr);
          setDisplay(newExpr);
        }
        return;
      }

      if (btn === "=") {
        if (!expression) return;
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/calculate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expression }),
          });
          const data = await res.json();
          if (data.error) {
            setError(data.error);
          } else {
            const resultStr = String(data.result);
            setDisplay(resultStr);
            setExpression(resultStr);
            fetchHistory();
          }
        } catch {
          setError("Backend offline — check Python server");
        } finally {
          setLoading(false);
        }
        return;
      }

      // Map display symbols to operators
      const opMap = { "÷": "/", "×": "*", "−": "-" };
      const char = opMap[btn] || btn;

      const newExpr = expression + char;
      setExpression(newExpr);
      setDisplay(newExpr);
    },
    [expression, display]
  );

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      const keyMap = {
        Enter: "=",
        Backspace: "⌫",
        Escape: "C",
        "/": "÷",
        "*": "×",
        "-": "−",
      };
      const btn = keyMap[e.key] || e.key;
      const valid = BUTTONS.flat();
      if (valid.includes(btn)) {
        e.preventDefault();
        handleButton(btn);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleButton]);

  const clearHistory = async () => {
    await fetch(`${API_BASE}/history`, { method: "DELETE" });
    setHistory([]);
  };

  const deleteEntry = async (id) => {
    await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
    setHistory((h) => h.filter((e) => e.id !== id));
  };

  const reuseEntry = (entry) => {
    setExpression(String(entry.result));
    setDisplay(String(entry.result));
  };

  return (
    <div style={styles.root}>
      <div style={styles.appTitle}>
        <span style={styles.titleDot} />
        Calculator
        <span style={styles.statusPill(backendStatus)}>
          {backendStatus === "online" ? "●" : "○"} {backendStatus}
        </span>
      </div>

      <div style={styles.layout}>
        {/* Calculator */}
        <div style={styles.calcCard}>
          {/* Display */}
          <div style={styles.display}>
            <div style={styles.exprLine}>{expression || "0"}</div>
            <div style={styles.resultLine}>
              {loading ? "…" : error ? "ERR" : display}
            </div>
            {error && <div style={styles.errorMsg}>{error}</div>}
          </div>

          {/* Buttons */}
          <div style={styles.grid}>
            {BUTTONS.flat().map((btn, i) => {
              const type = BTN_TYPE[btn] || "num";
              return (
                <button
                  key={i}
                  onClick={() => handleButton(btn)}
                  style={styles.btn(type, btn === "0")}
                >
                  {btn}
                </button>
              );
            })}
          </div>
        </div>

        {/* History Panel */}
        <div style={styles.historyCard}>
          <div style={styles.historyHeader}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>History</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowHistory((v) => !v)}
                style={styles.iconBtn}
                title="Toggle"
              >
                {showHistory ? "▲" : "▼"}
              </button>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  style={{ ...styles.iconBtn, color: "#E24B4A" }}
                  title="Clear all"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {showHistory && (
            <div style={styles.historyList}>
              {history.length === 0 ? (
                <div style={styles.emptyHistory}>No calculations yet</div>
              ) : (
                history.map((entry) => (
                  <div key={entry.id} style={styles.historyItem}>
                    <div
                      style={styles.historyExpr}
                      onClick={() => reuseEntry(entry)}
                      title="Click to reuse result"
                    >
                      <span style={styles.historyExpression}>
                        {entry.expression}
                      </span>
                      <span style={styles.historyEquals}>=</span>
                      <span style={styles.historyResult}>{entry.result}</span>
                    </div>
                    <div style={styles.historyMeta}>
                      <span style={styles.historyTime}>{entry.timestamp}</span>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        style={styles.deleteBtn}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.hint}>
        Keyboard supported · Click history entries to reuse results
      </div>
    </div>
  );
}

const styles = {
  root: {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    minHeight: "100vh",
    background: "#0f0f11",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    color: "#f0ede8",
  },
  appTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.5px",
    marginBottom: "1.5rem",
    color: "#f0ede8",
  },
  titleDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#EF9F27",
    display: "inline-block",
  },
  statusPill: (status) => ({
    fontSize: 11,
    padding: "3px 10px",
    borderRadius: 99,
    background: status === "online" ? "#1D9E7522" : "#E24B4A22",
    color: status === "online" ? "#5DCAA5" : "#F09595",
    border: `1px solid ${status === "online" ? "#1D9E7544" : "#E24B4A44"}`,
    fontWeight: 400,
  }),
  layout: {
    display: "flex",
    gap: "1.5rem",
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  calcCard: {
    background: "#1a1a1f",
    borderRadius: 20,
    border: "1px solid #2e2e38",
    overflow: "hidden",
    width: 320,
    boxShadow: "0 4px 40px #00000060",
  },
  display: {
    padding: "1.5rem 1.25rem 1rem",
    minHeight: 110,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    background: "#13131a",
    borderBottom: "1px solid #2e2e38",
  },
  exprLine: {
    fontSize: 13,
    color: "#888780",
    minHeight: 18,
    textAlign: "right",
    letterSpacing: "0.5px",
    wordBreak: "break-all",
  },
  resultLine: {
    fontSize: 36,
    fontWeight: 700,
    textAlign: "right",
    color: "#f0ede8",
    lineHeight: 1.1,
    letterSpacing: "-1px",
    wordBreak: "break-all",
  },
  errorMsg: {
    fontSize: 11,
    color: "#F09595",
    textAlign: "right",
    marginTop: 4,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,
    background: "#2e2e38",
  },
  btn: (type, isZero) => ({
    gridColumn: isZero ? "span 2" : undefined,
    padding: "18px 8px",
    fontSize: 16,
    fontWeight: type === "num" || type === "zero" ? 400 : 600,
    fontFamily: "inherit",
    background:
      type === "equals"
        ? "#EF9F27"
        : type === "op"
        ? "#2a2a35"
        : type === "action"
        ? "#222230"
        : "#1a1a1f",
    color:
      type === "equals"
        ? "#0f0f11"
        : type === "op"
        ? "#EF9F27"
        : type === "action"
        ? "#9FE1CB"
        : "#f0ede8",
    border: "none",
    cursor: "pointer",
    transition: "filter 0.1s",
    letterSpacing: type === "equals" ? "0" : "0",
  }),
  historyCard: {
    background: "#1a1a1f",
    borderRadius: 20,
    border: "1px solid #2e2e38",
    width: 280,
    maxHeight: 480,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 4px 40px #00000060",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid #2e2e38",
    background: "#13131a",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "#888780",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "inherit",
    padding: "2px 6px",
  },
  historyList: {
    overflowY: "auto",
    flex: 1,
  },
  emptyHistory: {
    color: "#444441",
    textAlign: "center",
    padding: "2rem 1rem",
    fontSize: 13,
  },
  historyItem: {
    padding: "10px 16px",
    borderBottom: "1px solid #2e2e3820",
    cursor: "default",
  },
  historyExpr: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    cursor: "pointer",
  },
  historyExpression: {
    fontSize: 13,
    color: "#888780",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  historyEquals: {
    fontSize: 12,
    color: "#444441",
  },
  historyResult: {
    fontSize: 15,
    fontWeight: 600,
    color: "#EF9F27",
  },
  historyMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  historyTime: {
    fontSize: 10,
    color: "#444441",
  },
  deleteBtn: {
    background: "none",
    border: "none",
    color: "#444441",
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "inherit",
    padding: 0,
  },
  hint: {
    marginTop: "1.25rem",
    fontSize: 11,
    color: "#444441",
    letterSpacing: "0.3px",
  },
};
