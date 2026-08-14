from datetime import timedelta

from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MensajeDivision, Noticia
from .permissions import EsAdminOSoloLectura, EsEntrenadorOSoloLectura
from .serializers import MensajeDivisionSerializer, NoticiaSerializer, UsuarioSerializer

LIMITE_MENSAJES_DIARIOS = 3
VENTANA_BORRADO = timedelta(hours=24)


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
        mensajes_hoy = MensajeDivision.objects.filter(
            emisor=usuario, fecha__date=timezone.localdate()
        ).count()
        if mensajes_hoy >= LIMITE_MENSAJES_DIARIOS:
            raise ValidationError(
                {'detail': f'Alcanzaste el límite de {LIMITE_MENSAJES_DIARIOS} comunicados diarios.'}
            )
        serializer.save(emisor=usuario, deporte=usuario.deporte, division=usuario.division)


class MensajeDivisionDestroyView(generics.DestroyAPIView):
    queryset = MensajeDivision.objects.all()
    serializer_class = MensajeDivisionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_destroy(self, instance):
        usuario = self.request.user
        if instance.emisor_id != usuario.id:
            raise PermissionDenied('Solo podés borrar tus propios comunicados.')
        if timezone.now() - instance.fecha > VENTANA_BORRADO:
            raise ValidationError(
                {'detail': 'No se puede borrar un comunicado con más de 24 horas de antigüedad.'}
            )
        instance.delete()
