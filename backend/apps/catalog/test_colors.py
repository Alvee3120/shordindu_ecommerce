from decimal import Decimal

from rest_framework.test import APITestCase

from apps.cart.models import CartItem
from apps.catalog.models import (
    Attribute,
    AttributeValue,
    Category,
    Product,
    ProductAttributeValue,
    ProductColor,
    ProductVariation,
    VariationAttributeValue,
)
from apps.catalog.serializers import ProductSerializer
from apps.users.models import User


def make_product(name, sku, status=Product.Status.ACTIVE, price="100.00", stock=10):
    category, _ = Category.objects.get_or_create(name="Test Category")
    product = Product.objects.create(name=name, slug=name.lower().replace(" ", "-"), status=status)
    product.categories.set([category])
    variation = ProductVariation.objects.create(
        product=product,
        sku=sku,
        price=Decimal(price),
        stock_quantity=stock,
        is_active=True,
    )
    return product, variation


class ProductColorApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="color-admin@example.com", password="pw", name="Color Admin", role=User.Role.ADMIN
        )
        self.customer = User.objects.create_user(
            email="color-customer@example.com", password="pw", name="Color Customer"
        )
        self.product, self.variation = make_product("Color Product", "COLOR-1")
        self.client.force_authenticate(self.admin)

    def create_color(self, **overrides):
        payload = {
            "product": self.product.id,
            "name": "Black",
            "hex_code": "#000000",
            "is_active": "true",
        }
        payload.update(overrides)
        return self.client.post("/api/product-colors/", payload, format="multipart")

    def test_create_color_uses_shared_attribute_and_link(self):
        response = self.create_color()
        self.assertEqual(response.status_code, 201, response.data)
        color = ProductColor.objects.get(pk=response.data["id"])
        self.assertEqual(color.attribute_value.value, "Black")
        self.assertEqual(color.attribute_value.hex_code, "#000000")
        self.assertTrue(
            ProductAttributeValue.objects.filter(
                product=self.product, attribute_value=color.attribute_value
            ).exists()
        )

        serialized = ProductSerializer(self.product).data
        self.assertEqual(serialized["colors"][0]["name"], "Black")
        self.assertEqual(serialized["colors"][0]["hex_code"], "#000000")

    def test_duplicate_and_invalid_hex_rejected(self):
        self.assertEqual(self.create_color().status_code, 201)
        duplicate = self.create_color()
        self.assertEqual(duplicate.status_code, 400)

        other, _ = make_product("Other Product", "COLOR-2")
        bad_hex = self.create_color(product=other.id, name="Navy", hex_code="123")
        self.assertEqual(bad_hex.status_code, 400)
        self.assertIn("hex_code", bad_hex.data)

    def test_delete_is_blocked_while_variation_uses_color(self):
        color_id = self.create_color().data["id"]
        color = ProductColor.objects.get(pk=color_id)
        VariationAttributeValue.objects.create(
            variation=self.variation, attribute_value=color.attribute_value
        )

        blocked = self.client.delete(f"/api/product-colors/{color_id}/")
        self.assertEqual(blocked.status_code, 400)

        VariationAttributeValue.objects.filter(variation=self.variation).delete()
        self.assertEqual(self.client.delete(f"/api/product-colors/{color_id}/").status_code, 204)
        self.assertFalse(ProductColor.objects.filter(pk=color_id).exists())
        self.assertFalse(
            ProductAttributeValue.objects.filter(
                product=self.product, attribute_value=color.attribute_value
            ).exists()
        )

    def test_inactive_color_is_hidden(self):
        color_id = self.create_color().data["id"]
        self.client.patch(f"/api/product-colors/{color_id}/", {"is_active": "false"}, format="multipart")
        serialized = ProductSerializer(self.product).data
        self.assertEqual(serialized["colors"], [])

    def test_variation_colors_are_included_as_fallbacks(self):
        attribute = Attribute.objects.create(name="Color")
        black = AttributeValue.objects.create(attribute=attribute, value="Black")
        VariationAttributeValue.objects.create(variation=self.variation, attribute_value=black)
        serialized = ProductSerializer(self.product).data
        self.assertEqual([color["name"] for color in serialized["colors"]], ["Black"])
        self.assertEqual(serialized["colors"][0]["hex_code"], "#D1D5DB")

    def test_color_filter_and_facets(self):
        black_id = self.create_color().data["attribute_value"]
        other, other_variation = make_product("White Product", "COLOR-3")
        white = self.create_color(product=other.id, name="White", hex_code="#FFFFFF")
        white_id = white.data["attribute_value"]

        black_results = self.client.get(f"/api/products/?color={black_id}")
        self.assertEqual(black_results.status_code, 200)
        self.assertEqual(black_results.data["count"], 1)
        self.assertEqual(black_results.data["results"][0]["id"], self.product.id)

        both = self.client.get(f"/api/products/?color={black_id},{white_id}")
        self.assertEqual(both.data["count"], 2)

        facets = self.client.get("/api/products/color-facets/")
        self.assertEqual(facets.status_code, 200)
        counts = {color["name"]: color["count"] for color in facets.data["colors"]}
        self.assertEqual(counts["Black"], 1)
        self.assertEqual(counts["White"], 1)

        self.client.patch(
            f"/api/product-colors/{white.data['id']}/", {"is_active": "false"}, format="multipart"
        )
        self.assertEqual(self.client.get(f"/api/products/?color={white_id}").data["count"], 0)
        facets = self.client.get("/api/products/color-facets/")
        counts = {color["name"]: color["count"] for color in facets.data["colors"]}
        self.assertEqual(counts["White"], 0)

    def test_permissions(self):
        self.assertEqual(self.client.get("/api/product-colors/").status_code, 200)
        self.client.force_authenticate(self.customer)
        self.assertEqual(
            self.client.post(
                "/api/product-colors/",
                {"product": self.product.id, "name": "Red", "hex_code": "#FF0000"},
                format="multipart",
            ).status_code,
            403,
        )
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.post(
                "/api/product-colors/",
                {"product": self.product.id, "name": "Red", "hex_code": "#FF0000"},
                format="multipart",
            ).status_code,
            401,
        )

    def test_color_library_lists_shared_colors_with_usage(self):
        self.create_color(name="Black", hex_code="#000000")
        other, _ = make_product("Library Product", "COLOR-LIB")
        self.create_color(product=other.id, name="Black", hex_code="#000000")
        self.create_color(product=other.id, name="Sand Beige", hex_code="#B8AA9C")

        response = self.client.get("/api/attribute-values/color-library/")
        self.assertEqual(response.status_code, 200)
        by_name = {color["name"]: color for color in response.data}
        self.assertEqual(by_name["Black"]["usage_count"], 2)
        self.assertEqual(by_name["Black"]["hex_code"], "#000000")
        self.assertEqual(by_name["Sand Beige"]["usage_count"], 1)

        searched = self.client.get("/api/attribute-values/color-library/?search=beige")
        self.assertEqual([color["name"] for color in searched.data], ["Sand Beige"])


class CartStockValidationTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email="stock-customer@example.com", password="pw", name="Stock Customer"
        )
        self.client.force_authenticate(self.customer)

    def add(self, product, variation, quantity=1):
        return self.client.post(
            "/api/cart/items/",
            {"product": product.id, "variation": variation.id, "quantity": quantity},
            format="json",
        )

    def test_rejects_inactive_product_and_variation(self):
        draft_product, draft_variation = make_product(
            "Draft Product", "STOCK-1", status=Product.Status.DRAFT
        )
        self.assertEqual(self.add(draft_product, draft_variation).status_code, 400)

        product, variation = make_product("Inactive Variation", "STOCK-2")
        variation.is_active = False
        variation.save(update_fields=["is_active"])
        self.assertEqual(self.add(product, variation).status_code, 400)

    def test_rejects_oversell_and_caps_existing_quantity(self):
        product, variation = make_product("Limited Product", "STOCK-3", stock=5)
        self.assertEqual(self.add(product, variation, 6).status_code, 400)
        self.assertEqual(self.add(product, variation, 3).status_code, 201)
        self.assertEqual(self.add(product, variation, 3).status_code, 400)
        self.assertEqual(self.add(product, variation, 2).status_code, 200)
        self.assertEqual(CartItem.objects.get(variation=variation).quantity, 5)
