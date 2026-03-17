# Stage 1: Build
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Run
FROM python:3.11-slim

WORKDIR /app

# Create a non-root user
RUN groupadd -g 999 python && \
    useradd -r -u 999 -g python python

# Copy installed packages from builder
COPY --from=builder /root/.local /home/python/.local
COPY . .

# Set environment variables
ENV PATH=/home/python/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Ensure ownership
RUN chown -R python:python /app

USER python

EXPOSE 8000

# Use gunicorn for production
CMD ["gunicorn", "main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-"]
