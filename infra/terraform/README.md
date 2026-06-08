# Deploy simple Order Processing API to AWS with Terraform

My solution of IaC to spin up the Order Processing API on AWS Fargate.

```internet -> port :3000 -> image pulled from ECR -> ECS Fargate task with our container ->CloudWatch logs```
                        
all inside one VPC 
```
### Terraform setup::
└── infra/
└── terraform/
├── ecs.tf       # IAM execution role, CloudWatch log group, ECS cluster, task definition, service
├── main.tf      # AWS provider + ECR repository
├── network.tf   # VPC, single public subnet, internet gateway, route table, security group
└── outputs.tf   # ECR URL, cluster & service names
```

# Why ECS Fargate
we have a stateful mocked service, lambda is stateless by it's design. 
requirements: in-memory storage and and max 10 simultaneous connections (semaphore) and this requires a long-lived process with a shared state. 
repicas = 1

To start deployment:
```
cd infra/terraform
terraform init
```
# 1. Spin up the ECR repo first so we have somewhere to push the image
```
terraform apply -target=aws_ecr_repository.api
```
# 2. Build  and push to ECR
```
REPO=$(terraform output -raw ecr_repository_url)
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin "$REPO"
docker build --platform linux/amd64 -t "$REPO:latest" ../..
docker push "$REPO:latest"
```

# 3. Deploy the rest of the infrastructure: network, cluster, servce
```
terraform apply
```

## Calling the API

After deploying, get the service public IP (AWS Console -> ECS -> cluster
`order-api-cluster` -> Tasks -> open the task => **Public IP**).
and
```
curl http://<IP>:3000/health
```