from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("reviews", views.ReviewViewSet, basename="review")

# The explicit manage paths must come before router.urls: the router's detail
# pattern would otherwise capture "reviews/manage/" as pk="manage".
urlpatterns = [
    path("reviews/manage/", views.ReviewManageListCreateView.as_view(), name="review-manage"),
    path(
        "reviews/manage/<int:pk>/",
        views.ReviewManageDetailView.as_view(),
        name="review-manage-detail",
    ),
] + router.urls
