from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import MensajeDivision, Noticia, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Club La Tablada', {'fields': ('rol', 'deporte', 'division')}),
    )
    list_display = ('username', 'email', 'rol', 'deporte', 'division', 'is_staff')
    list_filter = UserAdmin.list_filter + ('rol', 'deporte')


@admin.register(Noticia)
class NoticiaAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'creado_por', 'fecha_creacion')
    list_filter = ('fecha_creacion',)
    search_fields = ('titulo', 'contenido')


@admin.register(MensajeDivision)
class MensajeDivisionAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'deporte', 'division', 'emisor', 'fecha')
    list_filter = ('deporte', 'division')
    search_fields = ('titulo', 'mensaje')
