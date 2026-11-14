from django.urls import path

from . import views

urlpatterns = [
    path("campaign-banner/", views.PublicCampaignBannerView.as_view(), name="campaign-banner"),
    path("campaign-banner/manage/", views.CampaignBannerManageView.as_view(), name="campaign-banner-manage"),
    path("hero-banners/", views.PublicHeroBannersView.as_view(), name="hero-banners"),
    path("hero-banners/manage/", views.HeroBannerListCreateView.as_view(), name="hero-banners-manage"),
    path("hero-banners/manage/reorder/", views.HeroBannerReorderView.as_view(), name="hero-banners-reorder"),
    path("hero-banners/manage/settings/", views.HeroBannerSettingsView.as_view(), name="hero-banners-settings"),
    path("hero-banners/manage/<int:pk>/", views.HeroBannerDetailView.as_view(), name="hero-banner-detail"),
]
