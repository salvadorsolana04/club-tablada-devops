from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import MensajeDivision, Noticia, Usuario


class NoticiaPermisosTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            username='admin1', password='pass12345', rol=Usuario.Rol.ADMIN
        )
        self.jugador = Usuario.objects.create_user(
            username='jugador1', password='pass12345', rol=Usuario.Rol.JUGADOR
        )

    def test_jugador_puede_leer_noticias(self):
        self.client.force_authenticate(self.jugador)
        response = self.client.get(reverse('noticias'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_jugador_no_puede_crear_noticias(self):
        self.client.force_authenticate(self.jugador)
        response = self.client.post(
            reverse('noticias'), {'titulo': 'Título', 'contenido': 'Contenido'}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear_noticias(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('noticias'), {'titulo': 'Título', 'contenido': 'Contenido'}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Noticia.objects.count(), 1)
        self.assertEqual(Noticia.objects.first().creado_por, self.admin)

    def test_anonimo_no_puede_leer_noticias(self):
        response = self.client.get(reverse('noticias'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class MensajeDivisionPermisosTests(APITestCase):
    def setUp(self):
        self.entrenador_rugby = Usuario.objects.create_user(
            username='entrenador_rugby',
            password='pass12345',
            rol=Usuario.Rol.ENTRENADOR,
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
        )
        self.jugador_rugby_m19 = Usuario.objects.create_user(
            username='jugador_rugby_m19',
            password='pass12345',
            rol=Usuario.Rol.JUGADOR,
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
        )
        self.jugador_hockey_primera = Usuario.objects.create_user(
            username='jugador_hockey_primera',
            password='pass12345',
            rol=Usuario.Rol.JUGADOR,
            deporte=Usuario.Deporte.HOCKEY,
            division='Primera',
        )
        self.mensaje_rugby_m19 = MensajeDivision.objects.create(
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
            titulo='Entrenamiento',
            mensaje='Mañana 9hs',
            emisor=self.entrenador_rugby,
        )
        MensajeDivision.objects.create(
            deporte=Usuario.Deporte.HOCKEY,
            division='Primera',
            titulo='Partido',
            mensaje='Sábado 15hs',
            emisor=self.entrenador_rugby,
        )

    def test_usuario_solo_ve_mensajes_de_su_division(self):
        self.client.force_authenticate(self.jugador_rugby_m19)
        response = self.client.get(reverse('mensajes_division'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [m['id'] for m in response.data]
        self.assertEqual(ids, [self.mensaje_rugby_m19.id])

    def test_usuario_no_ve_mensajes_de_otra_division(self):
        self.client.force_authenticate(self.jugador_hockey_primera)
        response = self.client.get(reverse('mensajes_division'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            self.mensaje_rugby_m19.id, [m['id'] for m in response.data]
        )

    def test_jugador_no_puede_publicar_mensaje(self):
        self.client.force_authenticate(self.jugador_rugby_m19)
        response = self.client.post(
            reverse('mensajes_division'), {'titulo': 'Aviso', 'mensaje': 'Texto'}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_entrenador_puede_publicar_en_su_division(self):
        self.client.force_authenticate(self.entrenador_rugby)
        response = self.client.post(
            reverse('mensajes_division'), {'titulo': 'Aviso', 'mensaje': 'Texto'}
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['deporte'], Usuario.Deporte.RUGBY)
        self.assertEqual(response.data['division'], 'M19')


class UsuarioValidacionTests(TestCase):
    """Regla de validación: jugador/entrenador requieren deporte y división."""

    def test_jugador_sin_division_es_invalido(self):
        usuario = Usuario(username='jugador_sin_div', rol=Usuario.Rol.JUGADOR)
        usuario.set_password('pass12345')
        with self.assertRaises(DjangoValidationError):
            usuario.full_clean()

    def test_jugador_con_division_es_valido(self):
        usuario = Usuario(
            username='jugador_con_div',
            rol=Usuario.Rol.JUGADOR,
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
        )
        usuario.set_password('pass12345')
        usuario.full_clean()  # no debe lanzar

    def test_admin_sin_division_es_valido(self):
        usuario = Usuario(username='admin_sin_div', rol=Usuario.Rol.ADMIN)
        usuario.set_password('pass12345')
        usuario.full_clean()  # borde: admin no requiere deporte/division


class MensajeDivisionLimiteDiarioTests(APITestCase):
    """Regla de restricción: máximo LIMITE_MENSAJES_DIARIOS comunicados por día."""

    def setUp(self):
        self.entrenador = Usuario.objects.create_user(
            username='entrenador_limite',
            password='pass12345',
            rol=Usuario.Rol.ENTRENADOR,
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
        )

    def test_entrenador_puede_publicar_hasta_el_limite(self):
        self.client.force_authenticate(self.entrenador)
        for i in range(3):
            response = self.client.post(
                reverse('mensajes_division'), {'titulo': f'Aviso {i}', 'mensaje': 'Texto'}
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_entrenador_no_puede_superar_el_limite_diario(self):
        self.client.force_authenticate(self.entrenador)
        for i in range(3):
            self.client.post(
                reverse('mensajes_division'), {'titulo': f'Aviso {i}', 'mensaje': 'Texto'}
            )
        response = self.client.post(
            reverse('mensajes_division'), {'titulo': 'Aviso 4', 'mensaje': 'Texto'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MensajeDivision.objects.count(), 3)


class MensajeDivisionBorradoTests(APITestCase):
    """Regla de restricción: solo el emisor puede borrar, y solo dentro de las 24hs."""

    def setUp(self):
        self.entrenador = Usuario.objects.create_user(
            username='entrenador_borra',
            password='pass12345',
            rol=Usuario.Rol.ENTRENADOR,
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
        )
        self.otro_entrenador = Usuario.objects.create_user(
            username='otro_entrenador',
            password='pass12345',
            rol=Usuario.Rol.ENTRENADOR,
            deporte=Usuario.Deporte.HOCKEY,
            division='Primera',
        )
        self.mensaje = MensajeDivision.objects.create(
            deporte=Usuario.Deporte.RUGBY,
            division='M19',
            titulo='Reciente',
            mensaje='Texto',
            emisor=self.entrenador,
        )

    def test_entrenador_borra_su_propio_mensaje_reciente(self):
        self.client.force_authenticate(self.entrenador)
        response = self.client.delete(
            reverse('mensaje_division_detail', args=[self.mensaje.id])
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MensajeDivision.objects.filter(id=self.mensaje.id).exists())

    def test_no_puede_borrar_mensaje_ajeno(self):
        self.client.force_authenticate(self.otro_entrenador)
        response = self.client.delete(
            reverse('mensaje_division_detail', args=[self.mensaje.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(MensajeDivision.objects.filter(id=self.mensaje.id).exists())

    def test_no_puede_borrar_mensaje_vencido(self):
        MensajeDivision.objects.filter(id=self.mensaje.id).update(
            fecha=timezone.now() - timedelta(hours=25)
        )
        self.client.force_authenticate(self.entrenador)
        response = self.client.delete(
            reverse('mensaje_division_detail', args=[self.mensaje.id])
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(MensajeDivision.objects.filter(id=self.mensaje.id).exists())
