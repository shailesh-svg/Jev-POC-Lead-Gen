# Run Align Workbench

Align Workbench is a TypeSafe AI demo with three tools in one app: document
review against a profile, PDF classification, and lead scoring against an
ideal customer profile.

These commands are for macOS or Linux.

## Prerequisites

Install:

- Python 3.11 or newer (`python3`)
- Node.js 20.19 or newer, with npm

## First-time setup

Open a terminal in the project folder: the folder that contains `requirements.txt`, `backend`, and `frontend`.

Run these commands in order:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
```

## Start the application

From the project folder, run:

```sh
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Keep this terminal open while you use the application. This command serves both the Python backend and the built React frontend. No second server is needed.

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.

## Stop and start again

Press `Ctrl+C` in the terminal to stop the application.

To start it again, run the same start command from the project folder. You do not need to repeat first-time setup.

## After a frontend code change

Stop the application, then run these commands from the project folder:

```sh
cd frontend
npm run build
cd ..
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Refresh the browser after the server starts.

## If port 8000 is already in use

Use a different port:

```sh
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Then open [http://127.0.0.1:8001](http://127.0.0.1:8001).
