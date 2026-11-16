from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
    path("announcement-bar/", views.PublicAnnouncementBarView.as_view(), name="announcement-bar"),
    path(
        "announcement-bar/manage/",
        views.AnnouncementBarManageView.as_view(),
        name="announcement-bar-manage",
    ),
    path("campaign-banners/", views.PublicCampaignBannersView.as_view(), name="campaign-banners"),
    path("campaign-banners/manage/", views.CampaignBannersManageView.as_view(), name="campaign-banners-manage"),
    path("campaign-banners/manage/<int:slot>/", views.CampaignBannerManageView.as_view(), name="campaign-banner-manage"),
    path("hero-banners/", views.PublicHeroBannersView.as_view(), name="hero-banners"),
    path("hero-banners/manage/", views.HeroBannerListCreateView.as_view(), name="hero-banners-manage"),
    path("hero-banners/manage/reorder/", views.HeroBannerReorderView.as_view(), name="hero-banners-reorder"),
    path("hero-banners/manage/settings/", views.HeroBannerSettingsView.as_view(), name="hero-banners-settings"),
    path("hero-banners/manage/<int:pk>/", views.HeroBannerDetailView.as_view(), name="hero-banner-detail"),
]
