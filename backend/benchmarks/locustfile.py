"""
Locust load test for the ``/query`` endpoint.

Run (after `pip install -r benchmarks/requirements-bench.txt`):

    locust -f benchmarks/locustfile.py --host http://localhost:8000
    # headless:
    locust -f benchmarks/locustfile.py --host http://localhost:8000 \
           --headless --users 20 --spawn-rate 5 --run-time 2m

Each task POSTs a golden-set question and drains the SSE stream so Locust's
measured response time reflects full end-to-end latency. If ``locust``/``gevent``
has no wheel for your Python version, use ``run_benchmark.py`` (pure-Python,
``--concurrency``) as the load generator instead.
"""

from __future__ import annotations

import json
import random
from pathlib import Path

from locust import HttpUser, between, task

_GOLDEN = Path(__file__).parent.parent / "evals" / "golden_set.json"
_QUESTIONS = [item["question"] for item in json.loads(_GOLDEN.read_text())]


class QueryUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def query(self) -> None:
        question = random.choice(_QUESTIONS)
        with self.client.post(
            "/query",
            json={"question": question},
            stream=True,
            catch_response=True,
            name="/query",
        ) as resp:
            # Drain the SSE stream so latency reflects full generation.
            for _ in resp.iter_lines():
                pass
            resp.success()
