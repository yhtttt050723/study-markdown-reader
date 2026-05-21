from fastapi import APIRouter

from app.schemas.api_models import RunnerExecuteBody, RunnerExecuteOut
from app.services.runner import execute_code

router = APIRouter(prefix="/api/runner", tags=["runner"])


@router.post("/execute/", response_model=RunnerExecuteOut)
def run_code(body: RunnerExecuteBody):
    result = execute_code(body.language, body.code, body.stdin)
    return RunnerExecuteOut(**result)
