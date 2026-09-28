from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MensajeDivision, Noticia
from .permissions import EsAdminOSoloLectura, EsEntrenadorOSoloLectura
from .reglas import validar_borrado, validar_limite_diario
from .serializers import MensajeDivisionSerializer, NoticiaSerializer, UsuarioSerializer


def contar_mensajes_hoy(usuario):
    """La dependencia real de validar_limite_diario: cuenta en la base."""
    return MensajeDivision.objects.filter(
        emisor=usuario, fecha__date=timezone.localdate()
    ).count()


class PerfilView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)


class NoticiaListCreateView(generics.ListCreateAPIView):
    queryset = Noticia.objects.all()
    serializer_class = NoticiaSerializer
    permission_classes = [permissions.IsAuthenticated, EsAdminOSoloLectura]

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)


class MensajeDivisionListCreateView(generics.ListCreateAPIView):
    serializer_class = MensajeDivisionSerializer
    permission_classes = [permissions.IsAuthenticated, EsEntrenadorOSoloLectura]

    def get_queryset(self):
        usuario = self.request.user
        if not usuario.deporte or not usuario.division:
            return MensajeDivision.objects.none()
        return MensajeDivision.objects.filter(
            deporte=usuario.deporte, division=usuario.division
        )

    def perform_create(self, serializer):
        usuario = self.request.user
        validar_limite_diario(usuario, contar_mensajes_hoy)
        serializer.save(emisor=usuario, deporte=usuario.deporte, division=usuario.division)


class MensajeDivisionDestroyView(generics.DestroyAPIView):
    queryset = MensajeDivision.objects.all()
    serializer_class = MensajeDivisionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_destroy(self, instance):
        validar_borrado(instance, self.request.user, timezone.now())
        instance.delete()
