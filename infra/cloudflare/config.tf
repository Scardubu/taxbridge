terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with DNS + Firewall permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account identifier"
  type        = string
}

variable "backend_ip" {
  description = "Render or load balancer IP address that serves api.taxbridge.ng"
  type        = string
}

variable "admin_ip" {
  description = "Vercel or admin dashboard origin. Use CNAME target when proxied"
  type        = string
}

variable "ocr_ip" {
  description = "Dedicated OCR droplet public IP"
  type        = string
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_zone" "taxbridge" {
  account_id = var.cloudflare_account_id
  zone       = "taxbridge.ng"
}

# === DNS records ===
resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.taxbridge.id
  name    = "api"
  value   = var.backend_ip
  type    = "A"
  proxied = true
  comment = "Fastify API entry point"
}

resource "cloudflare_record" "admin" {
  zone_id = cloudflare_zone.taxbridge.id
  name    = "admin"
  value   = var.admin_ip
  type    = "A"
  proxied = true
  comment = "Next.js admin dashboard"
}

resource "cloudflare_record" "ocr" {
  zone_id = cloudflare_zone.taxbridge.id
  name    = "ocr"
  value   = var.ocr_ip
  type    = "A"
  proxied = false # keep direct for low latency OCR uploads
  comment = "Dedicated OCR droplet"
}

resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.taxbridge.id
  name    = "www"
  value   = "taxbridge.ng"
  type    = "CNAME"
  proxied = true
}

# === Firewall / WAF rules ===
resource "cloudflare_filter" "bad_bots" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Known bad bots + elevated threat score"
  expression  = "(cf.client.bot) or (cf.threat_score > 14)"
}

resource "cloudflare_firewall_rule" "block_bad_bots" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Block bots + suspicious traffic"
  filter_id   = cloudflare_filter.bad_bots.id
  action      = "block"
}

resource "cloudflare_filter" "restrict_duplo" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Lock Duplo callback endpoints to DigiTax ASN + Nigeria"
  expression  = "(http.request.uri.path contains \"/webhooks/duplo\" and not ip.geoip.country eq \"NG\")"
}

resource "cloudflare_firewall_rule" "duplo_geo_enforce" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Only allow Nigerian IPs to Duplo webhooks"
  filter_id   = cloudflare_filter.restrict_duplo.id
  action      = "challenge"
}

resource "cloudflare_filter" "restrict_remita" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Lock Remita callback endpoints"
  expression  = "(http.request.uri.path contains \"/webhooks/remita\" and not ip.geoip.country in {\"NG\",\"GB\"})"
}

resource "cloudflare_firewall_rule" "remita_geo_enforce" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Challenge non-whitelisted geos"
  filter_id   = cloudflare_filter.restrict_remita.id
  action      = "challenge"
}

# === Rate limiting ===
resource "cloudflare_rate_limit" "api_rate_limit" {
  zone_id  = cloudflare_zone.taxbridge.id
  disabled = false
  description = "Global API rate limit"

  threshold = 100
  period    = 60

  match {
    request {
      url_pattern = "https://api.taxbridge.ng/api/*"
      schemes     = ["HTTPS"]
      methods     = ["GET", "POST", "PUT", "DELETE", "PATCH"]
    }
  }

  action {
    mode    = "challenge"
    timeout = 600
  }
}

resource "cloudflare_rate_limit" "webhook_rate_limit" {
  zone_id     = cloudflare_zone.taxbridge.id
  description = "Protect Duplo/Remita webhook endpoints from replay"
  threshold   = 20
  period      = 60

  match {
    request {
      url_pattern = "https://api.taxbridge.ng/webhooks/*"
      schemes     = ["HTTPS"]
    }
  }

  action {
    mode    = "simulate"
    timeout = 120
  }

  correlate {
    by = "nat"
  }
}

# === SSL/TLS hardening ===
resource "cloudflare_zone_settings_override" "taxbridge_settings" {
  zone_id = cloudflare_zone.taxbridge.id

  settings {
    ssl                       = "strict"
    always_use_https          = "on"
    min_tls_version           = "1.3"
    tls_1_3                   = "on"
    automatic_https_rewrites  = "on"
    security_level            = "high"
    challenge_ttl             = 1800
    opportunistic_encryption  = "on"
    http3                     = "on"
  }
}

resource "cloudflare_ruleset" "security_headers" {
  zone_id = cloudflare_zone.taxbridge.id
  name    = "Strict security headers"
  kind    = "zone"
  phase   = "http_response_headers_transform"

  rules {
    enabled     = true
    action      = "set_header"
    description = "HSTS preload"

    action_parameters {
      headers = [{
        name   = "Strict-Transport-Security"
        value  = "max-age=63072000; includeSubDomains; preload"
        status = "overwrite"
      }]
    }
  }
}

output "zone_id" {
  description = "Cloudflare zone identifier"
  value       = cloudflare_zone.taxbridge.id
}
