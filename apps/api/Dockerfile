FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

RUN apt-get update && apt-get install -y --no-install-recommends   build-essential curl bash   && rm -rf /var/lib/apt/lists/*
SHELL ["/bin/bash", "-lc"]
COPY pyproject.toml /app/pyproject.toml

RUN pip install --no-cache-dir -U pip   && pip install --no-cache-dir "uv==0.4.30"   && uv pip install --system -r <(python -c "import tomllib; d=tomllib.load(open('pyproject.toml','rb')); print('\n'.join(d['project']['dependencies']))")

COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY app /app/app

RUN mkdir -p /app/data/uploads

EXPOSE 8000

# Run migrations then serve. Render sets $PORT.
CMD ["bash", "-lc", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
