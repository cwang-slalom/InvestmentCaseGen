from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.getenv("UVICORN_HOST", "0.0.0.0")
    port = int(
        os.getenv("UVICORN_PORT")
        or os.getenv("DATABRICKS_APP_PORT")
        or "8000",
    )
    uvicorn.run("backend.app.main:app", host=host, port=port)


if __name__ == "__main__":
    main()
