import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:5000";

// ── helpers ──────────────────────────────────────────────────────────────────
const isDigit    = (b) => /^[0-9.]$/.test(b);
const isOperator = (b) => ["+", "−", "×", "÷"].includes(b);

// ── button layout ─────────────────────────────────────────────────────────────
const SCI_ROW1 = ["sin", "cos", "tan", "log", "ln"];
const SCI_ROW2 = ["sin⁻¹", "cos⁻¹", "tan⁻¹", "10ˣ", "eˣ"];
const MEM_ROW  = ["MC", "MR", "M+", "M−", "x²", "√", "π", "e", "(", ")"];
const MAIN_BTNS = [
  ["C", "±", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  [".", "0", "⌫", "="],
];

export default function Calculator() {
  // ── state ────────────────────────────────────────────────────────────────
  const [display,    setDisplay]    = useState("0");
  const [expression, setExpression] = useState("");
  const [isResult,   setIsResult]   = useState(false);
  const [history,    setHistory]    = useState([]);
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [backendOk,  setBackendOk]  = useState(null);
  const [angleMode,  setAngleMode]  = useState("deg");
  const [shiftMode,  setShiftMode]  = useState(false);
  const [memory,     setMemory]     = useState(0);
  const [showHist,   setShowHist]   = useState(true);
  const [parenDepth, setParenDepth] = useState(0);

  // ── backend health + history ──────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res  = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch { /* backend offline */ }
  };

  // ── expression validator ──────────────────────────────────────────────────
  const validateExpr = (expr) => {
    const open  = (expr.match(/\(/g) || []).length;
    const close = (expr.match(/\)/g) || []).length;
    if (open !== close) return "Unmatched parentheses";
    if (/[+\-*/]{2,}/.test(expr)) return "Double operator";
    return null;
  };

  // ── memory operations ─────────────────────────────────────────────────────
  const handleMemory = (op) => {
    const cur = parseFloat(display) || 0;
    if (op === "MC")  { setMemory(0); return; }
    if (op === "MR")  { setDisplay(String(memory)); setExpression(String(memory)); return; }
    if (op === "M+")  { setMemory((m) => m + cur); return; }
    if (op === "M−")  { setMemory((m) => m - cur); return; }
  };

  // ── main button handler ───────────────────────────────────────────────────
  const handleButton = useCallback(async (btn) => {
    setError("");

    // memory
    if (["MC", "MR", "M+", "M−"].includes(btn)) { handleMemory(btn); return; }

    // angle mode
    if (["deg", "rad", "grad"].includes(btn)) { setAngleMode(btn); return; }

    // shift toggle
    if (btn === "SHIFT") { setShiftMode((s) => !s); return; }

    // clear
    if (btn === "C") {
      setDisplay("0"); setExpression(""); setIsResult(false); setParenDepth(0); return;
    }

    // backspace
    if (btn === "⌫") {
      const newExpr = expression.slice(0, -1);
      setExpression(newExpr); setDisplay(newExpr || "0"); setIsResult(false); return;
    }

    // negate
    if (btn === "±") {
      const toggled = display.startsWith("-") ? display.slice(1) : "-" + display;
      setDisplay(toggled); setExpression(toggled); return;
    }

    // smart parentheses
    if (btn === "( )") {
      if (parenDepth === 0 || isOperator(expression.slice(-1))) {
        setExpression((e) => e + "("); setDisplay((d) => d + "(");
        setParenDepth((p) => p + 1);
      } else {
        setExpression((e) => e + ")"); setDisplay((d) => d + ")");
        setParenDepth((p) => p - 1);
      }
      return;
    }

    // x² — wrap current expression
    if (btn === "x²") {
      const base    = expression || "0";
      const wrapped = `(${base})**2`;
      setExpression(wrapped); setDisplay(wrapped); setIsResult(false); return;
    }

    // √ — wrap current expression
    if (btn === "√") {
      const base    = expression || "0";
      const wrapped = `sqrt(${base})`;
      setExpression(wrapped); setDisplay(wrapped); setIsResult(false); return;
    }

    // π and e constants
    if (btn === "π" || btn === "e") {
      const char    = btn === "π" ? "pi" : "e";
      const newExpr = (isResult ? "" : expression) + char;
      setExpression(newExpr); setDisplay(newExpr); setIsResult(false); return;
    }

    // scientific functions — append function call prefix
    const sciFnMap = {
      "sin":   "sin(",  "cos":   "cos(",  "tan":   "tan(",
      "log":   "log(",  "ln":    "ln(",
      "sin⁻¹": "asin(", "cos⁻¹": "acos(", "tan⁻¹": "atan(",
      "10ˣ":  "10**(", "eˣ":   "e**(",
    };
    if (btn in sciFnMap) {
      const newExpr = (isResult ? "" : expression) + sciFnMap[btn];
      setExpression(newExpr); setDisplay(newExpr);
      setIsResult(false); setShiftMode(false); return;
    }

    // isResult guard — digit after = starts fresh
    if (isResult && isDigit(btn)) {
      setExpression(btn); setDisplay(btn); setIsResult(false); return;
    }
    if (isResult && isOperator(btn)) {
      setIsResult(false); // fall through — chain off result
    }

    // EQUALS — send to backend
    if (btn === "=") {
      if (!expression) return;
      const valErr = validateExpr(expression);
      if (valErr) { setError(valErr); return; }
      setLoading(true);
      try {
        const res  = await fetch(`${API_BASE}/calculate`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ expression, angle_mode: angleMode }),
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          const r = String(data.result);
          setDisplay(r); setExpression(r); setIsResult(true);
          fetchHistory();
        }
      } catch {
        setError("Backend offline — run calculator_backend.py");
      } finally {
        setLoading(false);
      }
      return;
    }

    // operators / digits / decimal / percent
    const opMap   = { "÷": "/", "×": "*", "−": "-" };
    const char    = opMap[btn] || btn;
    const newExpr = expression + char;
    setExpression(newExpr); setDisplay(newExpr); setIsResult(false);
  }, [expression, display, isResult, angleMode, parenDepth, memory]);

  // ── keyboard support ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = {
      Enter: "=", Backspace: "⌫", Escape: "C",
      "/": "÷", "*": "×", "-": "−", p: "π",
    };
    const handler = (e) => {
      const btn   = map[e.key] || e.key;
      const valid = [
        ...SCI_ROW1, ...SCI_ROW2, ...MEM_ROW,
        ...MAIN_BTNS.flat(), "÷", "×", "−",
      ];
      if (valid.includes(btn)) { e.preventDefault(); handleButton(btn); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleButton]);

  // ── history helpers ──────────────────────────────────────────────────────
  const clearHistory = async () => {
    await fetch(`${API_BASE}/history`, { method: "DELETE" });
    setHistory([]);
  };
  const deleteEntry = async (id) => {
    await fetch(`${API_BASE}/history/${id}`, { method: "DELETE" });
    setHistory((h) => h.filter((e) => e.id !== id));
  };
  const reuseResult = (entry) => {
    setExpression(String(entry.result));
    setDisplay(String(entry.result));
    setIsResult(true);
  };

  // ── btn style picker ─────────────────────────────────────────────────────
  const btnStyle = (btn) => {
    if (btn === "=")                                       return s.btnEquals;
    if (["÷","×","−","+"].includes(btn))                   return s.btnOp;
    if (["C","±","%"].includes(btn))                       return s.btnAction;
    return s.btnNum;
  };

  const statusColor = backendOk === null ? "#888" : backendOk ? "#5DCAA5" : "#E24B4A";
  const statusLabel = backendOk === null ? "checking" : backendOk ? "online" : "offline";

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      {/* header */}
      <div style={s.header}>
        <span style={s.logo}>∑ Calc</span>
        <span style={{ ...s.statusDot, color: statusColor }}>● {statusLabel}</span>
      </div>

      <div style={s.layout}>

        {/* ── CALCULATOR CARD ── */}
        <div style={s.calcPanel}>

          {/* angle mode + 2nd key */}
          <div style={s.modeRow}>
            {["deg","rad","grad"].map((m) => (
              <button key={m} onClick={() => setAngleMode(m)}
                style={{ ...s.modeBtn, ...(angleMode === m ? s.modeBtnOn : {}) }}>
                {m}
              </button>
            ))}
            <button
              onClick={() => setShiftMode((x) => !x)}
              style={{ ...s.modeBtn, marginLeft:"auto", ...(shiftMode ? s.shiftOn : {}) }}>
              Shift
            </button>
          </div>

          {/* display */}
          <div style={s.display}>
            {memory !== 0 && <div style={s.memIndicator}>M = {memory}</div>}
            <div style={s.exprLine}>{expression || "0"}</div>
            <div style={s.resultLine}>
              {loading
                ? "…"
                : error
                  ? <span style={{ color:"#F09595", fontSize:18 }}>{error}</span>
                  : display}
            </div>
            {parenDepth > 0 && (
              <div style={s.parenHint}>{")".repeat(parenDepth)} still needed</div>
            )}
          </div>

          {/* scientific row — swaps on 2nd */}
          <div style={s.sciGrid}>
            {(shiftMode ? SCI_ROW2 : SCI_ROW1).map((fn) => (
              <button key={fn} onClick={() => handleButton(fn)} style={s.btnSci}>{fn}</button>
            ))}
          </div>

          {/* memory + extras row */}
          <div style={s.memGrid}>
            {MEM_ROW.map((btn) => (
              <button key={btn} onClick={() => handleButton(btn)} style={s.btnMem}>{btn}</button>
            ))}
          </div>

          {/* main numpad */}
          <div style={s.mainGrid}>
            {MAIN_BTNS.flat().map((btn, i) => (
              <button key={i} onClick={() => handleButton(btn)}
                style={{ ...btnStyle(btn), gridColumn: btn === "0" ? "span 1" : undefined }}>
                {btn}
              </button>
            ))}
          </div>
        </div>

        {/* ── HISTORY PANEL ── */}
        <div style={s.histPanel}>
          <div style={s.histHeader}>
            <span style={{ fontSize:13, fontWeight:500 }}>History</span>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setShowHist((v) => !v)} style={s.iconBtn}>
                {showHist ? "▲" : "▼"}
              </button>
              {history.length > 0 && (
                <button onClick={clearHistory} style={{ ...s.iconBtn, color:"#E24B4A" }}>
                  ✕ clear
                </button>
              )}
            </div>
          </div>

          {showHist && (
            <div style={s.histList}>
              {history.length === 0
                ? <div style={s.histEmpty}>no calculations yet</div>
                : history.map((entry) => (
                  <div key={entry.id} style={s.histItem}>
                    <div style={s.histExpr} onClick={() => reuseResult(entry)} title="click to reuse">
                      <span style={s.histExpText}>{entry.expression}</span>
                      <span style={s.histEq}>=</span>
                      <span style={s.histRes}>{entry.result}</span>
                    </div>
                    <div style={s.histMeta}>
                      <span style={s.histTime}>{entry.timestamp}</span>
                      <button onClick={() => deleteEntry(entry.id)} style={s.delBtn}>✕</button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div style={s.hint}>keyboard supported · click history to reuse · 2nd toggles inverse trig</div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────
const ACCENT  = "#EF9F27";
const SCI_CLR = "#4A8FD4";

const baseBtn = {
  fontFamily: "inherit",
  fontSize: 14,
  border: "none",
  cursor: "pointer",
  borderRadius: 0,
  transition: "filter 0.1s",
  padding: "13px 6px",
  lineHeight: 1,
};

const s = {
  root: {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
    minHeight: "100vh",
    background: "#0d0d10",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem 1rem",
    color: "#f0ede8",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 660,
    marginBottom: "1rem",
  },
  logo:      { fontSize: 18, fontWeight: 700, letterSpacing: -0.5 },
  statusDot: { fontSize: 11, letterSpacing: 0.5 },

  layout: {
    display: "flex",
    gap: "1.25rem",
    alignItems: "flex-start",
    flexWrap: "wrap",
    justifyContent: "center",
    width: "100%",
    maxWidth: 660,
  },

  // calc panel
  calcPanel: {
    background: "#18181f",
    border: "1px solid #2a2a35",
    borderRadius: 18,
    overflow: "hidden",
    width: 340,
    boxShadow: "0 8px 48px #00000080",
  },

  // mode row
  modeRow: {
    display: "flex",
    gap: 6,
    padding: "10px 12px 8px",
    background: "#111116",
    borderBottom: "1px solid #2a2a35",
  },
  modeBtn: {
    fontFamily: "inherit",
    padding: "4px 10px",
    fontSize: 11,
    background: "transparent",
    color: "#555",
    borderRadius: 99,
    border: "1px solid #2a2a35",
    cursor: "pointer",
  },
  modeBtnOn: { background: "#2a2a35", color: ACCENT, borderColor: ACCENT + "55" },
  shiftOn:   { background: "#1e2a40", color: SCI_CLR, borderColor: SCI_CLR + "88" },

  // display
  display: {
    padding: "12px 14px 10px",
    minHeight: 88,
    background: "#0f0f14",
    borderBottom: "1px solid #2a2a35",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  memIndicator: { fontSize: 10, color: "#5DCAA5", textAlign: "right", marginBottom: 2 },
  exprLine:     { fontSize: 12, color: "#444", textAlign: "right", wordBreak: "break-all", minHeight: 16 },
  resultLine:   { fontSize: 28, fontWeight: 700, textAlign: "right", letterSpacing: -0.5, lineHeight: 1.2, wordBreak: "break-all" },
  parenHint:    { fontSize: 10, color: SCI_CLR, textAlign: "right", marginTop: 3, opacity: 0.8 },

  // scientific row
  sciGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 1,
    background: "#2a2a35",
  },
  btnSci: { ...baseBtn, background: "#16161e", color: SCI_CLR, fontSize: 12, padding: "10px 4px" },

  // memory row
  memGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 1,
    background: "#2a2a35",
  },
  btnMem: { ...baseBtn, background: "#1c1c28", color: "#7070a0", fontSize: 12, padding: "10px 4px" },

  // main numpad
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 1,
    background: "#2a2a35",
  },
  btnNum:    { ...baseBtn, background: "#18181f", color: "#f0ede8" },
  btnOp:     { ...baseBtn, background: "#22222e", color: ACCENT,   fontWeight: 600 },
  btnAction: { ...baseBtn, background: "#1f1f2c", color: "#9FE1CB", fontWeight: 600 },
  btnEquals: { ...baseBtn, background: ACCENT,   color: "#0d0d10", fontWeight: 700, fontSize: 16 },

  // history panel
  histPanel: {
    background: "#18181f",
    border: "1px solid #2a2a35",
    borderRadius: 18,
    width: 285,
    maxHeight: 520,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 48px #00000080",
  },
  histHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #2a2a35",
    background: "#111116",
  },
  iconBtn:  { background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:11, fontFamily:"inherit", padding:"2px 6px" },
  histList: { overflowY:"auto", flex:1 },
  histEmpty: { color:"#333", textAlign:"center", padding:"2rem 1rem", fontSize:12 },
  histItem:  { padding:"10px 14px", borderBottom:"1px solid #1e1e28" },
  histExpr:  { display:"flex", alignItems:"baseline", gap:5, cursor:"pointer" },
  histExpText: { fontSize:12, color:"#555", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  histEq:    { fontSize:11, color:"#333" },
  histRes:   { fontSize:14, fontWeight:600, color:ACCENT },
  histMeta:  { display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:3 },
  histTime:  { fontSize:10, color:"#333" },
  delBtn:    { background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:10, fontFamily:"inherit", padding:0 },

  hint: { marginTop:"1rem", fontSize:10, color:"#333", letterSpacing:0.5 },
};