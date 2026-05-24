# Calculator App — Setup Guide

## Project Structure
```
Scientific-Calculator/
├── backend   # Python Flask API
      └── calculator_backend.py
├── frontend          # React frontend component
      └── src
          └── App.jsx
└── README.md
```

---

## Backend (Python + Flask)

### Install dependencies
```bash
pip install flask flask-cors
```

### Run the server
```bash
python calculator_backend.py
```
Server starts at **http://localhost:5000**

### API Endpoints
| Method | Endpoint              | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | `/calculate`          | Evaluate expression, save history |
| GET    | `/history`            | Fetch all history (newest first) |
| DELETE | `/history`            | Clear all history              |
| DELETE | `/history/<id>`       | Delete one entry by ID         |
| GET    | `/health`             | Check backend status           |

## Frontend (React)

### Option A — Vite (recommended)
```bash
npm create vite@latest calculator-app -- --template react
cd calculator-app
# Replace src/App.jsx with Calculator.jsx content
npm run dev
```

### Option B — Use as a component
Drop `Calculator.jsx` into any React project that uses JSX.

---

## Features
- **Full arithmetic**: +, −, ×, ÷, % with parentheses
- **Keyboard support**: type numbers and operators directly
- **History panel**: all calculations stored on backend
- **Reuse results**: click a history entry to load its result
- **Delete entries**: remove individual records or clear all
- **Backend status**: live indicator (online / offline)
- **Error handling**: division by zero, invalid expressions
- **Scientific Operations** : sin, cos, tan, asin, acos, atan

---

## Notes
- History is stored **in-memory** on the backend (resets on server restart)
- To persist history, swap the `history` list for a SQLite/PostgreSQL DB
- The backend runs on port **5000**; the React dev server defaults to **5173**
- CORS is enabled for all origins — restrict in production
