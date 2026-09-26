"""Tests unitarios de las reglas de comunicados: sin HTTP ni base de datos.

El mensaje y el usuario son stubs (SimpleNamespace con los atributos justos);
el contador de mensajes es un Mock, que además permite verificar cómo se lo usó.
"""

from contextlib import nullcontext as no_lanza
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from rest_framework.exceptions import PermissionDenied, ValidationError

from .reglas import LIMITE_MENSAJES_DIARIOS, validar_borrado, validar_limite_diario

PUBLICADO = datetime(2026, 9, 26, 10, 0, tzinfo=timezone.utc)
EMISOR = SimpleNamespace(id=1)
OTRO_USUARIO = SimpleNamespace(id=2)


def mensaje_de(emisor):
    return SimpleNamespace(emisor_id=emisor.id, fecha=PUBLICADO)


@pytest.mark.parametrize(
    'antiguedad, esperado',
    [
        (timedelta(hours=1), no_lanza()),
        (timedelta(hours=23, minutes=59), no_lanza()),
        (timedelta(hours=24), no_lanza()),  # borde: justo 24 hs todavía se puede
        (timedelta(hours=24, seconds=1), pytest.raises(ValidationError)),
    ],
    ids=['1h', '23h59m', 'justo-24h', '24h-y-1s'],
)
def test_emisor_puede_borrar_solo_dentro_de_las_24_horas(antiguedad, esperado):
    # Arrange
    mensaje = mensaje_de(EMISOR)
    ahora = PUBLICADO + antiguedad

    # Act / Assert
    with esperado:
        validar_borrado(mensaje, EMISOR, ahora)


def test_otro_usuario_no_puede_borrar_mensaje_ajeno_aunque_sea_reciente():
    # Arrange
    mensaje = mensaje_de(EMISOR)
    ahora = PUBLICADO + timedelta(minutes=5)

    # Act / Assert
    with pytest.raises(PermissionDenied):
        validar_borrado(mensaje, OTRO_USUARIO, ahora)


def test_limite_diario_rechaza_cuando_ya_mando_el_maximo():
    # Arrange: el doble dice que ya mandó el máximo, sin tocar la base
    contar_mensajes_hoy = Mock(return_value=LIMITE_MENSAJES_DIARIOS)

    # Act / Assert
    with pytest.raises(ValidationError):
        validar_limite_diario(EMISOR, contar_mensajes_hoy)


def test_limite_diario_permite_por_debajo_del_maximo_y_consulta_por_ese_usuario():
    # Arrange
    contar_mensajes_hoy = Mock(return_value=LIMITE_MENSAJES_DIARIOS - 1)

    # Act
    validar_limite_diario(EMISOR, contar_mensajes_hoy)  # no debe lanzar

    # Assert: la regla le preguntó al contador por ESTE usuario, una sola vez
    contar_mensajes_hoy.assert_called_once_with(EMISOR)
