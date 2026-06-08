output "ecr_repository_url" {
  description = "where to poush image: docker push <is>:latest"
  value       = aws_ecr_repository.api.repository_url
}

output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "service_name" {
  value = aws_ecs_service.api.name
}