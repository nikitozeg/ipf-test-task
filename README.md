# Order Processing API - perf test task

A small mock API (currency conversions) with 3 performance
problems prepared in on purpose. The job here was to test its performance.

Stack: plain Node.js, k6 for the tests, Docker, Terraform for AWS.

## 3 baked-in constraints (the tests should uncover these)
The API has the following characteristics baked in. Do not remove them, your tests should surface
and respond to these:

1.) GET /orders performs a full in-memory scan on every request with no pagination enforcement
— it returns all records regardless of the ?limit= parameter

2.) POST /orders has a simulated processing delay of 80–120ms (e.g. Thread.Sleep or
setTimeout) to mimic a downstream dependency such as inventory validation

3.) The server is configured with a low concurrency limit — max 10 simultaneous connections
(use a semaphore, connection pool cap, or equivalent)

## Run it
```bash
docker compose up --build
```
(or just `npm start`, there are no dependencies)

## Run the tests
template:
```bash
cd k6
 K6_WEB_DASHBOARD=true \
 K6_WEB_DASHBOARD_EXPORT=report.html \
 K6_WEB_DASHBOARD_PERIOD=1s \
 k6 run *your_test*.js
 

benchmark.js      
  # baseline: POST + GET by id         

benchmark-list.js
  # GET /orders at that data volume
  # please seed data first:
    SEED=2000 k6 run helpers/seed.js   
        
load.js       
  # realistic mixed load:
   # Traffic mix  like a real FX service:
   # 60%  GET    /orders/{id}         (read one by id)
   # 25%  GET    /orders            ( list all)
   # 10%  POST   /orders              (create)
   #  5%  PATCH  /orders/{id}/status           
stress.js               
  # to find the breaking point    
```

## Deploy to AWS
ECS Fargate with Terraform, full steps in `infra/terraform/README.md`.
```bash
cd infra/terraform && terraform init && terraform apply
```
Why Fargate and not Lambda: the service keeps orders in memory and has a 10 connection
semaphore, so it needs one long running process. Lambda is stateless so it would break
both. 

## Test strategy
 **benchmark**: baseline per endpoint, SLOs written as k6 thresholds (auto pass/fail)

**load**: realistic mix (60% get by id, 25% list, 10% create, 5% patch), open model, 50 req/s

**stress**: push past capacity to see how it breaks

## Key findings
- POST tops out at ~98 req/s. The limit is concurrency(10) x delay(0.1s), not CPU.
  Adding more users does not help, they just queue.
- GET /orders is O(n). Latency grows with the number of records (8ms at 200, 75ms at
  2000) because it returns the whole dataset every time. Biggest risk.
- GET /orders/{id} is fast (~1ms), the healthy one.
- Under realistic load (50 req/s) all SLOs are green with a lot of headroom.
- Under stress the server browns out around ~266 req/s: latency jumps to ~4.5s but
  almost no errors. So only a latency SLO catches it, an error-rate SLO stays green.

## Fixes / what i would do with more time
1 add real pagination to GET /orders (O(n) becomes constant)
2raise the concurrency limit and/or make the delay async to get more POST throughput
3 add load error (503) so overload fails fast instead of just getting slow

## CI
https://github.com/nikitozeg/ipf-test-task/actions
GitHub Actions runs the benchmark on every push/PR, the k6 thresholds gate the build
(`.github/workflows/perf.yml`).

## Layout
```
src/                 API (server, semaphore, in-memory store)
k6/                 perf tests - benchmark, load, stress)
infra/terraform/    AWS ECS Fargate
postman/            manual collection
```
