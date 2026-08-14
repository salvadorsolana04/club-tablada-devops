from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    MensajeDivisionDestroyView,
    MensajeDivisionListCreateView,
    NoticiaListCreateView,
    PerfilView,
)

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('perfil/', PerfilView.as_view(), name='perfil'),
    path('noticias/', NoticiaListCreateView.as_view(), name='noticias'),
    path(
        'divisiones/mensajes/',
        MensajeDivisionListCreateView.as_view(),
        name='mensajes_division',
    ),
    path(
        'divisiones/mensajes/<int:pk>/',
        MensajeDivisionDestroyView.as_view(),
        name='mensaje_division_detail',
    ),
]
