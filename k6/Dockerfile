# Containerised k6 test runner.

# to build:  docker build -t order-api-k6 ./k6
# to run:   docker run --rm -e BASE_URL=http://host:3000 order-api-k6 run /scripts/load.js
FROM grafana/k6:latest

COPY . /scripts

WORKDIR /tmp

ENV BASE_URL=http://localhost:3000

ENTRYPOINT ["k6"]
CMD ["run", "/scripts/load.js"]
