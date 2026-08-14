from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        JUGADOR = 'jugador', 'Jugador'
        ENTRENADOR = 'entrenador', 'Entrenador'
        ADMIN = 'admin', 'Admin'

    class Deporte(models.TextChoices):
        RUGBY = 'rugby', 'Rugby'
        HOCKEY = 'hockey', 'Hockey'

    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.JUGADOR)
    deporte = models.CharField(max_length=20, choices=Deporte.choices, blank=True, null=True)
    division = models.CharField(max_length=50, blank=True, null=True)

    def clean(self):
        super().clean()
        if self.rol in (self.Rol.JUGADOR, self.Rol.ENTRENADOR) and not (self.deporte and self.division):
            raise ValidationError(
                'Los usuarios con rol jugador o entrenador deben tener deporte y división asignados.'
            )

    def __str__(self):
        return self.username


class Noticia(models.Model):
    titulo = models.CharField(max_length=200)
    contenido = models.TextField()
    foto = models.ImageField(upload_to='noticias/', blank=True, null=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    creado_por = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='noticias_creadas'
    )

    class Meta:
        ordering = ['-fecha_creacion']

    def __str__(self):
        return self.titulo


class MensajeDivision(models.Model):
    deporte = models.CharField(max_length=20, choices=Usuario.Deporte.choices)
    division = models.CharField(max_length=50)
    titulo = models.CharField(max_length=200)
    mensaje = models.TextField()
    foto = models.ImageField(upload_to='mensajes_division/', blank=True, null=True)
    fecha = models.DateTimeField(auto_now_add=True)
    emisor = models.ForeignKey(
        Usuario, on_delete=models.CASCADE, related_name='mensajes_enviados'
    )

    class Meta:
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.titulo} ({self.deporte}/{self.division})'
