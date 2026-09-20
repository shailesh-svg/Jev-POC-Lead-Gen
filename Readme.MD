# Align Workbench

Align Workbench is a TypeSafe AI demo with three tools in one app: document
review against a profile, PDF classification, and lead scoring against an
ideal customer profile.

These commands are for macOS or Linux.

## Run it

Install Python 3.11 or newer and Node.js 20.19 or newer, then, from the project
folder:

```sh
./start
```

That is the whole thing. It creates the virtualenv, installs both sets of
packages, builds the frontend and opens [http://127.0.0.1:8000](http://127.0.0.1:8000).
The first run takes a couple of minutes; later runs start in a second and only
rebuild the frontend when its source has changed.

Press `Ctrl+C` to stop. Run `./start` again to pick up where you left off.

Options:

```sh
./start --port=8100   # serve somewhere else
./start --rebuild     # force a frontend rebuild
./start --no-open     # do not open the browser
./start --help
```

If the port is busy, `./start` moves to the next free one and tells you which.

## Add your API key

Open Settings in the app and paste your TypeSafe API key. It is encrypted on
this computer and is never returned to the browser. A `TYPESAFE_API_KEY`
environment variable works too.

## Score several leads at once

In the lead generation tab, separate leads with a line of `---` to score up to
ten in one pass. They come back ranked by priority, and `Export CSV` saves the
queue.

[DEMO.md](DEMO.md) walks through this with sample leads to paste.

## Run the tests

```sh
.venv/bin/python -m pytest
cd frontend && npm test
```

## Running the steps yourself

`./start` does the following, if you would rather run them by hand:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cd frontend && npm ci && npm run build && cd ..
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

One server serves both the Python backend and the built React frontend. After
a frontend change, rebuild with `npm run build` in `frontend` and refresh.
