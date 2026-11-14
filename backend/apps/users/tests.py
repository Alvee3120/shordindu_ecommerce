from rest_framework.test import APITestCase

from apps.users.models import User


class AdminUserManagementTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="AdminPass12345",
            name="Admin One",
            phone="01700000001",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.cce = User.objects.create_user(
            email="cce@example.com",
            password="CcePass12345",
            name="CCE One",
            phone="01700000002",
            role=User.Role.CCE,
        )
        self.customer = User.objects.create_user(
            email="customer@example.com",
            password="CustomerPass12345",
            name="Customer One",
            phone="01700000003",
            role=User.Role.CUSTOMER,
        )

    def _create_payload(self, **overrides):
        payload = {
            "name": "New Person",
            "phone": "01700000099",
            "email": "new@example.com",
            "password": "StrongPass12345",
            "confirm_password": "StrongPass12345",
            "role": User.Role.CUSTOMER,
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    # -- create ----------------------------------------------------------

    def test_admin_can_create_each_role(self):
        self.client.force_authenticate(self.admin)

        for index, role in enumerate([User.Role.CUSTOMER, User.Role.CCE, User.Role.ADMIN], start=10):
            response = self.client.post(
                "/api/users/",
                self._create_payload(
                    email=f"created{index}@example.com",
                    phone=f"017000001{index}",
                    role=role,
                ),
                format="json",
            )
            self.assertEqual(response.status_code, 201, response.data)
            user = User.objects.get(email=f"created{index}@example.com")
            self.assertEqual(user.role, role)
            self.assertEqual(user.created_via, User.CreatedVia.ADMIN)
            self.assertEqual(user.created_by, self.admin)
            self.assertEqual(user.is_staff, role == User.Role.ADMIN)
            self.assertNotEqual(user.password, "StrongPass12345")
            self.assertTrue(user.check_password("StrongPass12345"))

    def test_create_without_email(self):
        self.client.force_authenticate(self.admin)
        payload = self._create_payload(email="", phone="01700000050")
        response = self.client.post("/api/users/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(phone="01700000050")
        self.assertIsNone(user.email)

    def test_duplicate_phone_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/", self._create_payload(phone=self.customer.phone), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.data)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_duplicate_email_rejected_case_insensitive(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/", self._create_payload(email="CUSTOMER@example.com"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_password_mismatch_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/", self._create_payload(confirm_password="DifferentPass12345"), format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("confirm_password", response.data)

    def test_short_password_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/users/",
            self._create_payload(password="short", confirm_password="short"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_non_admin_cannot_create(self):
        for user in (self.cce, self.customer):
            self.client.force_authenticate(user)
            response = self.client.post("/api/users/", self._create_payload(), format="json")
            self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(user=None)
        response = self.client.post("/api/users/", self._create_payload(), format="json")
        self.assertEqual(response.status_code, 401)

    # -- update / delete -------------------------------------------------

    def test_admin_can_edit_profile_and_role(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/users/{self.customer.id}/",
            {"name": "Renamed", "phone": "01700000077", "role": User.Role.CCE},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.name, "Renamed")
        self.assertEqual(self.customer.role, User.Role.CCE)
        self.assertEqual(response.data["created_via"], User.CreatedVia.SELF)
        self.assertFalse(self.customer.is_staff)

    def test_edit_to_duplicate_phone_rejected(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f"/api/users/{self.customer.id}/", {"phone": self.cce.phone}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.data)

    def test_self_deactivate_role_and_delete_blocked(self):
        self.client.force_authenticate(self.admin)

        response = self.client.patch(f"/api/users/{self.admin.id}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 400)

        response = self.client.patch(f"/api/users/{self.admin.id}/", {"role": User.Role.CCE}, format="json")
        self.assertEqual(response.status_code, 400)

        response = self.client.delete(f"/api/users/{self.admin.id}/")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_delete_other_user(self):
        self.client.force_authenticate(self.admin)
        response = self.client.delete(f"/api/users/{self.customer.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.customer.pk).exists())

    # -- password reset --------------------------------------------------

    def test_admin_resets_password(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/users/{self.customer.id}/reset-password/",
            {"new_password": "BrandNewPass12345", "confirm_password": "BrandNewPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.check_password("BrandNewPass12345"))
        self.assertTrue(self.customer.force_password_change)

    def test_password_reset_validation_and_permissions(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/users/{self.customer.id}/reset-password/",
            {"new_password": "BrandNewPass12345", "confirm_password": "Mismatch12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        response = self.client.post(
            f"/api/users/{self.admin.id}/reset-password/",
            {"new_password": "BrandNewPass12345", "confirm_password": "BrandNewPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        self.client.force_authenticate(self.cce)
        response = self.client.post(
            f"/api/users/{self.customer.id}/reset-password/",
            {"new_password": "BrandNewPass12345", "confirm_password": "BrandNewPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    # -- listing ---------------------------------------------------------

    def test_list_includes_origin_fields(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get("/api/users/?role=customer")
        self.assertEqual(response.status_code, 200)
        row = response.data["results"][0]
        self.assertIn("created_via", row)
        self.assertIn("created_by_name", row)

    def test_search_by_phone_name_or_email(self):
        self.client.force_authenticate(self.admin)
        for term in ("01700000003", "Customer One", "customer@example.com"):
            response = self.client.get(f"/api/users/?search={term}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["count"], 1, term)


class SignInTests(APITestCase):
    def test_sign_in_with_email(self):
        User.objects.create_user(
            email="someone@example.com", password="StrongPass12345", name="Someone", phone="01711111111"
        )
        response = self.client.post(
            "/api/auth/signin/",
            {"email": "SOMEONE@example.com", "password": "StrongPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["email"], "someone@example.com")

    def test_sign_in_with_phone_for_emailless_account(self):
        User.objects.create_user(
            email=None, password="StrongPass12345", name="Phone Only", phone="01822222222"
        )
        response = self.client.post(
            "/api/auth/signin/",
            {"email": "01822222222", "password": "StrongPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["email"])

    def test_sign_in_wrong_password_and_inactive(self):
        user = User.objects.create_user(
            email="someone@example.com", password="StrongPass12345", name="Someone", phone="01711111111"
        )
        response = self.client.post(
            "/api/auth/signin/",
            {"email": "someone@example.com", "password": "WrongPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        user.is_active = False
        user.save(update_fields=["is_active"])
        response = self.client.post(
            "/api/auth/signin/",
            {"email": "someone@example.com", "password": "StrongPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("inactive", str(response.data).lower())


class PhoneUniquenessTests(APITestCase):
    def setUp(self):
        self.existing = User.objects.create_user(
            email="existing@example.com", password="StrongPass12345", name="Existing", phone="01733333333"
        )

    def test_signup_rejects_duplicate_phone(self):
        response = self.client.post(
            "/api/auth/signup/",
            {
                "email": "new@example.com",
                "name": "New Person",
                "phone": self.existing.phone,
                "password": "StrongPass12345",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.data)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_signup_still_requires_email(self):
        response = self.client.post(
            "/api/auth/signup/",
            {"name": "No Email", "phone": "01744444444", "password": "StrongPass12345"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    def test_profile_update_rejects_duplicate_phone(self):
        self.client.force_authenticate(self.existing)
        response = self.client.patch(
            "/api/auth/me/", {"phone": "01733333333"}, format="json"
        )
        self.assertEqual(response.status_code, 200)

        other = User.objects.create_user(
            email="other@example.com", password="StrongPass12345", name="Other", phone="01755555555"
        )
        self.client.force_authenticate(other)
        response = self.client.patch(
            "/api/auth/me/", {"phone": self.existing.phone}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.data)

