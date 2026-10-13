from django.urls import path

from . import views

urlpatterns = [
    path("campaign-banner/", views.PublicCampaignBannerView.as_view(), name="campaign-banner"),
    path("campaign-banner/manage/", views.CampaignBannerManageView.as_view(), name="campaign-banner-manage"),
]
