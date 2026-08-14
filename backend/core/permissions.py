from rest_framework.permissions import SAFE_METHODS, BasePermission


class EsAdminOSoloLectura(BasePermission):
    """Cualquier usuario autenticado puede leer; solo el rol admin puede escribir."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.rol == 'admin')


class EsEntrenadorOSoloLectura(BasePermission):
    """Cualquier usuario autenticado puede leer; solo el rol entrenador puede escribir."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.rol == 'entrenador')
