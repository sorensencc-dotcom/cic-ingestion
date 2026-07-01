terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type        = string
  description = "AWS region for Sandbox-3 infra"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Project name for tagging"
  default     = "cic-sandbox-3"
}

# VPC
resource "aws_vpc" "sandbox_vpc" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name    = "${var.project_name}-vpc"
    Project = var.project_name
  }
}

resource "aws_subnet" "sandbox_public" {
  vpc_id                  = aws_vpc.sandbox_vpc.id
  cidr_block              = "10.42.1.0/24"
  map_public_ip_on_launch = true

  tags = {
    Name    = "${var.project_name}-public-subnet"
    Project = var.project_name
  }
}

# Firecracker host ASG (placeholder EC2 group)
resource "aws_launch_template" "firecracker_host_lt" {
  name_prefix   = "${var.project_name}-fc-host-"
  image_id      = "ami-xxxxxxxx" # TODO: pin hardened host AMI
  instance_type = "c5.large"

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name    = "${var.project_name}-firecracker-host"
      Project = var.project_name
      Role    = "firecracker-host"
    }
  }
}

resource "aws_autoscaling_group" "firecracker_hosts" {
  name                = "${var.project_name}-firecracker-hosts"
  max_size            = 3
  min_size            = 1
  desired_capacity    = 1
  vpc_zone_identifier = [aws_subnet.sandbox_public.id]
  launch_template {
    id      = aws_launch_template.firecracker_host_lt.id
    version = "$Latest"
  }

  tag {
    key                 = "Project"
    value               = var.project_name
    propagate_at_launch = true
  }
}

# Postgres (RDS)
resource "aws_db_subnet_group" "sandbox_db_subnets" {
  name       = "${var.project_name}-db-subnets"
  subnet_ids = [aws_subnet.sandbox_public.id]

  tags = {
    Name    = "${var.project_name}-db-subnets"
    Project = var.project_name
  }
}

resource "aws_db_instance" "sandbox_postgres" {
  identifier        = "${var.project_name}-postgres"
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  username = "cic_admin"
  password = "CHANGE_ME_SECURELY" # TODO: move to secrets manager
  db_subnet_group_name = aws_db_subnet_group.sandbox_db_subnets.name
  skip_final_snapshot   = true

  tags = {
    Name    = "${var.project_name}-postgres"
    Project = var.project_name
  }
}

# Artifacts / snapshots bucket
resource "aws_s3_bucket" "sandbox_artifacts" {
  bucket = "${var.project_name}-artifacts"

  tags = {
    Name    = "${var.project_name}-artifacts"
    Project = var.project_name
  }
}

output "vpc_id" {
  value = aws_vpc.sandbox_vpc.id
}

output "firecracker_asg_name" {
  value = aws_autoscaling_group.firecracker_hosts.name
}

output "postgres_endpoint" {
  value = aws_db_instance.sandbox_postgres.address
}

output "artifacts_bucket" {
  value = aws_s3_bucket.sandbox_artifacts.bucket
}
