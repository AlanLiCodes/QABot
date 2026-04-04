from fastapi import APIRouter

from models.schemas import GenerateTestsRequest, GenerateTestsResponse
from services.planner import generate_test_cases

router = APIRouter(tags=["tests"])


def _normalize_url(url: str) -> str:
    url = url.strip()
    if url and "://" not in url:
        url = "https://" + url
    return url


@router.post("/generate-tests", response_model=GenerateTestsResponse)
async def generate_tests(body: GenerateTestsRequest):
    cases = await generate_test_cases(
        _normalize_url(body.url),
        body.requirement_text,
        body.max_cases,
    )
    return GenerateTestsResponse(test_cases=cases)
