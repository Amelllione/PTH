"""Фоновое выделение требований по частям (фрагменты из chunking.split_spec)."""
import threading
from datetime import datetime

from pth import llm
from pth.chunking import split_spec
from pth.domain import DomainError
from pth.models import ExtractionJob, utcnow


def _dedupe(proposals: list[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    unique = []
    for p in proposals:
        key = (p["type"], " ".join(p["title"].lower().split()))
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    return unique


def run_job(session_factory, make_client, job_uid: str, text: str) -> None:
    """Обрабатывает фрагменты по очереди; прогресс фиксируется после каждого фрагмента."""
    with session_factory() as s:
        job = s.get(ExtractionJob, job_uid)
        chunks = split_spec(text)
        job.state, job.chunks_total = "running", len(chunks)
        s.commit()
        model = job.model
        collected: list[dict] = []
        skipped = 0
        errors: list[str] = []
        for index, (title, chunk) in enumerate(chunks, 1):
            try:
                raw = make_client().extract(model, chunk)
                valid = llm.validate(raw, chunk, model)
                collected.extend(valid)
                skipped += len(raw) - len(valid)
            except DomainError as exc:
                errors.append(f"фрагмент {index} «{title[:60]}»: {exc.message}")
                if exc.code in {"LLM_UNAVAILABLE", "LLM_AUTH"}:
                    # без модели дальше нет смысла: фиксируем и выходим
                    job.state, job.finished_at = "failed", utcnow()
                    job.errors, job.proposals, job.skipped = errors, _dedupe(collected), skipped
                    job.chunks_done = index
                    s.commit()
                    return
            except Exception as exc:  # непредвиденное: не теряем уже найденное
                errors.append(f"фрагмент {index}: внутренняя ошибка {exc.__class__.__name__}")
            job.chunks_done = index
            job.proposals, job.skipped, job.errors = _dedupe(collected), skipped, errors
            s.commit()
        job.state, job.finished_at = "succeeded", utcnow()
        s.commit()


def start(session_factory, make_client, job_uid: str, text: str) -> None:
    threading.Thread(target=run_job, args=(session_factory, make_client, job_uid, text),
                     daemon=True, name=f"extract-{job_uid[:8]}").start()
