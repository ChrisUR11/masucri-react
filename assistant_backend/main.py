"""API privada para convertir solicitudes en acciones estructuradas de MASUCRI.

La API solo interpreta texto. Las consultas, los cálculos y las escrituras se
siguen haciendo en la app con sus utilidades y reglas actuales.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Literal

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "masucri-65fed")
ADMIN_EMAILS = {"ulloarodriguezchris@gmail.com", "anisrmj5@gmail.com"}


def _allowed_origins() -> list[str]:
    configured = os.getenv("ASSISTANT_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


app = FastAPI(title="MASUCRI Assistant", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class CatalogOption(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    price: float | None = Field(default=None, ge=0)


class InterpretRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    today: str = Field(min_length=10, max_length=10)
    catalog: list[CatalogOption] = Field(default_factory=list, max_length=150)


class DraftProduct(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    quantity: int | None = Field(default=1, ge=1, le=10000)
    unit_price: float | None = Field(default=None, ge=0)


class DraftOrder(BaseModel):
    customer: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=60)
    due_date: str | None = Field(default=None, max_length=10)
    products: list[DraftProduct] = Field(default_factory=list, max_length=20)
    notes: str | None = Field(default=None, max_length=1000)
    discount_type: Literal["amount", "percentage"] | None = None
    discount_value: float | None = Field(default=None, ge=0)
    advance: float | None = Field(default=None, ge=0)
    advance_method: str | None = Field(default=None, max_length=60)
    paid: float | None = Field(default=None, ge=0)
    payment_method: str | None = Field(default=None, max_length=60)


class InterpretResponse(BaseModel):
    intent: Literal[
        "help", "summary", "search_orders", "search_catalog", "search_customer",
        "create_order", "quick_sale", "unknown",
    ]
    query: str = ""
    status: str | None = None
    summary_scope: Literal["active", "debts", "cash", "business"] = "business"
    period: Literal["mes_actual", "mes_anterior", "ultimos_30", "este_anio", "historico", "personalizado"] = "mes_actual"
    range_start: str | None = Field(default=None, max_length=10)
    range_end: str | None = Field(default=None, max_length=10)
    draft: DraftOrder | None = None
    reply: str = ""


def _firebase_app():
    try:
        return firebase_admin.get_app()
    except ValueError:
        credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        credential = credentials.Certificate(credential_path) if credential_path else None
        return firebase_admin.initialize_app(credential, {"projectId": PROJECT_ID})


def _require_admin(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Inicia sesión para usar el asistente.")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = firebase_auth.verify_id_token(token, app=_firebase_app())
    except Exception as exc:  # No revelar detalles del token ni del proveedor.
        raise HTTPException(status_code=401, detail="La sesión no es válida. Vuelve a iniciar sesión.") from exc

    email = str(claims.get("email", "")).lower()
    firebase_claims = claims.get("firebase") or {}
    if (
        email not in ADMIN_EMAILS
        or claims.get("email_verified") is not True
        or firebase_claims.get("sign_in_provider") != "google.com"
    ):
        raise HTTPException(status_code=403, detail="Esta cuenta no puede usar el asistente.")
    return claims


SYSTEM_PROMPT = """Eres el intérprete de solicitudes de la aplicación administrativa MASUCRI, en Costa Rica.
No respondes cálculos ni afirmas datos del negocio. Solo conviertes el mensaje en una acción JSON para que la aplicación consulte los datos y calcule con su código.
Devuelve exclusivamente un objeto JSON con estas claves: intent, query, status, summary_scope, period, draft, reply.
intents permitidos: help, summary, search_orders, search_catalog, search_customer, create_order, quick_sale, unknown.
summary_scope: active (pedidos abiertos y atrasos), debts (saldos), cash (caja) o business (resumen de negocio). period: mes_actual, mes_anterior, ultimos_30, este_anio, historico o personalizado. Para personalizado, define range_start y range_end en YYYY-MM-DD si ambas fechas están claras.
Para buscar, conserva en query únicamente el nombre, producto o texto que se quiere buscar. Si summary_scope es debts y preguntan por una persona, guarda su nombre en query. Si summary_scope es cash y preguntan por una categoría, proveedor o concepto de gasto, guarda ese filtro en query; si no hay filtro específico, deja query vacío. En status usa solo Pendiente, En producción, Por Retirar, Entregado o Cancelado cuando el mensaje lo indique.
Para crear un pedido o una venta rápida, devuelve draft con customer, phone, due_date en YYYY-MM-DD, products [{name, quantity, unit_price}], notes, discount_type (amount o percentage), discount_value, advance, advance_method, paid y payment_method. Los métodos permitidos son Efectivo, Sinpe Móvil y Transferencia. Usa null cuando un dato no se indicó. Las ventas rápidas se registran como entregadas; los pedidos normales quedan pendientes.
Puedes elegir un producto de este catálogo y usar su precio únicamente cuando coincida claramente con lo pedido. No inventes precios, cantidades, fechas, teléfonos ni nombres. Si falta información, conserva null o una lista de productos vacía; la app permitirá completarla y revisar el borrador.
No solicites ni propongas cambiar estados, abonar, borrar, anular pedidos o editar movimientos de caja. Si piden una acción distinta, usa help y explica brevemente qué puedes hacer.
Si la solicitud es ambigua, usa unknown y pregunta en reply. Si el usuario pide ayuda, enumera en reply las búsquedas, resúmenes y borradores disponibles.
"""


def _interpret_with_model(payload: InterpretRequest) -> InterpretResponse:
    api_url = os.getenv("AI_CHAT_COMPLETIONS_URL", "").strip()
    api_key = os.getenv("AI_API_KEY", "").strip()
    model = os.getenv("AI_MODEL", "").strip()
    if not api_url or not api_key or not model:
        raise HTTPException(
            status_code=503,
            detail="El servicio de IA no está configurado. Revisa AI_CHAT_COMPLETIONS_URL, AI_API_KEY y AI_MODEL.",
        )

    catalog = [{"name": item.name, "price": item.price} for item in payload.catalog]
    user_content = {
        "today": payload.today,
        "catalog": catalog,
        "message": payload.message.strip(),
    }
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }).encode("utf-8")
    request = urllib.request.Request(
        api_url,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            completion = json.loads(response.read().decode("utf-8"))
        content = completion["choices"][0]["message"]["content"]
        result = InterpretResponse.model_validate_json(content)
    except HTTPException:
        raise
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="No se pudo interpretar la solicitud. Inténtalo de nuevo.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="La respuesta del servicio de IA no fue válida.") from exc

    if result.draft:
        # El tipo no puede cambiarse silenciosamente entre pedido y venta.
        result.draft.products = result.draft.products[:20]
    return result


@app.get("/health")
def health():
    return {"ok": True, "service": "masucri-assistant"}


@app.post("/api/interpretar", response_model=InterpretResponse)
def interpretar(payload: InterpretRequest, _claims: dict = Depends(_require_admin)):
    return _interpret_with_model(payload)
