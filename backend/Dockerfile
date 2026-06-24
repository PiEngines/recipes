FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY requirements-dev.txt .
ARG DEV=false
RUN pip install --no-cache-dir -r requirements.txt
RUN if [ "$DEV" = "true" ]; then pip install --no-cache-dir -r requirements-dev.txt; fi


COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
