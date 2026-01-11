terraform {
  required_version = ">= 1.9.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
    # Alternative if AWS Lightsail Nano ($3.50/mo) becomes preferable
    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "~> 5.0"
    # }
  }
}

variable "do_token" {
  description = "DigitalOcean personal access token"
  type        = string
  sensitive   = true
}

variable "ssh_key_id" {
  description = "DigitalOcean SSH key ID for provisioning"
  type        = string
}

variable "duplo_client_id" {
  description = "Duplo OAuth client ID"
  type        = string
  sensitive   = true
}

variable "duplo_client_secret" {
  description = "Duplo OAuth client secret"
  type        = string
  sensitive   = true
}

variable "remita_merchant_id" {
  description = "Remita merchant identifier"
  type        = string
  sensitive   = true
}

variable "remita_api_key" {
  description = "Remita API key"
  type        = string
  sensitive   = true
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_droplet" "ocr_service" {
  name   = "taxbridge-ocr"
  region = "lon1"              # Low latency to Nigeria
  size   = "s-1vcpu-1gb"       # $6/month; switch to Lightsail nano for $3.50 if AWS preferred
  image  = "docker-20-04"

  ssh_keys = [var.ssh_key_id]
  user_data = templatefile(
    "${path.module}/templates/user_data.sh.tmpl",
    {
      duplo_client_id     = var.duplo_client_id,
      duplo_client_secret = var.duplo_client_secret,
      remita_merchant_id  = var.remita_merchant_id,
      remita_api_key      = var.remita_api_key
    }
  )

  tags = ["production", "ocr", "taxbridge"]
}

resource "digitalocean_certificate" "api_cert" {
  name    = "taxbridge-cert"
  type    = "lets_encrypt"
  domains = ["api.taxbridge.ng", "ocr.taxbridge.ng"]
}

resource "digitalocean_loadbalancer" "backend_lb" {
  name   = "taxbridge-lb"
  region = "lon1"

  forwarding_rule {
    entry_protocol  = "https"
    entry_port      = 443
    target_protocol = "http"
    target_port     = 3000
    certificate_id  = digitalocean_certificate.api_cert.id
  }

  healthcheck {
    protocol               = "http"
    port                   = 3000
    path                   = "/health"
    check_interval_seconds = 30
    response_timeout_seconds = 5
    unhealthy_threshold    = 3
    healthy_threshold      = 5
  }

  droplet_ids = [digitalocean_droplet.ocr_service.id]
}

resource "digitalocean_spaces_bucket" "storage" {
  name   = "taxbridge-storage"
  region = "lon1"
  acl    = "private"
}

output "ocr_service_ip" {
  description = "Public IPv4 address for the OCR droplet"
  value       = digitalocean_droplet.ocr_service.ipv4_address
}

output "storage_endpoint" {
  description = "DigitalOcean Spaces endpoint"
  value       = "${digitalocean_spaces_bucket.storage.name}.${digitalocean_spaces_bucket.storage.region}.digitaloceanspaces.com"
}
