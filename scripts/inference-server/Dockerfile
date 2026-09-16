FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY app.py .

# Railway and Render both inject PORT env var
EXPOSE 10000

CMD ["python", "app.py"]
