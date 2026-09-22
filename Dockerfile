FROM python:3.14.2-slim

LABEL MAINTAINER="Loick Gandonou"
LABEL EMAIL="Loickgandonou03@icloud.com>"

WORKDIR /code

ENV HF_HOME=/models

RUN pip install --no-cache-dir torch==2.14.0 --index-url https://download.pytorch.org/whl/cpu

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir -r /code/requirements.txt

COPY ./ /code/app

EXPOSE 8000

CMD ["fastapi", "run", "app/src/main.py"]
