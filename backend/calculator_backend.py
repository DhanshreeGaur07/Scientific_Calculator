#!/usr/bin/env python3
"""
Calculator Backend - Flask REST API
Handles arithmetic operations and stores history in-memory.
Run: pip install flask flask-cors && python calculator_backend.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import math

app = Flask(__name__)
CORS(app)  # Allow React frontend on different port

# In-memory history store
history = []


def evaluate_expression(expression: str) -> float:
    """Safely evaluate a math expression."""
    # Allow only safe characters
    allowed = set("0123456789+-*/().% ")
    if not all(c in allowed for c in expression):
        raise ValueError("Invalid characters in expression")

    # Replace % with /100* for percentage support
    expression = expression.replace("%", "/100")

    result = eval(expression, {"__builtins__": {}}, {"sqrt": math.sqrt, "pi": math.pi})
    return result


@app.route("/calculate", methods=["POST"])
def calculate():
    """Perform a calculation and store it in history."""
    data = request.get_json()
    expression = data.get("expression", "").strip()

    if not expression:
        return jsonify({"error": "Expression is required"}), 400

    try:
        result = evaluate_expression(expression)

        # Handle division by zero or infinity
        if math.isinf(result) or math.isnan(result):
            return jsonify({"error": "Math error (division by zero or undefined)"}), 400

        # Round to avoid floating point noise
        result = round(result, 10)

        # Store in history
        entry = {
            "id": len(history) + 1,
            "expression": expression,
            "result": result,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        history.append(entry)

        return jsonify({"result": result, "entry": entry})

    except ZeroDivisionError:
        return jsonify({"error": "Division by zero"}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid expression: {str(e)}"}), 400


@app.route("/history", methods=["GET"])
def get_history():
    """Return all calculation history, newest first."""
    return jsonify({"history": list(reversed(history)), "count": len(history)})


@app.route("/history", methods=["DELETE"])
def clear_history():
    """Clear all calculation history."""
    history.clear()
    return jsonify({"message": "History cleared"})


@app.route("/history/<int:entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    """Delete a specific history entry by ID."""
    global history
    original_len = len(history)
    history = [e for e in history if e["id"] != entry_id]

    if len(history) == original_len:
        return jsonify({"error": "Entry not found"}), 404

    return jsonify({"message": f"Entry {entry_id} deleted"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "history_count": len(history)})


if __name__ == "__main__":
    print("🧮 Calculator Backend running at http://localhost:5000")
    app.run(debug=True, port=5000)
