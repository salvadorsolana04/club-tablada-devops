from rest_framework import serializers

from .models import MensajeDivision, Noticia, Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ('id', 'username', 'email', 'rol', 'deporte', 'division')


class NoticiaSerializer(serializers.ModelSerializer):
    creado_por = UsuarioSerializer(read_only=True)

    class Meta:
        model = Noticia
        fields = ('id', 'titulo', 'contenido', 'foto', 'fecha_creacion', 'creado_por')
        read_only_fields = ('fecha_creacion', 'creado_por')


class MensajeDivisionSerializer(serializers.ModelSerializer):
    emisor = UsuarioSerializer(read_only=True)

    class Meta:
        model = MensajeDivision
        fields = ('id', 'deporte', 'division', 'titulo', 'mensaje', 'foto', 'fecha', 'emisor')
        read_only_fields = ('fecha', 'emisor', 'deporte', 'division')
