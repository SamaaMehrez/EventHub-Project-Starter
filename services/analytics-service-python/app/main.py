from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .redis_client import read_snapshot, write_snapshot
from .snapshot import compute_snapshot

app = FastAPI(title="analytics-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/analytics/summary")
def summary():
    try:
        # Always calculate a fresh snapshot so the analytics
        # reflect the latest bookings and reviews.
        snapshot = compute_snapshot()

        # Keep Redis updated with the latest snapshot.
        write_snapshot(snapshot)

        return snapshot

    except Exception as exc:
        # If fresh calculation fails, try returning the
        # last known snapshot from Redis.
        snapshot = read_snapshot()

        if snapshot is not None:
            return snapshot

        raise HTTPException(
            status_code=503,
            detail=f"Could not calculate analytics: {str(exc)}",
        )