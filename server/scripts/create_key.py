"""Выпускает API-ключ. Токен печатается один раз — сохраните его, в БД лежит только хеш.

    .venv/bin/python scripts/create_key.py admin "владелец"
    .venv/bin/python scripts/create_key.py project PTH "ci-bot" writer
"""
import sys

from pth.api import create_app
from pth.auth import issue_key

USAGE = __doc__


def main(argv: list[str]) -> int:
    if len(argv) == 3 and argv[1] == "admin":
        kwargs = {"name": argv[2], "kind": "admin"}
    elif len(argv) == 5 and argv[1] == "project" and argv[4] in {"reader", "writer"}:
        kwargs = {"name": argv[3], "kind": "service", "project_key": argv[2], "role": argv[4]}
    else:
        print(USAGE)
        return 2
    app = create_app()
    with app.state.session_factory() as session:
        token = issue_key(session, **kwargs)
        session.commit()
    print(token)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
