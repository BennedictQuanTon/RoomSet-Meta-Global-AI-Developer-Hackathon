"""Read a listing or screenshot into a draft, then store what the person confirmed."""

from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import ensure_editable, owned_session, read_upload
from app.api.presenters import session_view
from app.db.engine import get_db
from app.db.models import SessionRow
from app.domain.product import MeasuredField, Product, ProductConfirm, ProductDraft, ProductUrlIn
from app.domain.session import SessionView
from app.services.images import clean_image
from app.services.product_intake import read_listing, read_screenshot

router = APIRouter(prefix="/api/sessions/{session_id}/product", tags=["product"])


@router.post("/fetch")
def fetch_listing(
    body: ProductUrlIn,
    row: SessionRow = Depends(owned_session),
    db: Session = Depends(get_db),
) -> ProductDraft:
    db.commit()  # Release the connection during the slow network call.
    return read_listing(str(body.url))


@router.post("/screenshot")
async def fetch_screenshot(
    file: UploadFile, row: SessionRow = Depends(owned_session)
) -> ProductDraft:
    return read_screenshot(clean_image(await read_upload(file)).data)


@router.put("")
def confirm_product(
    body: ProductConfirm,
    row: SessionRow = Depends(owned_session),
    db: Session = Depends(get_db),
) -> SessionView:
    ensure_editable(row)
    confirmed = lambda value: MeasuredField(value_m=value, source="user", confidence="high")  # noqa: E731
    product = Product(
        source_url=str(body.source_url) if body.source_url else None,
        name=body.name,
        width=confirmed(body.width_m),
        depth=confirmed(body.depth_m),
        height=confirmed(body.height_m),
        image_urls=[str(url) for url in body.image_urls],
        appearance=body.appearance,
        confirmed=True,
    )
    row.product = product.model_dump(mode="json")
    db.commit()
    return session_view(row)
