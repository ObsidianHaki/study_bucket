FROM python:3.14.2

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./ /code/app

EXPOSE 8000

CMD ["fastapi", "run", "app/src/main.py"]
