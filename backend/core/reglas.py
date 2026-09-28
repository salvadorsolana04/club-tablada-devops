"""Reglas de negocio de los comunicados de división.

Viven fuera de las views para poder testearlas sin HTTP ni base de datos:
lo que dependía de afuera (contar en la base, la hora actual) entra por parámetro.
"""

from datetime import timedelta

from rest_framework.exceptions import PermissionDenied, ValidationError

LIMITE_MENSAJES_DIARIOS = 3
VENTANA_BORRADO = timedelta(hours=24)


def validar_limite_diario(usuario, contar_mensajes_hoy):
    """Frena el comunicado si el usuario ya llegó al límite del día.

    contar_mensajes_hoy: función que recibe el usuario y devuelve cuántos
    comunicados mandó hoy. En producción consulta la base; en los tests, un doble.
    """
    if contar_mensajes_hoy(usuario) >= LIMITE_MENSAJES_DIARIOS:
        raise ValidationError(
            {'detail': f'Alcanzaste el límite de {LIMITE_MENSAJES_DIARIOS} comunicados diarios.'}
        )


def validar_borrado(mensaje, usuario, ahora):
    """Solo el emisor puede borrar su comunicado, y solo dentro de VENTANA_BORRADO."""
    if mensaje.emisor_id != usuario.id:
        raise PermissionDenied('Solo podés borrar tus propios comunicados.')
    if ahora - mensaje.fecha > VENTANA_BORRADO:
        raise ValidationError(
            {'detail': 'No se puede borrar un comunicado con más de 24 horas de antigüedad.'}
        )
