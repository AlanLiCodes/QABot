import asyncio
import json
import time
import uuid
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, select

from database import engine
from models.db_models import Run, StoredTestCase, TestResultRow
from models.schemas import TestCase, TestResultPayload
from services.annotator import annotate_screenshot
from services.browser_runner import execute_case
from services.event_bus import close_queue, emit
from services.planner import generate_test_cases
from services.reporter import attach_evidence, build_summary
from services.validator import validate_result
from storage.artifacts import run_dir

# Max concurrent browser sessions. Each spawns a Chromium + optional Browser Use cloud task.
# 3 is a safe default: avoids OOM on modest VMs while being meaningfully faster than serial.
_MAX_PARALLEL = 3


def stored_case_row_id(run_id: str, logical_case_id: str) -> str:
    safe = logical_case_id.replace("/", "_")
    return f"{run_id}__{safe}"


async def _run_case(
    sem: asyncio.Semaphore,
    run_id: str,
    index: int,
    row: StoredTestCase,
    run_url: str,
    run_viewport: str,
    base: Path,
) -> None:
    """Run a single test case: execute → validate → annotate → store. Thread-safe via per-task session."""
    case = TestCase.model_validate_json(row.case_json)

    # Emit immediately so the UI lists the case even while waiting for a semaphore slot.
    await emit(run_id, "case_started", {
        "case_id": case.id,
        "name": case.name,
        "index": index,
    })

    async with sem:
        t_case_start = time.perf_counter()
        case_timings: dict[str, float] = {}

        try:
            trace, title, final_url, evidence_paths, http_ok, exec_timings = await execute_case(
                case,
                run_url,
                run_viewport,
                run_id,
                base,
            )
            case_timings.update(exec_timings)

            t0 = time.perf_counter()
            validated = await validate_result(
                case,
                trace,
                title,
                final_url,
                evidence_paths,
                http_ok,
            )
            case_timings["validate"] = round(time.perf_counter() - t0, 2)

            validated = attach_evidence(validated, evidence_paths)

            # Annotate the screenshot with a bounding box around the broken element
            shot_path = base / case.id / "viewport.png"
            t0 = time.perf_counter()
            await annotate_screenshot(shot_path, case, validated)
            case_timings["annotate"] = round(time.perf_counter() - t0, 2)

        except Exception as e:
            trace = str(e)
            validated = TestResultPayload(
                test_case_id=case.id,
                status="fail",
                severity="high",
                confidence=0.95,
                failed_step="Browser execution",
                expected=case.goal,
                actual=f"Runner error: {e!s}",
                repro_steps=list(case.steps[:8]) if case.steps else [f"Open {run_url}"],
                evidence=[],
                suspected_issue=(
                    "Playwright/Chromium failed to launch or navigate. "
                    "Run `playwright install chromium` and ensure a non-sandboxed environment."
                ),
                business_impact="No browser verification was possible for this case.",
                agent_trace=trace,
            )

        case_timings["total"] = round(time.perf_counter() - t_case_start, 2)
        validated.timings = case_timings
        validated.summary = build_summary(validated)

        await emit(run_id, "case_completed", {
            "case_id": case.id,
            "status": validated.status,
            "severity": validated.severity,
            "summary": validated.summary,
            "evidence": validated.evidence,
            "timings": case_timings,
        })

        with Session(engine) as session:
            res = TestResultRow(
                id=str(uuid.uuid4()),
                run_id=run_id,
                result_json=validated.model_dump_json(),
                summary=validated.summary,
            )
            session.add(res)
            session.commit()


async def execute_run(run_id: str) -> None:
    with Session(engine) as session:
        run = session.get(Run, run_id)
        if not run:
            return
        run.status = "running"
        session.add(run)
        session.commit()

        cases_rows = session.exec(
            select(StoredTestCase).where(StoredTestCase.run_id == run_id)
        ).all()
        run_url = run.url
        run_viewport = run.viewport

    base = run_dir(run_id)
    t_run_start = time.perf_counter()

    await emit(run_id, "run_started", {"run_id": run_id, "total": len(cases_rows)})

    sem = asyncio.Semaphore(_MAX_PARALLEL)
    tasks = [
        _run_case(sem, run_id, i, row, run_url, run_viewport, base)
        for i, row in enumerate(cases_rows)
    ]
    await asyncio.gather(*tasks)

    with Session(engine) as session:
        run = session.get(Run, run_id)
        if run:
            run.status = "completed"
            session.add(run)
            session.commit()

    total_elapsed = round(time.perf_counter() - t_run_start, 2)
    await emit(run_id, "run_completed", {
        "run_id": run_id,
        "status": "completed",
        "elapsed_seconds": total_elapsed,
    })
    close_queue(run_id)


async def ensure_cases_for_run(
    session: Session,
    run_id: str,
    url: str,
    requirement_text: str,
    max_cases: int,
    provided: list[TestCase] | None,
) -> list[TestCase]:
    if provided:
        cases = provided
    else:
        cases = await generate_test_cases(url, requirement_text, max_cases)
    for c in cases:
        st = StoredTestCase(
            id=stored_case_row_id(run_id, c.id),
            run_id=run_id,
            case_json=c.model_dump_json(),
        )
        session.add(st)
    session.commit()
    return cases


def serialize_run_results(session: Session, run_id: str) -> dict:
    run = session.get(Run, run_id)
    if not run:
        return {}
    cases = session.exec(
        select(StoredTestCase).where(StoredTestCase.run_id == run_id)
    ).all()
    results = session.exec(select(TestResultRow).where(TestResultRow.run_id == run_id)).all()
    return {
        "run_id": run.id,
        "url": run.url,
        "requirement_text": run.requirement_text,
        "status": run.status,
        "viewport": run.viewport,
        "created_at": run.created_at.isoformat() + "Z",
        "test_cases": [json.loads(c.case_json) for c in cases],
        "results": [json.loads(r.result_json) for r in results],
    }


def list_runs(session: Session, limit: int = 20) -> list[dict]:
    rows = session.exec(select(Run).order_by(Run.created_at.desc()).limit(limit)).all()
    out = []
    for run in rows:
        out.append(
            {
                "run_id": run.id,
                "url": run.url,
                "status": run.status,
                "created_at": run.created_at.isoformat() + "Z",
                "requirement_text": run.requirement_text[:120],
            }
        )
    return out
