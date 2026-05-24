#!/usr/bin/env python3
"""
Scientific Calculator Backend — Flask REST API
Install: pip install flask flask-cors
Run:     python calculator_backend.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import math

app = Flask(__name__)
CORS(app)

# In-memory history (replace list with SQLite/Postgres for persistence)
history = []


# ── angle conversion ──────────────────────────────────────────────────────────
def to_rad(x, mode="deg"):
    if mode == "deg":  return x * math.pi / 180
    if mode == "grad": return x * math.pi / 200
    return x  # already radians


def from_rad(x, mode="deg"):
    if mode == "deg":  return x * 180 / math.pi
    if mode == "grad": return x * 200 / math.pi
    return x


# ── safe evaluation context ───────────────────────────────────────────────────
def build_safe_ctx(mode="deg"):
    """Return a whitelist of allowed names for eval(), angle-mode aware."""
    return {
        # trig (input angle converted to radians)
        "sin":  lambda x: math.sin(to_rad(x, mode)),
        "cos":  lambda x: math.cos(to_rad(x, mode)),
        "tan":  lambda x: math.tan(to_rad(x, mode)),

        # inverse trig (output converted from radians to current mode)
        "asin": lambda x: from_rad(math.asin(x), mode),
        "acos": lambda x: from_rad(math.acos(x), mode),
        "atan": lambda x: from_rad(math.atan(x), mode),

        # logarithms
        "log":  math.log10,           # log base 10
        "ln":   math.log,             # natural log

        # powers and roots
        "sqrt": math.sqrt,
        "cbrt": lambda x: math.copysign(abs(x) ** (1 / 3), x),

        # combinatorics
        "fact": math.factorial,
        "nCr":  lambda n, r: math.comb(int(n), int(r)),
        "nPr":  lambda n, r: math.perm(int(n), int(r)),

        # misc
        "abs":  abs,
        "ceil": math.ceil,
        "floor": math.floor,
        "round": round,

        # constants
        "pi":   math.pi,
        "e":    math.e,
        "tau":  math.tau,

        # block all builtins
        "__builtins__": {},
    }


# ── domain guards ─────────────────────────────────────────────────────────────
def domain_check(expression):
    expr = expression.lower()

    # asin / acos domain: argument must be in [-1, 1]
    # We can't easily parse the arg here, so we let eval raise and catch below.

    # sqrt of negative — check for common patterns
    # e.g. sqrt(-4) → we catch ValueError below anyway

    # log(0) / log(negative)
    if "log(0)" in expr or "ln(0)" in expr:
        return "log(0) is undefined"

    return None  # all clear


# ── core evaluator ────────────────────────────────────────────────────────────
def evaluate_expression(expression: str, mode: str = "deg") -> float:

    # Character whitelist — only allow safe chars
    allowed = set("0123456789+-*/().%, abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    if not all(c in allowed for c in expression):
        raise ValueError("Invalid characters in expression")

    # Pre-flight domain check
    pre_err = domain_check(expression)
    if pre_err:
        raise ValueError(pre_err)

    ctx = build_safe_ctx(mode)

    try:
        result = eval(expression, {"__builtins__": {}}, ctx)
    except ZeroDivisionError:
        raise ValueError("Division by zero")
    except OverflowError:
        raise ValueError("Result too large")
    except (NameError, SyntaxError) as exc:
        raise ValueError(f"Invalid expression: {exc}")

    # Post-eval sanity
    if not isinstance(result, (int, float)):
        raise ValueError("Expression did not return a number")
    if math.isnan(result):
        raise ValueError("Result is not a number (domain error)")
    if math.isinf(result):
        raise ValueError("Result is infinite (division by zero or overflow)")

    return round(result, 10)


# ── routes ────────────────────────────────────────────────────────────────────

@app.route("/calculate", methods=["POST"])
def calculate():
    data       = request.get_json(force=True)
    expression = data.get("expression", "").strip()
    mode       = data.get("angle_mode", "deg")   # "deg" | "rad" | "grad"

    if not expression:
        return jsonify({"error": "Expression is required"}), 400

    if mode not in ("deg", "rad", "grad"):
        return jsonify({"error": "angle_mode must be deg, rad, or grad"}), 400

    try:
        result = evaluate_expression(expression, mode)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Unexpected error: {exc}"}), 500

    entry = {
        "id":         len(history) + 1,
        "expression": expression,
        "result":     result,
        "angle_mode": mode,
        "timestamp":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    history.append(entry)

    return jsonify({"result": result, "entry": entry})


@app.route("/history", methods=["GET"])
def get_history():
    return jsonify({"history": list(reversed(history)), "count": len(history)})


@app.route("/history", methods=["DELETE"])
def clear_history():
    history.clear()
    return jsonify({"message": "History cleared"})


@app.route("/history/<int:entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    global history
    before = len(history)
    history = [e for e in history if e["id"] != entry_id]
    if len(history) == before:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify({"message": f"Entry {entry_id} deleted"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "history_count": len(history)})


if __name__ == "__main__":
    print("  Scientific Calculator Backend")
    print("    http://localhost:5000")
    print("    Endpoints: POST /calculate  GET|DELETE /history  GET /health")
    app.run(debug=True, port=5000)