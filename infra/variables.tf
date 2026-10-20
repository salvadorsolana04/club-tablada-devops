# Nada de esto es secreto: un id de organización, una región. Por eso va con default, en un
# archivo que se commitea. Lo secreto (las API keys) lo leen los providers del entorno.

variable "neon_org_id" {
  description = "Organización de Neon donde se crea el proyecto (mi cuenta está dentro de una org)"
  default     = "org-silent-pine-59974785"
}

variable "neon_region" {
  description = "Región de la base: la misma que la de QA y PROD"
  default     = "aws-us-east-1"
}

variable "region" {
  description = "Región de Render (validador estricto: frankfurt | ohio | oregon | singapore | virginia)"
  default     = "oregon" # la misma que QA y PROD
}

variable "image_repo_api" {
  description = "Imagen de la api en el registry, SIN la etiqueta"
  default     = "ghcr.io/salvadorsolana04/club-tablada-devops-backend"
}

variable "image_repo_front" {
  description = "Imagen del front en el registry, SIN la etiqueta"
  default     = "ghcr.io/salvadorsolana04/club-tablada-devops-frontend"
}

variable "image_tag" {
  description = "La imagen del TP7 que corre preprod: la de v7.0.0, la misma que está en PROD"
  default     = "sha-4b4812648f81bdf2250432b1697ce9ad24c89662"
}
