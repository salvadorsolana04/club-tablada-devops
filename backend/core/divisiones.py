"""Divisiones válidas para cada deporte del club."""

DIVISIONES = {
    'rugby': ('M15', 'M17', 'M19', 'Primera'),
    'hockey': ('Sub 14', 'Sub 16', 'Sub 19', 'Plantel Superior'),
}


def validar_division(deporte, division):
    """Devuelve la división si corresponde al deporte; si no, lanza ValueError."""
    if deporte not in DIVISIONES:
        raise ValueError(f'Deporte desconocido: {deporte}.')
    if not division:
        raise ValueError('La división es obligatoria.')
    if division not in DIVISIONES[deporte]:
        raise ValueError(f'{division} no es una división de {deporte}.')
    return division
