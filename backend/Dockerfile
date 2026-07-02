# Use the official lightweight Python image.
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Create working directory
WORKDIR /app

# Install system dependencies:
#   - build-essential/libffi-dev/libjpeg-dev/libopenjp2-7-dev: general Python C-extension builds
#   - libpango/libharfbuzz: kept in case WeasyPrint is used anywhere in the pipeline
#   - the libnss3...libpangocairo block: Chromium's runtime libraries for Playwright
#     (installed explicitly here so we do NOT need `playwright install --with-deps`,
#     which pulls in `ttf-unifont` — a font package unavailable on this base image
#     and the reason earlier builds failed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libffi-dev \
    libjpeg-dev \
    libopenjp2-7-dev \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install the Chromium BROWSER only (no --with-deps — its runtime libs are already
# installed explicitly above, avoiding the ttf-unifont apt error).
RUN python -m playwright install chromium

# Copy the rest of the application code
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the application.
# NOTE: Railway injects $PORT at runtime and it usually isn't 8000 — CMD in "exec form"
# (the bracket syntax below) can't expand env vars, so this hardcodes 8000. If Railway's
# health check / routing fails after deploy, switch to the shell form so $PORT expands:
#   CMD uvicorn main:app --host 0.0.0.0 --port $PORT
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]