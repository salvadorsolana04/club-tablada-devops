# PREPROD — un entorno que no existe hasta que esto se aplica, y que se va con un destroy.
# QA y PROD (los que clickeé en el TP6) NO están acá: este código no los toca ni los ve.
#
# Las credenciales NO están en este archivo: los providers las leen del entorno
# (NEON_API_KEY, RENDER_API_KEY, RENDER_OWNER_ID). El estado vive en mi máquina
# (infra/terraform.tfstate, ignorado por git): no hay bloque backend a propósito.

terraform {
  required_version = ">= 1.5"

  required_providers {
    neon = {
      source  = "kislerdm/neon"
      version = "0.18.0" # fijada: el repo del provider está archivado y el oficial todavía no salió
    }
    render = {
      source  = "render-oss/render"
      version = "1.9.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.7.2"
    }
  }
}

provider "neon" {}   # lee NEON_API_KEY
provider "render" {} # lee RENDER_API_KEY y RENDER_OWNER_ID

# --- La base de preprod: un proyecto de Neon PROPIO, que se destruye entero sin rozar QA/PROD ---

resource "neon_project" "preprod" {
  name      = "club-tablada-preprod"
  org_id    = var.neon_org_id
  region_id = var.neon_region # la misma región que la base de QA y PROD: parecido a producción

  # Sin esta línea el primer apply falla: el provider pide 1 día de historial y el
  # plan gratuito permite 6 horas (21600 s).
  history_retention_seconds = 21600
}

resource "neon_role" "preprod" {
  project_id = neon_project.preprod.id
  branch_id  = neon_project.preprod.default_branch_id # default_branch_id, NO branch_id
  name       = "app_preprod_owner"
}

resource "neon_database" "preprod" {
  project_id = neon_project.preprod.id
  branch_id  = neon_project.preprod.default_branch_id
  name       = "app_preprod"
  owner_name = neon_role.preprod.name
}

# --- La api y el front de preprod: la MISMA imagen del TP7, sin construir nada ---

locals {
  # La cadena de conexión se ARMA con lo que devolvió Neon: nadie la copia y pega
  # (en el TP6 ése era el error más caro: un entorno apuntando a la base de otro).
  database_url = "postgres://${neon_role.preprod.name}:${urlencode(neon_role.preprod.password)}@${neon_project.preprod.database_host}/${neon_database.preprod.name}?sslmode=require"
}

# La SECRET_KEY de Django no se escribe en ningún lado: la genera Terraform y vive en el estado.
resource "random_password" "django_secret_key" {
  length  = 50
  special = false
}

resource "render_web_service" "api" {
  name   = "club-tablada-api-preprod"
  plan   = "free"
  region = var.region

  runtime_source = {
    image = {
      image_url = var.image_repo_api # SIN la etiqueta: si va pegada, el apply falla
      tag       = var.image_tag      # la etiqueta va en su propio campo
    }
  }

  # GIT_COMMIT NO va acá: viene horneado en la imagen. Una variable del servicio lo pisaría
  # y /health dejaría de decir qué imagen corre.
  env_vars = {
    DATABASE_URL = { value = local.database_url }
    SECRET_KEY   = { value = random_password.django_secret_key.result }
    DEBUG        = { value = "False" }
    PORT         = { value = "8000" }
  }
}

resource "render_web_service" "front" {
  name   = "club-tablada-front-preprod"
  plan   = "free"
  region = var.region

  runtime_source = {
    image = {
      image_url = var.image_repo_front
      tag       = var.image_tag # la misma etiqueta que la api: salieron de la misma corrida
    }
  }

  env_vars = {
    # La dirección de SU api sale de Terraform, sin la barra final (con barra, nginx daría 404)
    BACKEND_URL  = { value = trimsuffix(render_web_service.api.url, "/") }
    DNS_RESOLVER = { value = "8.8.8.8" }
    PORT         = { value = "80" }
  }
}
