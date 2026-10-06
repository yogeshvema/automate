resource "aws_ecr_repository" "api" {
  name                 = "snapsend-api"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }
}

resource "aws_ecs_cluster" "main" {
  name = "snapsend-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name = "/ecs/snapsend-api"
}

resource "aws_ecs_task_definition" "api" {
  family                   = "snapsend-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = "arn:aws:iam::376159573859:role/ecsTaskExecutionRole"

  runtime_platform {
    cpu_architecture        = "ARM64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name      = "snapsend-api"
      image     = "376159573859.dkr.ecr.ap-south-1.amazonaws.com/snapsend-api:latest"
      essential = true

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "APP_NAME", value = "SnapSend API" },
        { name = "DEBUG", value = "false" },
        { name = "ENVIRONMENT", value = "production" },
        { name = "LOG_LEVEL", value = "INFO" },
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/snapsend-api"
          "awslogs-region"        = "ap-south-1"
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name                          = "snapsend-service"
  cluster                       = aws_ecs_cluster.main.id
  task_definition               = aws_ecs_task_definition.api.arn
  desired_count                 = 1
  launch_type                   = "FARGATE"
  availability_zone_rebalancing = "ENABLED"

  network_configuration {
    subnets          = ["subnet-048894b8e8e7e85c1", "subnet-0d9e55f1f5dd8f558"]
    security_groups  = ["sg-0edd757f3079509e5"]
    assign_public_ip = true
  }

  lifecycle {
    ignore_changes = [task_definition]
  }
}
